# WOW Sales — Pendientes acumulados

Documento vivo. Cada vez que algo queda abierto durante la construcción, se anota aquí en vez de
perderse en el chat. Se resuelve al final de cada fase o cuando se decida explícitamente atacarlo.

## Tuyos (necesitan que tú actúes, no yo)

- [ ] Copiar `SUPABASE_SERVICE_ROLE_KEY` del dashboard de Supabase (Project Settings → API →
      `service_role` secreta) a `web/.env.local`. El MCP no la expone a propósito.
- [ ] Crear los 4 usuarios de prueba en Supabase (Authentication → Users) — uno por rol (`SELLER`,
      `WAREHOUSE`, `SUPERVISOR`, `ADMIN`) — e insertar su fila en `public.users`. Paso a paso en
      `web/README.md`.
- [ ] Conectar el repo a Vercel (Root Directory = `web`) para tener deploys automáticos.
- [ ] Decidir: ¿centro de costo único ("PUBLICO") o separado por canal (salón / estilista
      independiente / tiendas)? Ver `docs/06_INTEGRACION_SIIGO.md` §22 — es una decisión de negocio,
      no técnica, y ya hay 3 centros de costo sin usar en la cuenta real de Siigo.
- [ ] Pegar `SIIGO_USERNAME` / `SIIGO_ACCESS_KEY` / `SIIGO_PARTNER_ID` reales en `web/.env.local`
      (y luego en Vercel) — variables ya reservadas en `.env.example` desde la Fase 1, ahora sí en
      uso (Fase 7, `web/src/lib/siigo/client.ts`). Nunca las pegues en un mensaje que yo vaya a
      commitear; van solo en el `.env.local`/Vercel.
- [ ] **Antes de usar `syncCustomerToSiigoAction`/`syncOrderProductStockAction` contra la cuenta
      real por primera vez**: esta sesión no tuvo salida de red hacia `api.siigo.com` (bloqueada
      por política de organización — confirmado con `curl`, mismo 403 que en la sesión anterior),
      así que todo `web/src/lib/siigo/client.ts` se construyó siguiendo doc 06 y la referencia
      pública de Siigo, pero **sin una sola llamada real**. Antes de confiar en esto en producción,
      correr un caso de cada uno con datos reales y confirmar: la forma exacta de la respuesta de
      `/auth`, `/v1/customers` (búsqueda y creación) y `/v1/products/{id}`, y que el mapeo
      `document_type -> id_type` (NIT 31, CC 13, CE 22, PAS 41, TI 12 — catálogo público DIAN/Siigo,
      no específico de la cuenta) sea aceptado sin 4xx.
- [ ] Antes de poder facturar un solo pedido real: configurar `app_settings.siigo_payment_types` y
      `app_settings.siigo_tax_ids` con los ids reales de Siigo (ver § Fase 8 abajo para el SQL
      exacto) — hoy no existen esos datos, `InvoiceService` fallará con un error claro hasta que se
      configuren.
- [ ] Pegar `GHL_PRIVATE_TOKEN` / `GHL_LOCATION_ID` / `GHL_WEBHOOK_SECRET` reales en `web/.env.local`
      (y luego en Vercel) — variables ya reservadas desde la Fase 1, ahora en uso (Fase 9,
      `web/src/lib/ghl/client.ts`). Igual que con Siigo: nunca las pegues en un mensaje que yo vaya
      a commitear.
- [ ] Antes de que un solo cliente/pedido se sincronice de verdad con GHL: configurar
      `app_settings.ghl_pipeline_id` y `app_settings.ghl_pipeline_stage_id` con los ids reales del
      pipeline "Adquisición B2B" (o el que se use) — el workflow legado solo da los *nombres*, no
      los ids numéricos que la API v2 necesita.
- [ ] Al crear un usuario en `public.users`, considera llenar `ghl_user_id` (columna que ya existe
      desde la Fase 1) con el id real del usuario en GHL — sin esto, las oportunidades se crean sin
      `assignedTo` (doc 07 §6, "owner"). No hay pantalla de administración de usuarios todavía
      (fast-follow), así que hoy solo se puede llenar a mano vía SQL.

## Validación contra Siigo — puntos aún sin cerrar (doc 01 §68)

Reales, no supuestos — 4 de 5 ya se cerraron (ver doc 06 §22), estos siguen abiertos:

- [ ] Reconciliación completa tras timeout de facturación (`SiigoReconciliationService`, doc 06 §18) —
      sabemos que hay que consultar antes de reintentar, falta el endpoint/estrategia exacta.
- [ ] Regla completa de `vat_responsible` (solo se vio un ejemplo real, `false`; falta cuándo es `true`).
- [ ] Catálogo completo de responsabilidades fiscales (solo se vio un ejemplo real, `R-99-PN`).
- [ ] Campos fiscales estrictamente obligatorios vs. opcionales.
- [ ] Retención al 10%: el formulario la ofrece pero no se encontró en el catálogo real de Siigo —
      **riesgo real**, revisar antes de construir el `InvoiceService` (Fase 7).
- [ ] Rate limits de la API de Siigo.

## GHL (fase 9-10, sin empezar)

- [ ] Estrategia exacta de sincronización.
- [ ] Qué funciones actuales de GHL deben permanecer (CRM, marketing) vs. cuáles retira WOW.

## Migración (fase 12) — infraestructura construida, el ETL en sí sigue bloqueado

Ver el detalle completo en § Fase 12 más abajo. Lo que sigue sin resolverse, tal cual doc 09 §1 lo
exige ("debe definirse antes de la migración"):

- [ ] Qué información histórica se migra y qué se deja solo como referencia.
- [ ] Qué datos deben conservarse por razones legales/contables.
- [ ] Política de backups y recuperación.
- [ ] El universo real de clientes a migrar: doc 09 menciona ~12.000 en Siigo/GHL pero también un
      catálogo de Apps Script de ~26.000 — hay que confirmar cuál es el universo real antes de
      diseñar el proceso de dedupe.

## Fase 2 (clientes) — construido parcialmente, fast-follow pendiente

- [ ] Editar cliente ya existente.
- [ ] Reasignar responsable comercial (hoy `customer_assignments`/`responsible_user_id` se pueden
      leer, pero no hay pantalla para que supervisor/admin reasignen).
- [ ] Pantalla de fusión de duplicados (`merged_into_customer_id`, doc 09 §8-9) — necesaria sobre
      todo para la migración masiva de clientes.
- [ ] Historial de reasignaciones visible en la ficha del cliente (hoy `customer_assignments` es
      solo tabla, no se muestra en la UI).

## Fase 3 (productos) — construido parcialmente, fast-follow pendiente

- [ ] Editar producto existente / activar-desactivar.
- [ ] Listas de precio como concepto real (hoy son 3 columnas fijas: público/profesional/salón —
      suficiente para V1, pero el doc 02 no cierra si eso escala bien a más listas).
- [ ] Sincronización real con Siigo (Fase 7) — hasta entonces, todo producto se crea a mano por un
      admin y queda marcado "sin sincronizar con Siigo" (`siigo_product_id is null`).

## Fase 4 (cotizaciones) — construido parcialmente, fast-follow pendiente

- [ ] Editar cotización en borrador (hoy solo se puede crear, enviar, aceptar o perder — no editar
      líneas después de creada).
- [ ] Estado `FOLLOW_UP` (doc 04 §5 lo lista en el flujo) — no hay una acción manual para marcarlo,
      se dejó fuera de V1 a propósito para no sobreconstruir (doc 01 §55).
- [ ] Convertir cotización aceptada en pedido (`converted_order_id`, estado `CONVERTED`) — depende
      de que exista `orders` con UI real, es decir de la Fase 5. Hoy una cotización `ACCEPTED` se
      queda ahí sin siguiente paso automático.
- [ ] Cotización vencida (`EXPIRED`) — no hay job/lógica que la marque automáticamente al pasar
      `valid_until`.

## Fase 4 (cotizaciones) — bug real encontrado y corregido, dejar registro

`create_quote()` inicialmente terminaba con un `UPDATE` sobre `quotes` para grabar los totales ya
calculados. La tabla tiene RLS activo **sin ninguna política de UPDATE** (a propósito — las
transiciones de estado solo pasan por `send_quote`/`mark_quote_accepted`/`mark_quote_lost`,
`SECURITY DEFINER`). Ese `UPDATE` no daba ningún error: simplemente no afectaba ninguna fila (RLS
sin política = 0 filas visibles para actualizar) y dejaba `subtotal`/`grand_total` en `0` en
silencio — cada cotización se habría creado con el total en cero, sin que nada lo avisara. Se
encontró solo porque se probó el flujo completo (crear → enviar → aceptar) contra el proyecto real
en vez de confiar en que "el SQL corrió sin error". Se corrigió calculando todos los totales antes
del único `INSERT`, sin ningún `UPDATE` posterior — verificado con los números exactos
(100.000 − 5.000 descuento + 18.050 IVA = 113.050) contra datos reales, con rollback después.
**Lección para las próximas fases:** cualquier función que necesite "insertar y luego corregir con
un UPDATE" sobre una tabla con RLS sin política de UPDATE debe rediseñarse para no necesitar ese
UPDATE — no basta con que el SQL compile o corra sin excepción.

## Fase 4 — hueco de RLS encontrado en Fase 1/2, corregido aquí

`orders_insert` y `quotes_insert` (escritas en la Fase 1) dejaban crear pedidos/cotizaciones a
**cualquier rol autenticado, incluida bodega** — la condición `seller_id = current_wow_user_id()`
se cumple sola sin importar el rol, porque `seller_id` siempre es quien está llamando. Verificado
en vivo: una sesión de bodega simulada SÍ podía crear una cotización antes del fix, y quedó
bloqueada (`insufficient_privilege`) después. Doc 01 §4.1-4.3: solo `SELLER`/`SUPERVISOR`/`ADMIN`
crean cotizaciones y pedidos.

## Fase 5 (pedidos) — construido parcialmente, fast-follow pendiente

- [x] Editar pedido existente — hecho en la Fase G (ver su sección más abajo).
- [ ] Comprobante de pago (`attachments`, máximo 3 por pedido, doc 02 §15) — deliberadamente fuera
      de esta pasada: necesita un bucket de Supabase Storage con sus propias políticas, es un
      subsistema aparte que merece su propia pasada probada con cuidado, no ir pegado aquí.
  Todavía no se puede adjuntar comprobante de pago desde la UI.
- [ ] Recibo/PDF imprimible del pedido (doc 01 §17) — depende de que exista el pedido, fast-follow
      natural una vez haya bodega (Fase 6) revisándolo con el recibo en mano.
- [ ] `PENDING_REVIEW`/`IN_REVIEW`/`RETURNED_TO_SELLER` — estos estados los mueve bodega, no la
      vendedora; `submit_order()` deja el pedido en `SUBMITTED` y ahí termina su parte. Falta la
      Fase 6 completa (cola de revisión, checklist, aprobar/devolver).
- [ ] Retención al 10% deliberadamente NO se ofrece en el selector — doc 06 §14 marcó esa tasa como
      no encontrada en el catálogo real de Siigo; ofrecerla generaría pedidos que fallarían al
      facturar en la Fase 7. Si se confirma que sí existe, agregarla de vuelta.

## Fase 5 (pedidos) — tres bugs reales encontrados, corregidos y verificados

1. **`order_items` no tenía política de INSERT** — mismo hueco que tuvo `quote_items` en la Fase 4,
   pero esta vez se encontró revisando el esquema real antes de escribir la función, no por prueba
   y error. Agregada.
2. **`orders` no tenía `cancelled_by` ni `cancellation_reason`** — doc 01 §46 los exige junto con
   `cancelled_at` ("nunca borrar, siempre CANCELADO con quién y por qué"); solo existía la fecha.
   Agregadas ambas columnas.
3. **El trigger `log_order_status_change()` (de la Fase 1) usaba `auth.uid()` en vez de
   `current_wow_user_id()`** para `changed_by` — pero `changed_by` referencia `users(id)` (el id
   interno de WOW), no `auth.users(id)` (lo que devuelve `auth.uid()`). Son dos espacios de ID
   distintos. Nunca falló en las pruebas de la Fase 1 porque esas corrieron sin sesión JWT
   simulada (`auth.uid()` daba `null` ahí, caía a `seller_id` por pura coincidencia). En la Fase 5,
   con una sesión real simulada, `auth.uid()` devolvía un id de `auth.users` que no existe en
   `users` → violaba la foreign key en cuanto alguien enviaba o cancelaba un pedido de verdad.
   **Lección:** cualquier función/trigger escrito y probado sin una sesión JWT simulada real puede
   esconder este tipo de error — de ahora en adelante, toda prueba de una función que dependa de
   `auth.uid()`/rol debe simular la sesión completa, no correr como superusuario.

Los tres se verificaron con el flujo completo contra el proyecto real (crear pedido con 4
unidades, 10% descuento, 2.5% retención → enviar): `400.000 − 40.000 descuento + 68.400 IVA −
9.000 retención = 419.400`, exacto, con el historial de estado y la actividad del cliente quedando
registrados correctamente.

## Fase 6 (bodega) — construido parcialmente, fast-follow pendiente

- [ ] Impresión real del recibo (doc 01 §17) — el checklist tiene el punto "Recibo
      impreso/verificado" pero hoy es solo una casilla que bodega marca de palabra; no genera
      ningún PDF/representación imprimible todavía. Fast-follow natural, mismo motivo que ya
      estaba anotado desde Fase 5.
- [ ] Filtros de la cola "Urgentes"/"Con stock"/"Sin stock" (doc 08 §13) — no se construyeron:
      dependen de `stock_cache` poblado de verdad (Fase 7, Siigo), y construir el filtro contra un
      campo mayormente `null` hoy sería un filtro hueco. Solo quedó el orden por antigüedad
      (más viejo primero) y el estado.
- [ ] `PENDING_REVIEW` sigue sin ningún emisor — el enum existe (doc 04 §6) pero nada lo produce
      todavía; la cola trata `SUBMITTED` como "recién llegado, sin tocar" y `IN_REVIEW` como
      "alguien de bodega ya lo abrió". Si más adelante aparece una razón real para diferenciarlos
      (p. ej. una validación automática entre enviar y revisar), se puede insertar ahí sin romper
      nada — por ahora inventar esa distinción hubiera sido construir sin necesidad real (doc 01
      §55).
- [ ] No hay un "lock" real de concurrencia: si dos personas de bodega abren el mismo pedido casi
      al tiempo, ambas pueden ver el checklist y actuar — `start_order_review` es idempotente
      (reabrir no falla) pero no le impide a alguien más aprobar/devolver el mismo pedido que abrió
      otra persona. No es un bug de datos (el estado sí cambia de forma consistente y la segunda
      persona que intente actuar después de que el pedido ya salió de `IN_REVIEW` recibe el error
      de estado), es una simplificación deliberada para un equipo pequeño — anotarlo por si crece
      el equipo de bodega.
- [ ] Historial completo de revisiones no se muestra en el detalle del pedido — `order_reviews`
      guarda cada intento (aprobado o devuelto) pero la pantalla de pedido solo expone el motivo
      de la devolución más reciente vía `orders.return_reason`. Ver también `docs/06_INTEGRACION_SIIGO.md`
      Fase 7 antes de construir esto — puede tener sentido juntarlo con la pantalla de facturación.
- [ ] Facturar (doc 01 §18) es Fase 7 explícitamente — `APPROVED_FOR_INVOICE` es el último estado
      que toca esta fase; no hay ningún botón de facturar en ningún lado, a propósito.

## Fase 6 — diseño: por qué `orders.return_reason` existe además de `order_reviews`

El checklist de bodega (`order_reviews`) es intencionalmente invisible para la vendedora — RLS
(`order_reviews_select`) solo deja verlo a WAREHOUSE/SUPERVISOR/ADMIN, porque es la herramienta de
auditoría interna de bodega, no algo que la vendedora deba poder leer completo (puntuación
producto por producto, notas internas, etc.). Pero doc 01 §45 exige explícitamente que la
vendedora SÍ vea el motivo cuando le devuelven un pedido ("Pedido devuelto para corrección" +
motivo visible). Para no aflojar el RLS del checklist completo solo para exponer un campo,
`return_order_to_seller()` duplica el motivo en una columna nueva `orders.return_reason`, que sí
es visible por la política `orders_select` que la vendedora ya usa para ver sus propios pedidos.
Verificado con sesiones simuladas: la vendedora ve `return_reason` en su pedido devuelto, pero
`select count(*) from order_reviews` para ese mismo pedido le da `0` filas (RLS bloqueando el
checklist interno, como se esperaba).

## Fase 7 (Siigo) — lectura, crear cliente, y (más tarde) facturar

Primera pasada: solo lectura (auth, clientes, productos/stock) + crear cliente, decidido
explícitamente con el usuario dado que esta sesión no tiene salida de red hacia `api.siigo.com`
(política de organización, confirmado con `curl`). Facturar se dejó fuera a propósito en ese
momento — ver más abajo, § Fase 8, para lo que pasó después: el usuario pidió construirlo igual,
sabiendo que quedaría sin poder probarse contra la cuenta real.

- [x] `InvoiceService` — construido en la misma sesión, más tarde (ver § Fase 8 abajo), a pedido
      explícito del usuario tras confirmar que no había forma de probarlo en vivo desde aquí.
- [ ] Sincronización de productos hacia Siigo (`PRODUCT_SYNC`, doc 06 §11) — no se construyó
      creación/actualización de productos desde WOW hacia Siigo. El doc 10 §10 tampoco la pide
      ("Después: create customer" — nunca "create product"); WOW solo lee productos que ya existen
      en el catálogo de Siigo, nunca les da de alta.
- [ ] `CUSTOMER_SYNC` como job por lotes (doc 06 §11, tabla `sync_jobs`) — lo que se construyó es
      sincronización de un cliente a la vez, disparada a mano desde la ficha del cliente (botón
      "Sincronizar con Siigo", solo ADMIN). Un job masivo que recorra todos los clientes sin
      `siigo_customer_id` es un fast-follow razonable una vez haya credenciales reales para probarlo
      con volumen.
- [ ] Mapeo `document_type -> id_type` (`web/src/lib/siigo/client.ts`) usa el catálogo público
      DIAN/Siigo (NIT 31, CC 13, CE 22, PAS 41, TI 12) — es el mismo para cualquier cuenta de
      Siigo en Colombia, a diferencia de la retención o el centro de costo (que sí son datos
      propios de la cuenta y requirieron una consulta real, doc 06 §14/§22). Aun así, nunca se
      probó contra esta cuenta en particular — confirmar con el primer `syncCustomerToSiigoAction`
      real.
- [ ] Conflicto de clientes duplicados en Siigo (doc 06 §4: más de un resultado por identificación)
      solo se reporta al admin en la UI — no hay pantalla para resolverlo, hay que ir a Siigo
      directamente. Suficiente para V1 (debería ser un caso raro), fast-follow si aparece seguido.
- [ ] `syncOrderProductStockAction` actualiza `products.stock_cache` de todos los productos de un
      pedido con un clic, pero solo si ya tienen `siigo_product_id` — los productos creados a mano
      en la Fase 3 (todavía la mayoría, sin sincronización real de catálogo) no tienen ese campo y
      quedan "sin datos". Es exactamente el hueco que ya estaba anotado en la Fase 3
      ("Sincronización real con Siigo").

## Fase 8 (seguridad fiscal) — InvoiceService construido sin poder probarlo contra Siigo real

Al llegar a esta fase (doc 10 §11: idempotencia, `invoice_operations`, timeouts, `UNCERTAIN`,
reconciliación, auditoría), quedó claro que depende por completo de la llamada de facturación que
la Fase 7 había dejado fuera a propósito. Se le preguntó al usuario cómo seguir (saltar a GHL,
construir todo sin poder probarlo, o intentar con credenciales reales) — pegó credenciales reales
en el chat, pero la llamada de prueba la bloqueó el clasificador de seguridad de Claude Code antes
de siquiera llegar a la red (aparte del bloqueo de red a `api.siigo.com` ya confirmado antes, este
fue un bloqueo distinto, del propio Claude Code). Con las dos rutas de prueba agotadas, el usuario
pidió explícitamente construir `InvoiceService` completo de todas formas, aceptando que quedaría
sin ninguna validación real. **Esta es la pieza más crítica y menos probada de todo el proyecto —
no se toca en producción sin antes correr, como mínimo, los "10 obligatorias" de doc 06 §20.**

Lo que sí se pudo verificar sin salir a red, contra el proyecto real de Supabase (con sesiones JWT
simuladas y rollback, mismo rigor que las fases anteriores):

- La máquina de estados completa `APPROVED_FOR_INVOICE -> INVOICING -> INVOICED` y el reclamo
  atómico (`UPDATE ... WHERE status = 'APPROVED_FOR_INVOICE'`) que evita que dos personas (o un
  doble clic) facturen el mismo pedido dos veces — doc 06 §20 lo marca como prueba obligatoria;
  verificado explícitamente: el primer reclamo afecta 1 fila, el segundo intento sobre el mismo
  pedido afecta 0.
- Que un `UNCERTAIN` (timeout) NUNCA revierte el pedido a `APPROVED_FOR_INVOICE` — se queda
  "atascado" en `INVOICING` a propósito hasta que alguien reconcilie, exactamente lo que doc 06 §17
  exige ("timeout ≠ factura inexistente").
- El flujo completo de reconciliación manual: `UNCERTAIN` -> confirmar que sí se emitió -> insertar
  `invoices`, mover el pedido a `INVOICED`. Los nombres de columna, tipos y relaciones entre
  `orders`/`invoice_operations`/`invoices` son correctos (se insertaron/actualizaron sin error).
  También se verificó por separado, con un script de Node sin red, que `buildSiigoInvoicePayload`
  arma el JSON correcto para el caso real de Fase 5 (4 unidades, 10% descuento, 2.5% retención ->
  id 2956, confirmado en doc 06 §14) y que **rechaza** con un error claro un intento de retención al
  10% en vez de inventar un id.

Lo que **no** se pudo verificar, porque necesita una respuesta real de Siigo:

- [ ] La forma exacta de la respuesta de `POST /v1/invoices` (¿el campo es `id`, `name`, `number`?
      ¿trae `stamp.status`?) — `web/src/lib/siigo/types.ts` sigue la referencia pública, no un
      ejemplo real.
- [ ] Si Siigo de verdad devuelve 4xx/429/5xx como se espera, o algo distinto (por ejemplo, 200 con
      un cuerpo de error) — la clasificación ERROR_FINAL vs ERROR_RETRYABLE depende de esto.
- [ ] El campo `code` de cada línea de factura: se está mandando `product_code_snapshot` (el SKU),
      asumiendo que Siigo identifica el producto de la factura por su código, no por su id interno
      — no confirmado.
- [ ] El campo `discount` por línea: se manda como valor monetario (`discount_value`), no como
      porcentaje — Siigo podría esperar otra forma.
- [ ] Si Siigo exige un campo `seller` (vendedor) — WOW no tiene mapeo `users -> siigo seller id`
      todavía; se omite el campo si no está configurado en `app_settings.siigo_seller_map`, lo cual
      podría fallar con un 4xx si Siigo lo exige.
- [ ] La heurística de reconciliación (`searchSiigoInvoiceCandidatesAction`) busca por
      `customer_id` + ventana de fecha de ±1 hora alrededor del intento — nunca se confirmó que
      `GET /v1/invoices` acepte esos filtros exactos (`created_start`/`created_end`/`customer_id`).
      Por diseño nunca asocia sola: siempre le muestra los candidatos a un ADMIN para confirmar.

**Configuración obligatoria antes de poder facturar un solo pedido real** — `InvoiceService` falla
con un error claro (nunca inventa un valor) si falta cualquiera de estos en `app_settings`:

```sql
-- Forma de pago WOW -> id de forma de pago en Siigo (NO confirmado, sin datos reales todavía)
insert into app_settings (key, value) values (
  'siigo_payment_types',
  '{"contado": 0, "credito_15": 0, "credito_30": 0, "credito_45": 0, "credito_60": 0, "contra_entrega": 0}'
);
-- % de IVA -> id de impuesto en Siigo (NO confirmado; doc 06 §14 solo confirmó que existen IVA 0%/19% en la cuenta, sin ids)
insert into app_settings (key, value) values ('siigo_tax_ids', '{"0": 0, "19": 0}');
-- Centro de costo: opcional, default 86 (PUBLICO) si no se configura — doc 06 §22
insert into app_settings (key, value) values ('siigo_cost_center', '86');
-- Vendedor WOW -> id de vendedor en Siigo: opcional, se omite el campo si falta
insert into app_settings (key, value) values ('siigo_seller_map', '{}');
```

- [ ] No se construyó una pantalla de administración para estos `app_settings` — no tenía sentido
      construir un formulario bonito para valores que hoy nadie conoce (dependen de credenciales
      reales que no se pudieron usar). Fast-follow una vez existan los ids reales.
- [ ] Rol para facturar: solo `WAREHOUSE`/`ADMIN` — `SUPERVISOR` queda fuera porque doc 05 §6 lo
      marca "según política" sin definir cuál. Cambiar es una línea en
      `web/src/lib/actions/invoices.ts` (`invoiceOrderAction`) una vez se decida.
- [ ] Job de reintento automático para `ERROR_RETRYABLE` — hoy el reintento es manual (el usuario
      vuelve a apretar "Facturar"); doc 06 no exige que sea automático, pero sería un fast-follow
      razonable una vez esté probado en producción.

## Fase 9 (GHL) — construido completo, sin poder validarlo contra la API real

Mismo bloqueo de red que Siigo: esta sesión no tiene salida hacia `services.leadconnectorhq.com`
(confirmado con `curl`, mismo 403 de política de organización). A diferencia de Siigo, el riesgo si
algo sale mal es bajo — GHL es CRM y comunicación, nunca fiscal (doc 07 §17: "WOW controla el
negocio") — así que se construyó el alcance completo del doc 10 §12 (contact upsert, opportunity,
owner, sync, webhooks) de una vez, sin pasar por la conversación de riesgo que sí hizo falta para
Siigo.

Lo bueno: a diferencia de Siigo, para GHL sí existen datos reales de la cuenta —
`docs/WORKFLOW_recibir_pedido_B2B_mapeos.md` documenta los `fieldKey` reales de ~30 custom fields
(confirmados porque ya los usaba la automatización de Make/GHL antes de esta migración), incluidos
dos ids numéricos reales (`Cliente State Code` = `u0AO64m1fA5ku2US9hq5`, `Cliente City Code` =
`fhp1RsOsLaY3L3qjQhYc`, aunque el código no los usa directamente — se manda por `key`, no por
`id`, ver abajo). `web/src/lib/ghl/client.ts` los usa tal cual, con los acentos rotos que GHL ya
resuelve así (`tipo_de_identificacin`, `nmero_de_identificacin`).

- [x] Contact upsert (doc 07 §3) — `syncCustomerToGhlAction`, se llama automáticamente al final de
      `createCustomerAction` (Fase 2). Best-effort: si falla, el cliente en WOW queda creado igual
      (doc 07 §9) y queda `ghl_sync_status = 'ERROR'` con el motivo, reintentable a mano.
- [x] Opportunity (doc 07 §4) — `syncOrderToGhlAction`, se llama automáticamente al final de
      `createOrderAction` (Fase 5). Si el cliente todavía no tiene `ghl_contact_id`, lo sincroniza
      primero (mismo encadenamiento que Siigo con `siigo_customer_id` antes de facturar).
- [x] Owner (doc 07 §6) — `users.ghl_user_id` (ya existía desde la Fase 1) se manda como
      `assignedTo` de la oportunidad si está lleno; si no, se omite el campo en vez de fallar.
- [x] Sync status (doc 07 §8-9) — columnas `ghl_sync_status`/`ghl_last_synced_at`/`ghl_sync_error`
      en `customers` y `orders` (no existían, migración `0012`), con retry manual visible para
      ADMIN en ambas fichas.
- [x] Webhooks (doc 07 §11) — `POST /api/webhooks/ghl?secret=...`: autentica con secreto compartido
      en la URL (GHL no documenta HMAC estándar para esto), deduplica con un hash SHA-256 del
      cuerpo crudo como llave única (GHL no confirma un id de evento estable), y registra en
      `ghl_webhook_events`. **A propósito NO procesa nada todavía** — doc 07 §12 es explícito:
      "cambiar una etapa manualmente en GHL nunca debe crear una factura fiscal", así que mientras
      no haya una razón concreta y seguura para actuar sobre un evento, el endpoint solo lo guarda.

Simplificación deliberada vs. el workflow legado:

- [ ] El Make/GHL legado tenía DOS pipelines con un router (cliente nuevo → "Adquisición B2B",
      cliente recurrente → "Recompras B2B"). Esta versión usa un solo par
      `app_settings.ghl_pipeline_id`/`ghl_pipeline_stage_id` fijo — WOW no tiene hoy un dato limpio
      de "es la primera compra de este cliente" para replicar esa rama. Fast-follow si se necesita
      esa distinción: `customers.status` (`PROSPECT` vs `ACTIVE`) ya casi lo resuelve.
- [ ] `contacto_nombre`/`contacto_apellido`/`contacto_email` (persona de contacto secundaria en la
      empresa, del mapeo legado) no se mandan — WOW no distingue esa persona del cliente mismo.
- [ ] `lista_de_precio` y `cliente_nuevo` (custom fields de la oportunidad) tampoco se mandan — WOW
      no tiene ese dato limpio en el pedido hoy.

Lo que **no** se pudo verificar por falta de acceso real a GHL:

- [ ] Que la API v2 acepte custom fields por `key` (fieldKey) en vez de por `id` numérico — se
      asume que sí porque GHL resuelve los tokens `{{contact.X}}` por key en su editor, pero nunca
      se confirmó contra el endpoint `/contacts/upsert`/`/opportunities/` en sí.
- [ ] La forma exacta de la respuesta de `/contacts/upsert` y `/opportunities/` (¿siempre viene
      `{contact: {...}}` / `{opportunity: {...}}`?) — `web/src/lib/ghl/types.ts` sigue la
      referencia pública, no un ejemplo real.
- [ ] Si `POST /opportunities/` de verdad requiere `pipelineId`+`pipelineStageId` juntos o alguna
      otra combinación.

Lo que sí se verificó sin red, contra el proyecto real de Supabase (con rollback) y con un script
de Node: el dedup de `ghl_webhook_events` (segundo intento con la misma `ghl_event_key` rechazado
por `unique_violation`, tal como el endpoint lo espera para responder "duplicate"), la escritura de
las columnas de estado de sync, y que `buildGhlContactPayload` arma exactamente los `fieldKey`
reales confirmados por el mapeo legado (NIT→31, CC→13, nombres de persona natural sin cortar,
`companyName` solo para jurídica).

## Fase 10 (CRM) — seguimiento inteligente, riesgo, panel diario de la vendedora

A diferencia de Siigo/GHL, esta fase no depende de ningún sistema externo — todo se pudo construir
Y probar de verdad contra el proyecto real de Supabase (sesiones JWT simuladas, con rollback).

- [x] Timeline (doc 01 §27) — ya existía desde la Fase 2 (`customer_activities` en la ficha del
      cliente); no hizo falta construir nada nuevo aquí.
- [x] Follow ups (doc 01 §28) — `follow_ups` ya existía desde la Fase 1 (tabla + RLS select/insert).
      Se agregó `complete_follow_up()` (no había forma de completar uno, la tabla no tiene política
      de UPDATE) y la UI para crear/completar desde la ficha del cliente.
- [x] Risk / next purchase (doc 01 §28-29) — se extendió la vista `customer_metrics` (Fase 1) con
      `avg_days_between_orders` (calculado de los huecos reales entre pedidos facturados
      consecutivos, con `LAG()`), `estimated_next_purchase_at`, e `is_at_risk`. Verificado con datos
      simulados: 3 pedidos facturados con huecos de 20 días → frecuencia 20, en el límite (20 días
      desde la última) → no en riesgo; el mismo cliente con 60 días desde la última compra y la
      misma frecuencia → sí en riesgo. La tolerancia (1.5× la frecuencia) es un primer valor
      razonable, no un dato medido — doc 01 §58 es explícito: "la fórmula exacta se definirá
      después de observar datos reales", así que esto se anota aquí a propósito para revisarlo
      cuando haya datos reales de compra.
- [x] Priorities (doc 01 §30/§58) — el panel diario de la vendedora (ahora la página `/` para rol
      SELLER) muestra 3 categorías explicables (cliente fuera de ciclo, cotización abierta de alto
      valor, pedido devuelto pendiente de corrección), cada una con su razón en texto plano — nunca
      un puntaje compuesto. doc 01 §58 lo pide así explícitamente: "nunca debe ser una caja negra
      sin explicación".
- [x] Hueco de rol corregido de paso: `follow_ups_insert` (desde la Fase 1) tenía el mismo problema
      ya visto en `orders_insert`/`quotes_insert` — "seller_id = uno mismo" no restringe nada,
      cualquier rol lo cumple poniéndose a sí mismo. Verificado con sesión de bodega simulada:
      bloqueada después del fix. doc 05: solo Seller "hace seguimiento".

Deliberadamente fuera de esta pasada:

- [ ] Dashboard de supervisor/admin (doc01 §32, "ventas por vendedora/cliente/producto") — es
      territorio de la Fase 11 ("Reportes"), no de esta. El panel diario de doc 01 §30 es
      explícitamente "la primera pantalla de la vendedora", no de los demás roles.
- [ ] "Cliente de alto valor sin contacto" — doc 01 §30 lo lista como una 4ª categoría de
      prioridad, pero necesita definir qué es "alto valor" con datos reales; se dejó fuera para no
      inventar un umbral arbitrario (mismo criterio que ya se aplicó a la retención del 10% en
      Siigo: no inventar valores sin base).
- [ ] Notificaciones (doc 01 §57) — el panel muestra los mismos conteos "en la pantalla", pero no
      hay push/email/WhatsApp todavía; es una capa aparte, no bloquea lo de esta fase.
- [ ] Job que pase `follow_ups.status` de `PENDING` a `OVERDUE` automáticamente — el enum lo
      contempla pero no hay infraestructura de jobs en este proyecto (todo es on-demand); "vencido"
      se calcula al leer (`status = PENDING and scheduled_at < now()`), no se guarda.

## Fase 11 (Reportes) — construido y probado, alcance acotado a propósito

Igual que Fase 10, sin dependencias externas — todo probado de verdad contra el proyecto real
(sesiones simuladas, con rollback). No hizo falta ninguna migración: todos los datos ya existían
(timestamps de `orders`, `order_status_history`, `invoice_operations`, `customer_metrics`).

- [x] Una sola pantalla `/reports` con selector Hoy/Mes (doc 01 §52-53 son la misma pregunta en dos
      ventanas de tiempo distintas, no dos pantallas separadas) que muestra secciones según el rol
      (doc 10 §14: seller/warehouse/supervisor/admin):
      - **Vendedora**: ventas, pedidos facturados, ticket promedio, clientes nuevos, cotizaciones
        (creadas/ganadas/perdidas/valor perdido) — todo escaneado a lo suyo (`seller_id`/
        `responsible_user_id` = ella).
      - **Bodega**: pendientes de revisión (ahora mismo), devueltos, errores de facturación, tiempo
        promedio a revisión y a facturar — estos últimos dos salen de los timestamps reales de
        `orders` (doc 01 §33: "deben salir de timestamps reales, no de cálculos manuales"),
        verificado con datos exactos (10 min → 0.1667 h, 90 min → 1.5 h).
      - **Supervisor/admin**: todo lo anterior sin filtrar por vendedora, más ventas por
        vendedora/cliente/producto (top 10), clientes en riesgo (reusa `customer_metrics` de la
        Fase 10), y stock más bajo (de los productos que sí tienen `stock_cache`, honesto sobre que
        los que no están sincronizados con Siigo simplemente no aparecen).
- [ ] "Diferencias de inventario detectadas" (doc 01 §32) — no se construyó: el sistema no tiene
      ninguna fuente de conteo físico contra la cual comparar `stock_cache`. No hay ningún dato que
      mostrar sin inventarlo.
- [ ] Visor de auditoría (doc 01 §34, `audit_logs`) — la tabla y la RLS (solo supervisor/admin) ya
      existen desde la Fase 1 y se sigue llenando en cada aprobación/factura, pero no hay pantalla
      para leerla. Se puede consultar por SQL directo mientras tanto; es candidata a agregarse aquí
      mismo en `/reports` el día que se necesite de verdad.
- [ ] Gráficas de tendencia (ventas día a día dentro del mes, por ejemplo) — hoy son totales del
      período, no series de tiempo. `/reports` está estructurado para agregar esto sin rehacer nada.
- [ ] Notificaciones (doc 01 §57) — los números del reporte responden "¿cuánto pasó?", no avisan en
      el momento; ya estaba anotado igual en la Fase 10 y sigue siendo una capa aparte.

## Fase 12 (Migración) — infraestructura construida; el ETL en sí no se pudo construir

Distinta de todas las fases anteriores: no es una funcionalidad de la aplicación en curso, es un
proceso de datos de una sola vez, y doc 09 §1 es explícito en que tiene un bloqueo real antes de
poder empezar: **"el universo exacto debe definirse antes de la migración"** (¿~12.000 clientes de
Siigo/GHL o el catálogo de Apps Script de ~26.000?). Sin esa decisión, y sin archivos reales de
origen (export de Siigo, de GHL, el Sheet, el Apps Script) para saber su forma real, no hay ETL
que escribir con algo de confianza — sería el mismo problema que ya se evitó con Siigo/GHL
(código sin poder probar), pero peor: un error de dedupe aquí puede perder o duplicar en silencio
el historial real de un cliente, no solo devolver un 4xx.

Lo que sí se construyó — la infraestructura que doc 09 pide y que NO depende de esa decisión:

- [x] `migration_batches` (doc 09 §17-19): cada lote con sus conteos antes/después
      (creados/actualizados/omitidos/fallidos).
- [x] `customer_import_staging` (doc 09 §5-7): staging real — nunca se carga directo a
      `customers`. Trae los campos normalizados (documento, teléfono, email, nombre, ciudad) más
      el dato crudo (`raw_data jsonb`) para poder reprocesar sin volver a la fuente.
- [x] `customer_merge_candidates` (doc 09 §8): candidatos de fusión con motivo/confianza/estado,
      para que un humano confirme — nunca se fusiona solo.
- [x] `invoices.historical_invoice_number` / `historical_siigo_invoice_id` + estado
      `invoice_status = 'HISTORICAL'` (doc 09 §13: "no emitir, solo guardar referencia").
      Encontrado y respetado de paso: el pedido histórico asociado nunca puede quedar
      `INVOICED`/`INVOICING` — ya existía ese constraint desde la Fase 1
      (`orders_historical_never_invoices`, doc 04 §21); su estado final correcto es `DELIVERED`.
      Verificado con sesión simulada: intentar `INVOICED` en un pedido `HISTORICAL` sí falla con
      ese constraint, `DELIVERED` sí funciona.
- [x] `quote_status` ahora incluye `LEGACY_IMPORTED` (doc 09 §14: cotizaciones antiguas sin estado
      real conocido).

Verificado con sesión de admin simulada contra el proyecto real (rollback después): insertar un
lote, una fila de staging, un candidato de fusión, y una factura histórica — todo funciona y
respeta las relaciones/constraints existentes; una vendedora no puede leer ninguna de estas tablas
(solo admin, RLS verificado con sesión de vendedora en 0 filas).

Lo que falta, y por qué no se construyó ahora:

- [ ] El ETL real (`EXTRACT → NORMALIZE → DEDUPE → MAP → VALIDATE → IMPORT → RECONCILE`, doc 09
      §3) — necesita archivos reales de origen para saber su forma exacta. Escribir un parser
      contra un formato adivinado es exactamente el tipo de código sin poder probar que este
      proyecto ha evitado en cada fase donde fue posible.
- [ ] Pantalla de revisión de `customer_merge_candidates` / staging — mismo motivo: no tiene
      sentido diseñar la UI de revisión antes de saber qué tan sucios/ambiguos son los datos
      reales.
- [ ] Migración de productos (doc 09 §4), pedidos históricos (§12), prospectos (§15) — usan la
      misma `migration_batches` pero no tienen tabla de staging propia todavía; se agregan cuando
      haya claridad sobre el origen real de cada uno.
- [ ] `records_source`/`records_created`/etc. de `migration_batches` los llena quien corra el ETL
      real — hoy no hay ningún proceso que los escriba.

## Fase UI (doc 11) — rediseño aplicado a lo que ya existía

El doc 11 (`docs/11_UI_UX_CSS_RESPONSIVE.md`) mezcla dos cosas muy distintas:
rediseño de pantallas que ya existen, y funcionalidad nueva dibujada como si
fuera diseño. Se aplicó **solo la primera**; la segunda queda listada abajo
como lo que realmente es: trabajo de backend + UI, no de CSS.

Lo construido:

- [x] Design tokens del doc 11 §6 en `web/src/app/globals.css` como `@theme` de
      Tailwind v4 + clases de componente (`.btn`, `.card`, `.input`, `.badge`,
      `.table`). Decisión deliberada: **no** se copió el CSS suelto del
      documento — habrían quedado dos sistemas de estilos compitiendo con las
      utilidades de Tailwind que ya usaba toda la app (doc 11 §104).
- [x] **Bug real corregido de paso**: `globals.css` tenía un
      `@media (prefers-color-scheme: dark)` que pintaba el fondo casi negro
      mientras todos los componentes seguían diseñados en claro — por eso la
      app se veía con fondo negro y tarjetas blancas en cualquier equipo con
      el sistema en modo oscuro. Se eliminó; el doc 11 no pide modo oscuro.
- [x] AppShell (doc 11 §3/§4/§11/§14): sidebar fijo en desktop, drawer +
      barra inferior de 5 destinos + botón "+ Nuevo" en móvil, navegación
      filtrada por rol (`web/src/lib/ui/nav.ts`).
- [x] Grupo de rutas `(app)` con layout propio: el shell se monta una sola vez
      y la validación de "cuenta sin perfil / desactivada" pasó de vivir solo
      en la home a aplicar en todas las pantallas. Las URLs no cambiaron.
- [x] `StatusBadge` como fuente única de verdad de los 13 estados de pedido +
      cotización/cliente/factura (doc 11 §94/§95), con su significado y quién
      es el responsable. Antes cada pantalla repetía su propio mapa de estados
      con textos y colores distintos.
- [x] Home por rol (doc 11 §2): vendedora ve su día, bodega ve su cola con
      conteos (§36), supervisor/admin ven negocio + operación (§48).
- [x] Listas con tabla en desktop y tarjetas en móvil (§23/§24/§53), nunca
      scroll horizontal: clientes, pedidos, cotizaciones, productos, cola de
      bodega.
- [x] Ficha del cliente como expediente (§25/§99): métricas, ciclo de compra,
      contacto/fiscal, pedidos, cotizaciones, seguimientos y actividad.
- [x] Ficha fiscal dentro del pedido para bodega (§64) con indicador de qué
      falta antes de poder facturar.
- [x] Confirmación de facturación con los datos del pedido y la advertencia de
      documento fiscal (§43); resultado incierto como estado propio que dice
      "no vuelvas a facturar" (§44/§87).
- [x] Acciones contextuales desde el cliente (§49): "Crear pedido" / "Crear
      cotización" llegan con el cliente ya seleccionado (`?cliente=<id>`).
- [x] Aviso al operar sobre un cliente asignado a otra vendedora (§98).
- [x] Búsqueda en la URL (`?q=`) en vez de estado local: resultados
      compartibles y el botón atrás funciona.
- [x] Formato compartido (`web/src/lib/ui/format.ts`) — antes `formatMoney`
      estaba copiado en 14 archivos.

Verificación: `npm run build` limpio, y las pantallas se revisaron en
navegador real a 1440px y 390px con una ruta de previsualización temporal
(ya eliminada). **No se pudo verificar la app autenticada desde este entorno**:
el navegador del sandbox no tiene salida hacia `*.supabase.co` (mismo bloqueo
de red que Siigo/GHL), así que el login real solo se puede probar en el
despliegue de Vercel.

Del doc 11, deliberadamente NO construido (es funcionalidad nueva, no rediseño):

- [ ] Prospectos (§2.1, §3, §21, §22) — la tabla existe en BD desde la Fase 1
      pero no hay ni una línea de código de aplicación. El menú no lo muestra:
      un enlace a una pantalla inexistente es peor que un menú más corto.
- [ ] Despachos (§3, §36, §85) — los estados `READY_FOR_DISPATCH`/`DISPATCHED`/
      `DELIVERED` existen en el enum, pero no hay función ni pantalla que los
      mueva. El flujo construido termina en `INVOICED`.
- [ ] Comprobantes de pago con foto (§80/§81) — necesita bucket de Supabase
      Storage con sus políticas; ya estaba anotado como pendiente desde Fase 5.
- [ ] Impresión / PDF del pedido (§41) — nunca construido; el checklist de
      bodega tiene el punto "recibo impreso" pero no genera nada.
- [ ] Búsqueda global del topbar (§22) — requiere una consulta nueva sobre 4
      entidades.
- [ ] Notificaciones (🔔 del topbar, §13) — ya anotado desde Fase 10/11.
- [ ] Editar cliente/pedido/cotización (§49 "[Editar]") — ya anotado en las
      fases 2/4/5; hoy solo se crea y se cambia de estado.
- [ ] Pantallas de administración/configuración y centro de soporte (§76/§77).
- [ ] Métricas de UX (§90) — **antes de construirlo hay que resolver la
      tensión con §70** ("no convertir la plataforma en vigilancia"): el mismo
      documento pide medir tiempos por usuaria y a la vez advierte que los KPI
      no sean herramienta de castigo. Decidir si se miden agregados por
      pantalla (anónimos) o por vendedora, y quién los ve.
- [ ] Borradores locales / estado offline (§57/§58/§59).

Riesgo de rendimiento destapado por el rediseño (no es de UI):

- [ ] La búsqueda de clientes usa `ilike '%texto%'` sobre nombre, que **no usa
      índice**. Con 11 clientes de prueba vuela; con los 12.000–26.000 de la
      migración se va a arrastrar. Necesita un índice trigram (`pg_trgm`)
      antes de cargar el universo real.

## Datos de prueba cargados (no son datos reales)

Para poder ver el flujo completo funcionando antes de conectar Siigo/GHL se
cargaron datos ficticios en el proyecto real de Supabase. Todo es identificable
y borrable: los correos terminan en `@productoswow.test`, las facturas llevan
`siigo_invoice_id = 'SEED-…'` y número `FV-PRUEBA-…`.

- 4 usuarios de prueba (contraseña `WowPrueba2026*`):
  `karina.vendedora@` y `laura.vendedora@` (SELLER), `bodega@` (WAREHOUSE),
  `supervisor@` (SUPERVISOR), todos `@productoswow.test`.
- 15 productos Olaplex con inventario variado (agotados, bajos y normales).
- 11 clientes repartidos entre las dos vendedoras.
- 13 pedidos cubriendo el flujo completo: borrador, en cola de bodega,
  devuelto a vendedora, aprobado para facturar y facturados con fechas
  espaciadas (para que el ciclo de compra y "cliente fuera de ciclo" tengan
  datos reales que calcular).
- 5 cotizaciones (enviadas, una aceptada, una perdida con motivo).
- 4 seguimientos, tres de ellos vencidos.

**Antes de operar de verdad hay que borrar todo esto.** Los pedidos y facturas
de prueba se pueden identificar por `orders.notes like 'SEED:%'` y por las
facturas `FV-PRUEBA-…`.

## Fase A-C (campos fiscales del formulario legado) — construido y probado

Traer al producto los campos y pestañas que el formulario legado de "WOW · Pedidos B2B" capturaba
y que aquí no existían en pantalla. Migraciones `0015`, `0016`, `0017`; interfaz en esta tanda.

Construido y verificado:

- [x] Catálogo DANE (`dane_locations`, ~140 ciudades) con selectores departamento → ciudad. Sin
      `state_code`/`city_code` Siigo no emite la factura, y antes no había forma de llenarlos.
- [x] Ficha fiscal completa del cliente en 4 secciones: identificación (con DV), ubicación DANE,
      contacto (incluida la persona de contacto del salón), y clasificación fiscal/comercial.
- [x] Dígito de verificación del NIT calculado con el algoritmo DIAN, editable a mano (decisión
      del usuario: "automático con opción de cambiarlo manual"). Verificado contra tres NIT reales
      conocidos (900123456-8, 830053105-3, 811021438-4).
- [x] Pedido: toggle B2B/B2C, lista de precio que re-tarifa las líneas ya cargadas, medio de pago
      (solo visible en contado, que es cuando ya entró la plata), origen de la venta. En B2C el
      precio pasa a público, la retención se oculta y solo queda contado (doc `GUIA_B2C`).
- [x] Cotización: misma lista de precio, retención con las tasas verificadas contra Siigo, forma
      de pago propuesta y "válida hasta" (el parámetro `p_valid_until` existía desde la Fase 4 y
      ninguna pantalla lo llenaba).
- [x] Todo lo capturado se muestra: ficha del cliente con códigos DANE, contacto y clasificación;
      detalle de pedido y de cotización con las condiciones comerciales.
- [x] Aritmética re-verificada con sesión JWT real de vendedora: pedido y cotización sobre el mismo
      caso (4 × 100.000, 10% desc., IVA 19%, retención 2.5%) dan idéntico —
      400.000 − 40.000 = 360.000 neto, IVA 68.400, retención 9.000, total **419.400**, el mismo
      número verificado en la Fase 5.

Bug real encontrado y corregido de paso:

- `formatDate()` mostraba **un día menos** en toda columna `date` (`birthday`, `valid_until`).
  Postgres las entrega como `"1990-05-14"` y JavaScript las lee como medianoche UTC; en Colombia
  (UTC-5) eso se renderiza como el 13. Ahora las fechas sin hora se arman como fecha local. Las
  marcas de tiempo (`timestamptz`) no cambian.

Decidido a propósito, no es un olvido:

- [ ] `orders.document_type` se dejó **sin selector**. El "tipo de documento" del formulario legado
      elegía entre factura y cotización, y eso aquí ya lo resuelve que la cotización sea una entidad
      propia (decisión del usuario, punto 1). La columna y el parámetro existen; qué valores admite
      de verdad depende del catálogo de documentos de Siigo, que sigue sin confirmarse.
- [ ] No hay cliente ficticio de mostrador (decisión del usuario, punto 2): un B2C se registra como
      persona natural con la misma lógica que cualquier otro cliente.
- [ ] Cambiar de lista de precio pisa los precios editados a mano. Está avisado en pantalla; si
      molesta en uso real, la alternativa es respetar las líneas tocadas a mano y solo re-tarifar
      las demás.
- [ ] Las listas de `src/lib/ui/fiscal.ts` (responsabilidad fiscal, tipo de negocio, medios de pago,
      orígenes de venta) son las que se dedujeron del formulario legado y del catálogo DIAN.
      Conviene confirmarlas con Productos WOW antes de cargar clientes reales — después, cambiar un
      valor implica migrar los que ya se guardaron.

Sigue pendiente del plan acordado (fases D a G, en ese orden):

- [x] **D** — comprobantes de pago. Ver la sección propia más abajo.
- [x] **E** — impresión/PDF. Ver la sección propia más abajo.
- [x] **F** — visitas a prospectos. Ver la sección propia más abajo.
- [x] **G** — editar el pedido. Ver la sección propia más abajo.

## Fase D (comprobantes de pago) — construido y probado

La tabla `attachments` y el tope de 3 por pedido existen desde la Fase 1; lo que faltaba era dónde
viven los archivos, quién puede verlos y la pantalla. Migración `0018_receipts_storage.sql`.

- [x] Bucket privado `receipts` (10 MB, imágenes + PDF). Nunca hay URL pública: un comprobante
      lleva datos bancarios del cliente, así que solo se sirve por URL firmada de una hora, y solo
      a quien la RLS deja leer la fila.
- [x] Ruta `orders/<order_id>/<uuid>.<ext>`. El pedido va **en la ruta** a propósito: así la
      política de storage decide reusando la RLS que ya gobierna `orders`, sin una tabla de
      permisos aparte. Una vendedora solo puede subir a sus pedidos; bodega y supervisión, a
      todos.
- [x] `register_order_receipt()` valida MIME, tamaño y que la ruta corresponda al pedido
      (doc 05 §12); el tope de 3 lo sigue aplicando el trigger de la Fase 1.
- [x] Borrar: solo la vendedora dueña mientras el pedido está en `DRAFT`/`RETURNED_TO_SELLER`, o
      supervisión. Un comprobante ya revisado por bodega es la prueba de que el pago entró.
- [x] El archivo sube **directo del navegador al bucket**, no a través del servidor de Next: una
      foto de celular supera con facilidad el límite de tamaño de una server action.
- [x] Siempre opcional (decisión del usuario, punto 3): la tarjeta lo dice con una etiqueta y
      nada bloquea el pedido por no tener comprobantes.
- [x] Probado con sesiones JWT reales (vendedora, bodega, supervisión): 11 casos sobre las
      funciones (tope de 3, MIME prohibido, 11 MB, ruta de otro pedido, pedido ajeno, borrado
      permitido y negado, bodega ve pero no borra, supervisión sí borra) y 6 sobre las políticas
      del bucket (sube al propio pedido, no al ajeno, rechaza rutas fuera de convención y un id
      malformado sin reventar, bodega lee, sesión sin usuario WOW no ve nada).

Hueco de RLS encontrado y corregido de paso:

- `attachments` tenía select e insert desde la Fase 1 pero **no tenía política de DELETE**. Es el
  mismo patrón que ya mordió dos veces en este proyecto: sin política, el DELETE no da error —
  simplemente no afecta ninguna fila. Agregada `attachments_delete` con las mismas reglas que el
  objeto en storage, para que no se puedan desincronizar.

No verificado desde aquí (la red del entorno no alcanza Supabase):

- [ ] La subida real desde el navegador. La lógica de política sí se ejercitó por SQL, pero el
      camino `upload()` → `register_order_receipt()` → refresco de pantalla no se pudo correr
      contra el servicio de Storage.
- [ ] La política de DELETE sobre `storage.objects`: Supabase bloquea los `delete` directos por
      SQL (trigger `storage.protect_delete`), así que solo se puede ejercitar a través de la API
      de Storage, que es justo lo que no alcanzo desde aquí. La política está escrita con las
      mismas condiciones que `attachments_delete`, que sí quedó probada.
- [ ] Archivos huérfanos: si el registro falla después de subir, la aplicación retira el archivo
      del bucket. Si ese retiro también falla (o se cierra el navegador en medio), queda un
      archivo invisible ocupando espacio. Sin barrido automático por ahora; conviene revisar el
      bucket de vez en cuando cuando haya volumen real.

## Fase E (impresión y PDF) — construido y verificado visualmente

doc 01 §17 conserva el proceso físico (imprimir → verificar → aprobar → facturar) y doc 11 §41
exige que imprimir esté visualmente lejos de "Facturar en Siigo", porque imprimir no tiene efecto
fiscal.

- [x] `/orders/[id]/imprimir` — recibo del pedido con encabezado de empresa, cliente, condiciones
      comerciales, tabla de productos, totales, notas y dos líneas de firma ("Revisado por" /
      "Recibido por") para la verificación física en bodega.
- [x] `/quotes/[id]/imprimir` — cotización para el cliente, con "válida hasta" destacado arriba,
      que es lo primero que se pregunta al recibir una.
- [x] Ambas viven en un grupo de rutas `(print)` **fuera del AppShell**: una hoja con barra
      lateral y navegación inferior impresa encima no sirve. El control de acceso es el mismo que
      el del resto de la aplicación — que sea imprimible no la hace pública.
- [x] Cada hoja dice explícitamente que **no es una factura y no tiene efecto fiscal**. Sin eso,
      un recibo impreso se puede confundir con la factura, que es justo lo que doc 11 §41 quiere
      evitar.
- [x] Los botones "Imprimir" están en el encabezado de la pantalla, y "Facturar en Siigo" sigue
      al final de la página: quedan en extremos opuestos.
- [x] Estilos `@media print` en `globals.css`: A4 con márgenes, oculta todo lo que no es el
      documento, y evita que una fila de producto o el bloque de totales se parta entre dos
      páginas.
- [x] Verificado de verdad con un navegador: se renderizó la hoja con `emulateMedia('print')`,
      se comprobó que **cero** elementos `.print-hide` quedan visibles al imprimir, y se generó
      el PDF A4 resultante. Ambas vistas (pantalla y papel) se revisaron en imagen.

Bug real encontrado y corregido de paso:

- La fecha del recibo salía **sin año** (`formatDateTime` lo omite a propósito, porque en una
  lista de actividad reciente sería ruido). En papel eso significa que un recibo del año pasado se
  ve idéntico a uno de hoy. Se agregó `formatDateTimeLong()` para documentos que se archivan.

Decidido a propósito:

- [ ] El **PDF sale del propio diálogo de impresión** ("Guardar como PDF"), que existe en todos
      los navegadores de escritorio y móviles; la pantalla lo dice explícitamente porque no es
      obvio. No se generó PDF en el servidor: eso exigiría un renderizador headless en Vercel,
      mucho peso y otra dependencia, para un documento interno que de todos modos se imprime.
- [ ] Los datos de la empresa (NIT, dirección, teléfono) se leen de `app_settings.company_profile`,
      **que todavía no está configurada**. Mientras tanto la hoja imprime solo "Productos WOW", que
      es honesto: mejor una hoja sin NIT que una con un NIT inventado. Configurar esa clave es
      parte de los pendientes de `app_settings` que ya estaban anotados arriba.
- [ ] No se pudo renderizar contra datos reales: la política de red del entorno bloquea
      `*.supabase.co`. La verificación visual se hizo con un banco de pruebas de datos fijos que
      usaba el mismo marcado y los mismos estilos, y luego se eliminó.

## Fase F (prospectos y visitas) — construido y probado

doc 01 §12 define el embudo del prospecto (NUEVO → CONTACTADO → INTERESADO → COTIZACIÓN →
NEGOCIACIÓN → GANADO, o PERDIDO con motivo). La tabla `prospects` existía desde la Fase 1 sin
ninguna pantalla. Migración `0019_prospect_visits.sql`.

- [x] `/prospects` — lista de abiertos **ordenada por el próximo seguimiento**, con los vencidos
      marcados en rojo: lo primero que necesita saber una vendedora al abrir la pantalla es a
      quién le toca hoy. Pestaña aparte para ganados y perdidos.
- [x] `/prospects/new` — alta sin datos fiscales. Un prospecto todavía no factura; pedirle NIT y
      códigos DANE sería pedir lo que nadie tiene en una visita en frío.
- [x] `/prospects/[id]` — ficha con historial de visitas, panel para registrar visita (tipo de
      contacto, qué pasó, etapa resultante y próximo seguimiento), marcar como perdido con motivo,
      y convertir en cliente.
- [x] Convertir lleva a `/customers/new?prospecto=<id>` con los datos que ya se conocen; al
      guardar, el prospecto queda cerrado como GANADO y enlazado al cliente. La ciudad del
      prospecto es texto libre: solo se preselecciona si coincide con una del catálogo DANE — es
      preferible dejarla vacía a guardar una ciudad sin código con la que después no se puede
      facturar.
- [x] "Prospectos" entra al menú y "Nuevo prospecto" a las acciones rápidas (doc 11 §21). Hasta
      ahora estaban excluidos porque la pantalla no existía.
- [x] Probado con sesiones JWT reales: 15 casos (crear, visita con y sin avance de etapa, el
      historial guarda el cambio real, no se puede cerrar por la vía de una visita, perder sin
      motivo se rechaza, convertir, convertir dos veces, visitar un cerrado, aislamiento entre
      vendedoras en prospectos y en el historial, y supervisión que sí ve).

Dos decisiones de modelo que vale la pena registrar:

- **`prospects` no tiene política de UPDATE, y se dejó así.** Es el mismo hueco que ya mordió en
  `quotes` (Fase 4) y en `attachments` (Fase D): sin política, el UPDATE no da error, simplemente
  no afecta ninguna fila. En vez de abrir el UPDATE al cliente, todo cambio de etapa va como
  función `security definer` que revalida dueño y estado — que es la regla del doc 03 §9.
- **Se agregó la tabla `prospect_visits`, que no está en doc 02 §7.** `prospects` solo guarda
  `first_visit_at` / `last_visit_at`, es decir un resumen. Registrar una visita contra ese modelo
  pisaría la anterior y no dejaría rastro de qué se habló ni de quién fue, que es justamente lo
  que se pidió construir. Conviene reflejarlo en doc 02 cuando se actualice.

Bug real encontrado y corregido antes de aplicar:

- `register_prospect_visit` hacía el UPDATE antes de insertar la fila del historial, así que
  `stage_before` habría quedado con la etapa **nueva** y el historial diría que nunca hubo un
  cambio de etapa. Se captura la etapa anterior antes del update.

Decidido a propósito:

- [ ] Convertir un prospecto **no crea el cliente**: crear un cliente exige la ficha fiscal
      completa (DANE, responsabilidad fiscal) y eso ya lo resuelve `create_customer`. La función
      solo enlaza y cierra.
- [ ] La lista de motivos de pérdida vive en `src/lib/ui/prospects.ts`. doc 01 §12 dice que debe
      ser configurable; por ahora es código, igual que el resto de catálogos.
- [ ] Se sembraron 5 prospectos de prueba (con historial de visitas) marcados `SEED:` en las
      notas, como el resto de datos de prueba. Hay que borrarlos antes de operar de verdad.

## Fase G (editar pedido) — construido y probado

Migración `0020_edit_order.sql`. Dos cosas, y la segunda era un hueco real del flujo.

- [x] `update_order()` reemplaza líneas y condiciones y **recalcula los totales con la misma
      aritmética de `create_order`**. Va `security definer` porque `orders` no tiene política de
      UPDATE — todas las transiciones pasan por funciones (doc 03 §9).
- [x] Pantalla `/orders/[id]/editar` y botón "Editar" en el detalle, junto a "Imprimir" y lejos de
      "Facturar en Siigo" (doc 11 §49).
- [x] El formulario de pedido se extrajo a `src/components/order-form.tsx` y lo comparten alta y
      edición. Si fueran dos pantallas separadas, cada regla nueva (una lista de precio, un medio
      de pago) habría que recordarla en las dos y tarde o temprano se separarían.
- [x] Probado con sesiones JWT reales: totales recalculados a mano (350.000 − 30.000 = 320.000
      neto, IVA 60.800, total 380.800), edición bloqueada en IN_REVIEW sin corromper las líneas,
      pedido sin productos rechazado, y otra vendedora rechazada.

**El hueco que apareció: un pedido devuelto no se podía reenviar.** `submit_order` solo aceptaba
`DRAFT`, así que bodega devolvía un pedido para corrección y la vendedora ya no tenía forma de
mandarlo de vuelta — quedaba atascado en `RETURNED_TO_SELLER` para siempre. Sin arreglar eso,
poder editarlo no servía de nada. Ahora acepta `DRAFT` y `RETURNED_TO_SELLER`, y el panel de
acciones muestra "Reenviar a bodega". Ciclo completo verificado en la bitácora de estados:
`DRAFT → SUBMITTED → IN_REVIEW → RETURNED_TO_SELLER → SUBMITTED`.

Ampliación sobre lo que se había acordado, a propósito:

- El plan decía "editar en `DRAFT` o `RETURNED_TO_SELLER`", pero **doc 04 §8 también permite
  `SUBMITTED` y `PENDING_REVIEW`**, y tiene razón: en esos dos estados el pedido solo está en la
  cola y nadie lo ha abierto, así que una vendedora que ve un error justo después de enviarlo
  debería poder corregirlo sin cancelar y rehacer. La frontera real es `IN_REVIEW`, donde bodega
  ya lo tiene en la mano verificando contra el físico. Se implementó el conjunto del documento.
- La carrera "la vendedora edita mientras bodega abre el pedido" es segura: `start_order_review`
  lo pasa a `IN_REVIEW` y el guardado posterior se rechaza con un mensaje claro, sin tocar las
  líneas. Verificado.

Decidido a propósito:

- [ ] **El cliente no se cambia al editar**: un pedido para otro cliente es otro pedido, no una
      edición de este. Si se necesitara, hay que decidir antes qué pasa con el responsable
      comercial y con la oportunidad ya creada en GHL.
- [ ] Editar **no re-sincroniza GHL**. La oportunidad se creó al crear el pedido con los totales
      de ese momento; después de una edición quedan desfasados. Hay que decidir si `update_order`
      debe disparar la sincronización, junto con el resto de pendientes de GHL.
- [ ] `EDITABLE_ORDER_STATUSES` (en `src/lib/ui/status.ts`) duplica en TypeScript la condición que
      aplica la función. Es a propósito — la pantalla no debe ofrecer un formulario que el servidor
      va a rechazar — pero si una cambia hay que cambiar la otra.
- [ ] Editar cotización en borrador sigue pendiente (ya estaba anotado en la Fase 4).

## Decisiones técnicas tomadas que vale la pena recordar (no son pendientes, son contexto)

- `docs/SQL_MODELO_DE_DATOS_SUPABASE.sql` es el estado actual completo del esquema (se edita in
  place). `web/supabase/migrations/000N_*.sql` es el historial incremental real — para un proyecto
  Supabase nuevo desde cero, se aplican en orden (0001, 0002, 0003, ...) y llegan al mismo estado
  que describe el archivo de docs.
- Patrón aprendido varias veces ya: `revoke ... from anon` (o `from public`) por separado no basta
  para bloquear una función — Postgres otorga `EXECUTE` a `PUBLIC` **y por separado** a
  `anon`/`authenticated`/`service_role` al crearla. Hay que revocar de ambos explícitamente.
  Verificar siempre contra `information_schema.routine_privileges`, no confiar en la respuesta
  cacheada del advisor.
- Toda operación de negocio no trivial (crear cliente, cotizar, crear pedido, y las que vengan:
  aprobar, facturar) va como función de Postgres nombrada, nunca como INSERTs sueltos desde el
  cliente — doc 03 §9, "commands vs updates". Las que solo insertan van `security invoker`
  (respetan RLS de verdad); las que cambian de estado sobre una tabla sin política de UPDATE van
  `security definer` y revalidan rol + estado ellas mismas.
- Regla dura que ya mordió dos veces (Fase 4 con `quotes`, sería fácil que vuelva a pasar en Fase
  6+): si una función necesita "insertar y después corregir con un UPDATE" sobre una tabla con RLS
  sin política de UPDATE, el UPDATE no da error — silenciosamente no afecta ninguna fila. Rediseñar
  para calcular todo antes del único INSERT, nunca insertar y corregir después.
- Toda prueba de una función que use `current_wow_role()`/`current_wow_user_id()`/`auth.uid()`
  debe simular una sesión JWT real (`set local request.jwt.claims = '{"sub":"..."}'; set local
  role authenticated;`) — correr como superusuario esconde bugs de estos que solo aparecen con una
  sesión de verdad detrás (ver el bug de `changed_by` arriba).
