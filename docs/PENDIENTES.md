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

## Migración (fase 11-12, sin empezar)

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

- [ ] Editar pedido existente (hoy solo crear, enviar a revisión o cancelar — no editar líneas
      después de creado, doc 04 §8 lo permite en DRAFT/SUBMITTED/RETURNED_TO_SELLER).
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
