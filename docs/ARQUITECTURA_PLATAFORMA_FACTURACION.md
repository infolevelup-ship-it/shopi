# Plataforma de Pedidos y Facturación WOW — Documentación Técnica Completa

> Contexto: todo esto se construyó de forma incremental sobre 3 herramientas no-code/low-code
> (GoHighLevel, Make.com, un formulario HTML standalone) más la API de Siigo. Este documento
> existe para dar contexto completo antes de decidir si se reconstruye como una app propia.
> Todo lo aquí escrito viene de inspección directa del código y de pruebas reales contra las
> APIs de producción (GHL, Make, Siigo) — no es teoría.

---

## 1. Resumen ejecutivo

El sistema toma un pedido (B2B o B2C), lo registra como Contacto + Oportunidad en GoHighLevel
(CRM), y cuando el pedido se aprueba internamente, dispara una automatización en Make.com que
crea (o busca) el cliente en Siigo y genera la factura electrónica DIAN. Es 4 sistemas
independientes cosidos con webhooks:

```
┌─────────────────┐      ┌──────────────────┐      ┌───────────────┐      ┌─────────┐
│  Formulario HTML │─────▶│  GoHighLevel (CRM)│◀────▶│  Make.com      │─────▶│  Siigo  │
│  (vendedora)     │      │  Workflows+Pipeline│      │  (integración) │      │ (DIAN)  │
└─────────────────┘      └──────────────────┘      └───────────────┘      └─────────┘
```

No hay backend propio. No hay base de datos propia. Todo el "estado" del negocio vive en los
custom fields de GHL. Toda la "lógica" vive repartida entre JavaScript en el navegador, la UI
visual de workflows de GHL, y los escenarios visuales de Make.

---

## 2. Componente 1 — Formulario (`formulario/WOW_Pedidos_B2B_v3.html`)

Single-file HTML/JS (sin build, sin framework, ~1600+ líneas), lo usan las vendedoras
directamente en el navegador. Tiene 3 pestañas:

- **Nuevo pedido** — flujo de 4 pasos: buscar/crear cliente (por NIT o por nombre en Siigo) →
  datos del pedido → carrito de productos → resumen y envío.
- **Buscar / Editar** — busca un pedido existente (por consecutivo o por nombre/razón social) y
  permite modificarlo antes de que se facture.
- **Prospecto** — registra visitas a clientes potenciales que aún no compran (primera y segunda
  visita).

### 2.1 Configuración central

```js
const CFG = {
  WEBHOOK_HUB:  'https://hook.us2.make.com/g9jrq7kaaorkvud41d3oqef3i613q4rh', // Make: "WOW - Buscar Cliente Siigo" (scenario 5110499)
  WEBHOOK_GHL:  'https://services.leadconnectorhq.com/hooks/IjwvmbFb0xuLFBqqq3Aw/webhook-trigger/...', // dispara el workflow "WOW - Recibir Pedido B2B"
  PRODUCTS_API: 'https://script.google.com/macros/s/.../exec' // Google Apps Script aparte, catálogo de productos
};
```

Tres backends distintos, cada uno con su propio protocolo y sin tipado compartido — cualquier
cambio de forma de payload en un lado puede romper al otro en silencio.

### 2.2 Estado global relevante

- `clientData` — objeto global con el cliente activo (viene de Siigo vía el Hub, o de GHL si se
  está editando un pedido existente). Casi todas las funciones lo leen directamente en vez de
  recibirlo por parámetro.
- `cart` — carrito de productos.
- `lastOrderSnapshot` — snapshot para regenerar el PDF sin re-consultar nada.
- `comprobantesData` — hasta 3 archivos de comprobante de pago cargados en memoria antes de
  subirlos.

### 2.3 Flujo de envío de un pedido nuevo (`enviarPedido`)

1. `subirComprobantes(consecutivo)` — sube 1 a 3 imágenes/PDF de comprobante de pago al Hub
   (`action:'comprobante'`), secuencial (`await` en loop, no en paralelo). Devuelve
   `{url_1, url_2, url_3}`.
2. Se arma el `payload` principal con **todo** el pedido (cliente, productos, totales, forma de
   pago, y ahora también `comprobante_url_2`, `comprobante_url_3` y `origen_venta` — agregados
   en esta sesión) y se envía a `CFG.WEBHOOK_GHL`. Esto dispara el workflow de GHL que crea el
   Contacto y la Oportunidad.
3. Si el webhook responde 200, se llama a `guardarDatosExtra()` — un **segundo** POST al Hub
   (`action:'comprobantes_guardar'`) para completar `origen_venta` y `fecha_cumpleanos` en la
   Oportunidad ya creada. Antes de disparar este segundo POST se espera **7 segundos**
   (`await new Promise(r=>setTimeout(r,7000))`), porque el workflow de GHL tarda unos segundos
   en terminar de crear la Oportunidad y el Hub la busca por nombre justo después.

**Punto delicado:** el webhook de GHL responde apenas *recibe* el payload, no cuando el
workflow *termina* de ejecutarlo. Todo lo que dependa de que la Oportunidad ya exista
(búsquedas posteriores) tiene una condición de carrera inherente. El delay de 7s es un parche,
no una garantía.

### 2.4 Manejo de errores — patrón recurrente y riesgoso

Casi todas las llamadas secundarias (subir comprobante, guardar datos extra, registrar visita)
siguen este patrón:

```js
try{
  await fetch(...);
}catch(e){ /* no bloquea el pedido */ }
```

Esto es intencional para no trabar a la vendedora si algo falla — pero significa que **fallos
reales pasan completamente desapercibidos**. Nadie se entera si un comprobante no se subió, si
el origen de venta no se guardó, o si Make devolvió un error. No hay logging, no hay alerta, no
hay reintento.

---

## 3. Componente 2 — GoHighLevel (CRM + Workflows)

**Location ID:** `IjwvmbFb0xuLFBqqq3Aw`

### 3.1 Pipelines relevantes

| Pipeline | Uso |
|---|---|
| Cliente Nuevo B2B | Primera compra de un cliente B2B (Adquisición). También donde caen las visitas de Prospecto. |
| Cliente Antiguo B2B | Recompras de clientes B2B existentes. |
| B2C | Pedidos de clientes finales. |
| Cliente Antiguo B2C, Shopify, Certificación OLAPLEX | Otros flujos, no cubiertos por esta documentación. |

Etapas típicas de un pipeline B2B: `Pedido tomado`/`Prospecto nuevo` → `Aprobado` →
`Revisar para facturar` → `Facturado` → `Pedidos Antiguos` (esta última es un archivo histórico,
no debería disparar nada — ver sección 9).

En `Cliente Nuevo B2B` además existen `Prospecto (solo visita)` y `Prospecto`, agregadas en esta
sesión para separar las visitas sin venta de los pedidos reales (antes compartían etapa con
pedidos reales de "Adquisición", causando confusión en reportes).

### 3.2 Workflow "WOW - Recibir Pedido B2B"

Trigger: **Inbound Webhook** (el `CFG.WEBHOOK_GHL` del formulario).

```
Inbound Webhook
  → Create Contact (upsert por identificación/teléfono — mapea ~17 custom fields del contacto)
  → Code step "tipo_cliente_flujo"
  → Branch por pipeline (Adquisición B2B / Recompras B2B / B2C)
      → Create Opportunity (mapea ~24-29 custom fields de la oportunidad, "Duplicate opportunity" HABILITADO)
      → Condition
      → Branch por vendedora_id → Add owner (asigna la oportunidad a la vendedora correcta)
```

**Puntos delicados encontrados y corregidos esta sesión:**
- El campo "Tipo de Identificación" guardaba `[object Object]` — el mapeo apuntaba a un token
  roto/mezclado en vez del string plano `id_type`. Corregido insertando el merge tag limpio.
- "Cliente Ciudad" apuntaba a `Ciudad.City Name` (un objeto anidado que el HTML **ya no manda**
  desde hace varias versiones — hoy `ciudad` viaja como string plano). GHL guarda el esquema del
  primer sample recibido y no se auto-actualiza; hubo que reescribir el token a mano.
- "Duplicate opportunity" estaba **deshabilitado** en el Create Opportunity de cada pipeline. Si
  un contacto ya tenía una oportunidad en ese pipeline (por cualquier motivo — reintento,
  prueba, error de red), la creación se saltaba **en silencio** y el webhook igual respondía
  `200 OK`, así que el formulario mostraba éxito aunque no se creó nada en GHL. Se habilitó en
  las 3 ramas.

### 3.3 Workflow "WOW - Disparar Facturación"

Trigger: **3 triggers "Pipeline Stage Changed"** (uno por pipeline: Cliente Nuevo B2B, Cliente
Antiguo B2B, B2C), cada uno filtrado estrictamente a `pipeline stage is "Facturado"`. Verificado
directamente en la UI — ninguno dispara por "Pedidos Antiguos" ni por ninguna otra etapa.

Acción única: un **Webhook nativo de GHL** ("Fire a webhook containing the contact's details")
apuntando al hook de Make `hook.us2.make.com/gzsnonphs1d2dxcwoo5pm4tqteth0fgd` (scenario
5589725), con ~28 pares de "Custom Data" (se anidan automáticamente bajo `customData` en el
payload que recibe Make).

**Nota de arquitectura importante:** este tipo de acción "Webhook" (no "Send Webhook" con JSON
manual) manda además "standard data" a nivel raíz del payload (fuera de `customData`) —
incluyendo, según el comportamiento estándar de GHL, el `contact_id` del contacto disparador.
Esto se descubrió porque **no existe ninguna forma de mapear el Contact ID como Custom Data**
(el picker solo ofrece "Assigned To (ID)" o "Account.Owner.ID", ninguno correcto) — es la señal
de que GHL ya lo manda por otro lado. Se corrigió Make para leer `{{1.contact_id}}` (raíz) en
vez de `{{1.customData.contact_id}}` (que apuntaba, mal, a `Account.Owner.ID`). **Esto no se
verificó con un payload real de muestra** — es la explicación más consistente con toda la
evidencia disponible, pero vale la pena confirmarlo con una ejecución real.

---

## 4. Componente 3 — Make.com (integración)

**Team ID:** `2249280` — **Organization ID:** `7542324`

### 4.1 Escenario "WOW - Buscar Cliente Siigo" (id `5110499`)

Es el "hub" — un único webhook (`WEBHOOK_HUB`) con un router que despacha por el campo `action`
del payload entrante:

| `action` | Qué hace |
|---|---|
| `buscar` | Busca cliente en Siigo por NIT (`identification`). |
| `crear` | Crea cliente en Siigo (no se auditó en detalle esta sesión). |
| `productos` | Catálogo de productos (no se auditó en detalle). |
| `buscar_pedido` | Busca una oportunidad existente (por consecutivo o nombre). |
| `editar_pedido` | Actualiza una oportunidad existente — usa `opportunity_id` directo, sin búsqueda. |
| `comprobante` | Sube un archivo a GHL media y guarda su URL en `comprobante_url` — **usa la misma búsqueda rota que `comprobantes_guardar` (ver 4.1.1)**, pero como esa URL igual viaja en el webhook principal, el fallo pasa desapercibido. |
| `comprobantes_guardar` | Guarda `comprobante_url_2/3`, `origen_venta` y `fecha_cumpleanos` en la oportunidad ya creada — 3 sub-rutas independientes bajo un router anidado, cada una con su propio filtro (solo corre si ese dato viene no-vacío). |
| `registrar_visita` (primera) | Crea Contacto + Oportunidad en `Cliente Nuevo B2B` / `Prospecto (solo visita)`. |
| `registrar_visita` (segunda) | Busca la oportunidad por nombre y la mueve a etapa `Prospecto`. |

#### 4.1.1 El bug más importante encontrado esta sesión

Casi todas las rutas que necesitan encontrar una oportunidad ya creada usan:

```
GET https://services.leadconnectorhq.com/opportunities/search?q={{...}}&limit=1
```

**El parámetro `q` de este endpoint hace match por PREFIJO del nombre/email del contacto o de la
oportunidad — no búsqueda de texto completo ni substring.** Como el nombre de la oportunidad se
arma `"{{nombre}}{{consecutivo}}"` o `"{{nombre}} {{consecutivo}}"`, el consecutivo **nunca** es
el prefijo del nombre — está al final. Resultado: **`q={{consecutivo}}` devuelve 0 resultados
el 100% de las veces**, sin importar el formato exacto (probado contra 3 pedidos reales
distintos, 0/3).

Esto se verificó empíricamente contra la API real de GHL, no es una suposición. Es la causa raíz
de que `comprobante_url_2`, `comprobante_url_3`, `origen_venta` y `fecha_cumpleanos` nunca
llegaran a la oportunidad — no era un problema de mapeo de campos (los IDs de custom field
siempre fueron correctos), era que la búsqueda que los ubica nunca encontraba nada.

**Fix aplicado:** se cambió la búsqueda para usar el **nombre del cliente** (`q={{nombre}}`) en
vez del consecutivo, ya que el nombre sí es el prefijo real del campo `name` de la oportunidad.
Además se movió `comprobante_url_2`, `comprobante_url_3` y `origen_venta` para que viajen
**directo en el webhook principal** (igual que `comprobante_url` desde el inicio) y se mapeen
directo en Create Opportunity — eliminando la dependencia de esta búsqueda para esos 3 campos
específicos. `fecha_cumpleanos` sigue dependiendo de la búsqueda por nombre (queda como riesgo
menor, ver sección 10).

**Riesgo residual de este fix:** buscar por nombre puede devolver **más de una** oportunidad si
el mismo contacto tiene varios pedidos con nombre similar. Se observó empíricamente que los
resultados vienen ordenados por más reciente primero, así que tomar `opportunities[1]` (el
primero, en índices de Make que arrancan en 1) es razonablemente seguro para el caso normal
(la llamada ocurre segundos después de crear el pedido), pero no es una garantía matemática.

### 4.2 Escenario "WOW - Aprobar y Facturar (FIX)" (id `5589725`)

Trigger: Custom Webhook (hook id `2328158`). Recibe el payload de "WOW - Disparar Facturación".

```
Módulo 1: Webhook (entrada)
Módulo 2: POST https://api.siigo.com/auth  → token Siigo (se pide de nuevo en CADA ejecución, no se cachea)
Router por: customData.cliente_nuevo + customData.estado_facturacion + customData.tipo_persona
  Ruta 0 — cliente_nuevo=true, no facturada, Empresa:
    POST /v1/customers (crea cliente Siigo, person_type=Company)
    POST /v1/invoices  (crea factura — solo si el cliente se creó bien)
    PUT  /contacts/{contact_id}    (guarda id_cliente_siigo)
    PUT  /opportunities/{opportunity_id}  (status=won, Estado Facturación=Facturada, Número Factura)
  Ruta 1 — cliente_nuevo=true, no facturada, Persona:
    Igual pero person_type=Person, y el nombre se separa en nombres/apellidos
    partiendo el string de razón social por el primer espacio (substring/indexOf) — FRÁGIL,
    ver sección 10.
  Ruta 2 — cliente_nuevo=false, no facturada:
    GET /v1/customers?identification={{nit_cliente}}  (busca cliente existente, no lo crea)
    POST /v1/invoices
    PUT  /opportunities/{opportunity_id}
```

**Bug corregido esta sesión:** `fiscal_responsibilities` estaba **hardcodeado** a
`[{"code":"R-99-PN"}]` para absolutamente todos los clientes nuevos, ignorando el valor real
capturado en el formulario (`customData.responsabilidad_fiscal`). Se corrigió para usar el valor
real, con ese mismo código como respaldo si viene vacío. `vat_responsible` **sigue** hardcodeado
a `false` — no se tocó por falta de certeza sobre la regla de negocio correcta (ver sección 10).

**Bug confirmado pero NO resuelto esta sesión — el más peligroso del sistema:**
la creación de la factura en Siigo (paso "POST /v1/invoices") y la actualización de GHL (paso
final "PUT /opportunities", que marca `Estado Facturación = Facturada`) son pasos **separados**
dentro de la misma ejecución. Se confirmó al menos una ejecución con **timeout tras 40 segundos**
("timeout of 40000ms exceeded") en un módulo HTTP. Si el timeout ocurre **después** de crear la
factura pero **antes** de marcar la oportunidad como Facturada, la factura queda creada en
Siigo pero GHL sigue mostrando "Pendiente" para siempre — nadie se entera de que ya se facturó.

Esto se **confirmó con un caso real**: la oportunidad de "Paola Andrea Bautista Ospina"
(NIT 37557147) mostraba `Estado Facturación = Pendiente` en GHL, pero existe una factura real
y activa en Siigo: **FV-4-36995**, $444.800, fecha 2026-08-26 — verificado consultando
directamente la API de Siigo con el NIT del cliente.

Como el filtro del router (`estado_facturacion ≠ Facturada`) es la **única** protección contra
crear una factura duplicada, y ese campo puede quedar desincronizado por este bug, **el sistema
no tiene ninguna protección real contra duplicar facturas** si una oportunidad "atascada" en
Pendiente vuelve a pasar por la etapa Facturado.

---

## 5. Componente 4 — Siigo (facturación electrónica DIAN)

### 5.1 Autenticación

`POST https://api.siigo.com/auth` con `username` + `access_key` (credenciales de una cuenta de
Siigo real, `ivonne@productoswow.com`) → token Bearer, expira en 24h (`expires_in: 86400`).
**Las credenciales están embebidas en texto plano dentro del blueprint de Make** (no usan el
sistema de conexiones/vault de Make) — cualquiera con acceso de edición al escenario las puede
leer directamente. Esto es deuda técnica seria para una app real: hay que mover esto a un
vault de secretos apropiado.

Todas las llamadas requieren el header `Partner-Id: IntegracioGHL`.

### 5.2 Endpoints usados

- `POST /v1/customers` — crear cliente.
- `GET /v1/customers?identification=<NIT>` — buscar cliente por NIT (esto sí funciona bien con
  filtro).
- `POST /v1/invoices` — crear factura.
- `GET /v1/invoices?customer_id=<uuid>` — **⚠️ este filtro NO funciona.** Se probó
  empíricamente pasando un `customer_id` inventado (`00000000-...`) y devolvió los mismos 25
  resultados que con un ID real — el parámetro se ignora silenciosamente y siempre devuelve las
  facturas más recientes sin filtrar. **Cualquier app nueva que necesite "traer las facturas de
  este cliente" no puede confiar en este parámetro** — hay que filtrar del lado del cliente
  (traer todo y filtrar por `customer.identification` en cada factura) o mantener la relación
  factura↔oportunidad del lado propio (GHL/DB), no consultarla a Siigo bajo demanda.
- `GET /v1/invoices/{id}` — sí trae el detalle completo, incluyendo `customer.identification`.

### 5.3 Estructura del cliente (customer)

```json
{
  "person_type": "Company" | "Person",
  "id_type": "13"|"31"|"22"|"42",   // códigos DIAN: 13=cédula, 31=NIT, etc.
  "identification": "...",
  "name": ["Razón Social"] | ["Nombres", "Apellidos"],
  "commercial_name": "...",
  "active": true,
  "vat_responsible": false,          // ⚠️ SIEMPRE false, hardcodeado — ver sección 10
  "fiscal_responsibilities": [{"code": "..."}],  // ahora dinámico (antes hardcodeado)
  "phones": [{"number": "..."}],
  "contacts": [{"first_name","last_name","email"}],
  "address": {
    "address": "...",
    "city": {
      "country_code": "Co",
      "state_code": "<primeros 2 dígitos del city_code DANE>",
      "city_code": "<código DANE completo, 5 dígitos>",
      "city_name": "..."
    }
  }
}
```

`state_code` se deriva de `city_code` con `substring(city_code, 0, 2)` — válido porque los
códigos DANE colombianos están estructurados así (departamento + municipio), no hace falta
mandar `state_code` por separado (aunque el sistema igual lo manda, es redundante pero
inofensivo).

### 5.4 Clientes duplicados en Siigo

Se confirmó que existen **2 y hasta 3 registros de cliente distintos en Siigo para el mismo
NIT** (ej. "Jesús, Alfonso Maldonado" tiene 2; "Paola Andrea Bautista Ospina" tiene 3). Esto pasa
porque distintos flujos (pedido real, visita de prospecto) crean el cliente en Siigo de forma
independiente sin verificar primero si ya existe con exactamente ese formato de nombre. No rompe
nada operativamente (Siigo permite duplicados), pero ensucia la base de clientes y puede
confundir reportes contables.

### 5.5 Series de numeración de facturas

Se observaron al menos 2 series activas: `FV-1-N` y `FV-4-N` (ej. `FV-1-16`, `FV-1-17`,
`FV-1-24` vs. `FV-4-36993`...`FV-4-37016`). No se investigó esta sesión a qué corresponde cada
serie (¿tipo de documento distinto? ¿centro de costo? ¿punto de venta?) — vale la pena aclararlo
antes de construir cualquier reporting sobre esto.

---

## 6. Flujo de datos end-to-end (feliz camino)

1. Vendedora llena el formulario → sube comprobantes → envía.
2. HTML → Make Hub (sube comprobantes) → HTML → GHL webhook (crea pedido).
3. GHL crea Contacto + Oportunidad en la etapa inicial del pipeline correspondiente.
4. HTML dispara un segundo POST al Hub 7s después, para completar datos secundarios.
5. Vendedora o supervisor mueve la Oportunidad manualmente por las etapas: Aprobado → Revisar
   para facturar → Facturado.
6. Al llegar a "Facturado", GHL dispara el webhook a Make ("WOW - Aprobar y Facturar").
7. Make: token Siigo → crea/busca cliente → crea factura → escribe de vuelta en GHL
   (`id_cliente_siigo`, `Estado Facturación=Facturada`, número de factura).
8. (Opcional, agregado esta sesión) Notificación interna a Logística (Carlos) cuando llega a
   "Aprobado".

---

## 7. Bugs encontrados y corregidos en esta sesión (resumen cronológico)

1. `Tipo de Identificación` guardaba `[object Object]` — token roto en Create Contact.
2. `Cliente Ciudad` apuntaba a una ruta anidada obsoleta (`Ciudad.City Name`) que ya no existe
   en el payload real (plano desde hace versiones).
3. "Duplicate opportunity" deshabilitado → pedidos repetidos del mismo contacto se perdían en
   silencio (webhook igual respondía 200 OK).
4. `comprobante_url_2`, `comprobante_url_3`, `origen_venta`, `fecha_cumpleanos` nunca llegaban
   a la oportunidad — causa raíz: búsqueda de oportunidad por consecutivo en GHL, que solo hace
   match por prefijo, nunca encontraba nada. Corregido buscando por nombre del cliente, y
   además mandando `comprobante_url_2/3` y `origen_venta` directo en el webhook principal.
5. Race condition: el segundo POST (`comprobantes_guardar`) se disparaba antes de que GHL
   terminara de crear la oportunidad — se agregó un delay de 7s.
6. Campo "Origen de Venta" en GHL era tipo texto libre, no coincidía con el desplegable del
   formulario (Instagram/Facebook/Visita presencial) — se recreó como campo tipo dropdown con
   las mismas opciones (esto cambió su ID interno, hay que re-mapearlo en Create Opportunity).
7. `contact_id` en el webhook de facturación apuntaba a `Account.Owner.ID` (dueño de la cuenta,
   no el contacto del cliente) — corregido para leer el `contact_id` que GHL manda
   automáticamente a nivel raíz del payload.
8. `fiscal_responsibilities` hardcodeado a `R-99-PN` para todos los clientes nuevos en Siigo,
   ignorando el valor real capturado — corregido.
9. Visitas de Prospecto compartían etapa ("Prospecto nuevo") con pedidos reales de Adquisición
   B2B — se creó una etapa separada ("Prospecto (solo visita)") para no mezclarlos en reportes.

---

## 8. Cosas delicadas de la conexión con Siigo (para tener en cuenta en la app nueva)

- **Nunca asumir que el filtro `customer_id` de `/v1/invoices` funciona** — está confirmado que
  no filtra nada.
- El token de auth dura 24h — cachearlo en vez de pedirlo en cada operación (Make lo pide en
  cada ejecución del escenario, ineficiente pero no roto).
- Los códigos DIAN de tipo de identificación y de responsabilidad fiscal son catálogos cerrados
  — cualquier valor libre que no coincida exactamente con el código esperado puede rechazar la
  creación del cliente o crearlo con datos fiscales incorrectos.
- La partición de nombre/apellido para personas naturales por "primer espacio" es frágil:
  falla con nombres de una sola palabra o apellidos compuestos con espacio.
- No hay endpoint (usado aquí) para verificar de forma barata "¿esta oportunidad ya tiene
  factura?" sin duplicar lógica — la única fuente de verdad hoy es el propio GHL, y ya se
  demostró que puede desincronizarse.

---

## 9. Sobre la etapa "Pedidos Antiguos" (aclarado esta sesión)

Se confirmó que **ningún trigger dispara nada al llegar/estar en "Pedidos Antiguos"** — los 3
triggers de "WOW - Disparar Facturación" están filtrados estrictamente a `stage = "Facturado"`,
verificado en la UI.

Lo que sí ocurre: al cargar pedidos **históricos** manualmente (ventas ya facturadas por fuera
del sistema, que se están registrando en GHL solo para tener el registro completo), si alguien
mueve la tarjeta paso a paso por las etapas para dejar constancia del historial, **el paso por
"Facturado" es un cambio de etapa real** y sí dispara la automatización — creando una factura
**duplicada** en Siigo para una venta que ya estaba facturada por fuera. Esto se confirmó con el
caso de Paola Andrea Bautista Ospina (factura FV-4-36995 real, orden "histórica" según el
equipo).

**No es un bug de código — es un hueco de proceso**: la misma vía (mover etapas) sirve tanto
para pedidos en vivo como para cargar historial, y el sistema no tiene forma de distinguirlos.
Propuesta pendiente de implementar: agregar un custom field checkbox "Pedido Histórico /
Importado" + una condición en el trigger que impida disparar el webhook si ese campo es `true`.

---

## 10. Problemas conocidos SIN resolver / riesgos activos

Ordenados por severidad aproximada:

1. **Sin protección real contra facturas duplicadas.** La única barrera es el campo
   `Estado Facturación` de GHL, que puede quedar desincronizado (ver punto 2). No hay ningún
   chequeo del lado de Siigo antes de crear una factura.
2. **El paso final de Make (marcar Facturada en GHL) puede fallar por timeout después de que la
   factura ya se creó en Siigo**, dejando el sistema en un estado inconsistente sin que nadie se
   entere. Causa raíz del timeout (¿lentitud de Siigo? ¿carga del escenario?) no diagnosticada.
3. **Import de pedidos históricos puede disparar facturación real en Siigo** (ver sección 9) —
   fix propuesto, no implementado.
4. **`vat_responsible` hardcodeado a `false`** para todos los clientes — no se validó si esto es
   correcto para todos los casos (ej. clientes que sí son responsables de IVA).
5. **Clientes duplicados en Siigo** (2-3 registros por NIT) — no hay verificación de existencia
   consistente entre los distintos flujos que crean clientes.
6. **Credenciales de Siigo y de GHL (Private Integration Token) embebidas en texto plano** dentro
   de los blueprints de Make — sin rotación, sin vault, visibles para cualquiera con acceso de
   edición al escenario.
7. **Manejo de errores silencioso en el formulario** — casi todas las llamadas secundarias
   tragan errores sin avisar a nadie (ni a la vendedora, ni a un log, ni a un admin).
8. **Partición de nombre/apellido frágil** para personas naturales (split por primer espacio).
9. **El rol exacto de `Codigo_completo.gs`** (Google Apps Script aparte, con `action=crear_factura`
   propio) no quedó claro esta sesión — puede ser código legado o un camino paralelo no
   documentado. Vale la pena auditarlo antes de construir la app nueva.
10. **Sin ambiente de pruebas/staging** — todos los fixes de esta sesión se probaron contra
    Siigo, GHL y Make de **producción** con pedidos de prueba reales.
11. **Series de facturación `FV-1` vs `FV-4`** sin documentar qué determina cuál se usa.
12. **La suposición sobre `contact_id` como dato "estándar" del webhook de GHL no se verificó
    con una muestra real** (ver sección 3.3) — confirmar con la próxima ejecución real.
13. **Riesgo residual de "match múltiple"** en las búsquedas por nombre (ver 4.1.1) — funciona
    bien en el caso normal, pero no es matemáticamente a prueba de fallos.

---

## 11. Inventario de IDs técnicos (referencia rápida)

| Cosa | Valor |
|---|---|
| GHL Location ID | `IjwvmbFb0xuLFBqqq3Aw` |
| Make Team ID | `2249280` |
| Pipeline Cliente Nuevo B2B | `fnjoyJYjMZZSUilcFf95` |
| Pipeline Cliente Antiguo B2B | `7iqaXHynP657ymwLGTmV` |
| Pipeline B2C | `EgkKJxN1sNIZFrCsz9HG` |
| Make scenario "WOW - Buscar Cliente Siigo" | `5110499` |
| Make scenario "WOW - Aprobar y Facturar (FIX)" | `5589725` |
| Make hook (hub) | `g9jrq7kaaorkvud41d3oqef3i613q4rh` |
| Make hook (facturación) | `gzsnonphs1d2dxcwoo5pm4tqteth0fgd` (hook id `2328158`) |

Los IDs de custom fields específicos de GHL (Origen de Venta, Comprobante URL 1/2/3, etc.) están
documentados en `docs/WORKFLOW_recibir_pedido_B2B_mapeos.md` y
`docs/WEBHOOK_Disparar_Facturacion_a_Make.md` — no se repiten aquí para evitar que este archivo
quede desactualizado en dos lugares a la vez.

---

## 12. Para cuando se construya la app propia

Cosas que una app propia (con backend y base de datos real) resolvería de raíz, solo por dejar
de depender de la arquitectura actual:

- Idempotencia real (una tabla `invoices` con constraint único por `opportunity_id`).
- Transacciones/reintentos apropiados en vez de un timeout de 40s sin retry ni alerta.
- Secretos en un vault real, no en texto plano dentro de un blueprint visual.
- Logging y alertas reales cuando algo falla, en vez de `catch(e){}`.
- Una sola fuente de verdad para "¿este cliente ya existe en Siigo?" en vez de crear a ciegas
  desde múltiples flujos.
- Separación explícita entre "cargar historial" y "operación en vivo" — dos endpoints/acciones
  distintas en vez de una sola vía (mover etapas) que sirve para ambas cosas.

Este documento, junto con los otros 2 en `docs/`, es el punto de partida para ese rediseño.
