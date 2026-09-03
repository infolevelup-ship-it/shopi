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

## Decisiones técnicas tomadas que vale la pena recordar (no son pendientes, son contexto)

- `docs/SQL_MODELO_DE_DATOS_SUPABASE.sql` es el estado actual completo del esquema (se edita in
  place). `web/supabase/migrations/000N_*.sql` es el historial incremental real — para un proyecto
  Supabase nuevo desde cero, se aplican en orden (0001, 0002, 0003, ...) y llegan al mismo estado
  que describe el archivo de docs.
- Patrón aprendido dos veces: `revoke ... from anon` no basta para bloquear una función — Postgres
  otorga `EXECUTE` a `PUBLIC` automáticamente al crearla, y `PUBLIC` aplica a todos los roles sin
  excepción. Hay que revocar de `PUBLIC` directamente. Verificar siempre contra
  `information_schema.routine_privileges`, no confiar en la respuesta cacheada del advisor.
- Toda operación de negocio no trivial (crear cliente, y las que vengan: cotizar, aprobar, facturar)
  va como función de Postgres nombrada (`security invoker`, respeta RLS), nunca como INSERTs sueltos
  desde el cliente — doc 03 §9, "commands vs updates".
