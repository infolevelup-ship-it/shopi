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
