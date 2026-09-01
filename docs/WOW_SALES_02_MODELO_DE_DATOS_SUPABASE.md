# WOW SALES — Modelo de Datos (Supabase / PostgreSQL)
## Versión 1.0 — Deriva directamente de `WOW_SALES_01_DOCUMENTO_MAESTRO_VERDAD_Y_LOGICA.md`

> Ninguna tabla, campo o regla de este documento contradice el documento maestro. Donde el maestro
> deja una decisión abierta (§68), aquí se toma una decisión concreta marcada como
> `[DECISIÓN V1 — revisar]` para no bloquear la construcción; son las únicas que deben
> confirmarse contra la API real de Siigo antes de producción.

---

# 0. Convenciones generales

- **PK:** `id uuid primary key default gen_random_uuid()` en todas las tablas, salvo `users`
  (usa el mismo `id` que `auth.users`, es decir `auth.uid()`).
- **Timestamps:** `created_at timestamptz not null default now()`. Donde aplique, `updated_at`
  mantenido por trigger (`set_updated_at()`), nunca por el cliente.
- **Soft delete (§47):** en vez de `DELETE`, columna `deleted_at timestamptz`. Las consultas de
  aplicación filtran `deleted_at is null`. Nunca aplica a `invoices`, `invoice_operations`,
  `audit_logs`, `order_status_history` (esas no se borran, punto).
- **Snapshot histórico (§42, §43):** las tablas `*_items` guardan copia de nombre/código/precio en
  el momento de la operación; nunca hacen `JOIN` a `products` para mostrar el precio vendido.
- **Identificadores externos, nunca nombres (§40):** toda relación con Siigo/GHL se guarda como
  columna `siigo_*_id` / `ghl_*_id`, tipada como `text` (los IDs de Siigo son numéricos pero se
  guardan como texto para no arrastrar supuestos de formato).
- **Metadonía de sincronización (§3, regla de la sección):** toda tabla con datos copiados de un
  sistema externo lleva como mínimo:
  ```
  <sistema>_id            text
  <sistema>_synced_at     timestamptz
  ```
  Nunca se sobreescribe el dato local sin dejar rastro de cuándo se sincronizó.
- **Dinero:** `numeric(14,2)` en todos los montos. Nunca `float`/`double`.
- **Enums:** tipos `enum` de Postgres. Se listan todos en la sección 1.
- **Rol activo:** se resuelve con `auth.uid()` contra `public.users.role`, nunca se confía en un
  claim del JWT que el cliente pueda influir sin pasar por el backend.

---

# 1. Enums

```sql
create type user_role as enum ('vendedora','bodega','supervisor','admin');

create type customer_status as enum ('prospecto','activo','inactivo','recuperacion');

create type person_type as enum ('natural','juridica');

create type prospect_status as enum (
  'prospecto','contactado','interesado','cotizacion','negociacion','ganado','perdido'
);

create type quote_status as enum (
  'borrador','enviada','en_seguimiento','aceptada','convertida','perdida','expirada','cancelada'
);

create type order_status as enum (
  'borrador','enviado','pendiente_revision','revision','aprobado_facturar',
  'facturando','facturado','despachado','entregado',
  'devuelto_vendedora','cancelado','error_facturacion','bloqueado'
);

-- separado de order_status a propósito (§15): nunca mezclar operación comercial con estado fiscal
create type invoice_status as enum ('pendiente','procesando','facturada','error');

create type invoice_operation_status as enum (
  'pendiente','procesando','confirmada',
  'error_reintentable','error_no_reintentable','resultado_incierto'
);

create type activity_type as enum (
  'llamada','whatsapp','correo','visita','cotizacion','pedido','factura','despacho','nota','seguimiento'
);

create type source_type as enum ('live','historical','imported');

create type follow_up_status as enum ('pendiente','completado','vencido','cancelado');

create type identification_type as enum ('CC','NIT','CE','PAS','TI','RC');

create type integration_system as enum ('siigo','ghl');

create type integration_direction as enum ('outbound','inbound');
```

---

# 2. Tablas

## 2.1 `users`

Extiende `auth.users` (Supabase Auth es la fuente de identidad; esta tabla guarda el perfil/rol).

```sql
create table users (
  id uuid primary key references auth.users(id) on delete restrict,
  full_name text not null,
  email text not null,
  role user_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- Un usuario desactivado (`active = false`) no debe poder autenticarse contra ninguna acción de
  negocio aunque su sesión de Supabase Auth siga viva — se valida en cada request de backend.

## 2.2 `customers`

```sql
create table customers (
  id uuid primary key default gen_random_uuid(),

  person_type person_type not null,
  identification_type identification_type not null,
  identification text not null,              -- normalizado: solo dígitos, sin puntos/guiones
  identification_raw text not null,           -- tal como lo escribió la vendedora, para auditar normalización

  business_name text,                         -- persona jurídica
  first_name text,                            -- persona natural
  last_name text,                             -- persona natural
  display_name text not null,                 -- calculado: razón social o "nombre apellido"

  phone text,
  email text,
  address text,
  city text,
  fiscal_responsibility text,                 -- catálogo Siigo (§68.6/.7 pendiente de confirmar)

  status customer_status not null default 'prospecto',

  siigo_customer_id text,
  siigo_synced_at timestamptz,

  ghl_contact_id text,
  ghl_synced_at timestamptz,

  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Dedup real (§7): mismo tipo+número de identificación no puede existir dos veces entre vivos
create unique index customers_identification_uniq
  on customers (identification_type, identification)
  where deleted_at is null;

create index customers_phone_idx on customers (phone) where deleted_at is null;
create index customers_email_idx on customers (lower(email)) where deleted_at is null;
create index customers_display_name_trgm on customers using gin (display_name gin_trgm_ops);
create index customers_siigo_id_idx on customers (siigo_customer_id);
```

`[DECISIÓN V1 — revisar]` Normalización de `identification`: se guarda solo dígitos (sin DV,
sin puntos). El dígito de verificación de NIT se recalcula al enviar a Siigo, no se usa como parte
de la igualdad de deduplicación (evita que `901234567` y `901234567-0` se traten como clientes
distintos, tal como exige §7).

## 2.3 `customer_assignments`

Historial de responsable comercial (§5). Nunca se hace `UPDATE` sobre la fila activa: se cierra
la anterior y se inserta una nueva, para conservar quién tuvo la cartera y cuándo.

```sql
create table customer_assignments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  user_id uuid not null references users(id),      -- responsable_comercial
  active boolean not null default true,
  assigned_by uuid not null references users(id),
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  reason text                                       -- motivo de reasignación
);

-- Solo puede existir un responsable activo por cliente
create unique index customer_assignments_active_uniq
  on customer_assignments (customer_id)
  where active;
```

## 2.4 `customer_activities`

Línea de tiempo del cliente (§27).

```sql
create table customer_activities (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  type activity_type not null,
  related_entity_type text,                         -- 'order' | 'quote' | null
  related_entity_id uuid,
  description text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index customer_activities_customer_idx on customer_activities (customer_id, created_at desc);
```

## 2.5 `prospects`

```sql
create table prospects (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  status prospect_status not null default 'prospecto',
  assigned_to uuid references users(id),
  lost_reason text,                                 -- catálogo configurable, ver `settings`
  lost_at timestamptz,
  converted_customer_id uuid references customers(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 2.6 `products`

```sql
create table products (
  id uuid primary key default gen_random_uuid(),
  siigo_product_id text not null,
  code text not null,
  name text not null,
  description text,
  price numeric(14,2) not null,
  active boolean not null default true,

  stock_cache integer,                              -- solo referencial, nunca decide aprobación (§10)
  stock_updated_at timestamptz,

  siigo_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index products_siigo_id_uniq on products (siigo_product_id);
create unique index products_code_uniq on products (code);
create index products_name_trgm on products using gin (name gin_trgm_ops);
```

## 2.7 `quotes` / `quote_items`

```sql
create table quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique,                -- consecutivo WOW-C-0000874
  customer_id uuid not null references customers(id),
  created_by uuid not null references users(id),
  status quote_status not null default 'borrador',

  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,

  lost_reason text,
  converted_order_id uuid references orders(id) deferrable initially deferred,

  created_at timestamptz not null default now(),
  sent_at timestamptz,
  follow_up_at timestamptz,
  accepted_at timestamptz,
  lost_at timestamptz,
  expired_at timestamptz,
  cancelled_at timestamptz
);

create table quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  product_id uuid references products(id),
  product_code_snapshot text not null,
  product_name_snapshot text not null,
  unit_price numeric(14,2) not null,
  quantity numeric(12,2) not null,
  discount numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  subtotal numeric(14,2) not null
);

create index quotes_customer_idx on quotes (customer_id);
create index quote_items_quote_idx on quote_items (quote_id);
```

## 2.8 `orders` / `order_items`

Núcleo del sistema. `order_status` e `invoice_status` van **separados** (§15), nunca se infiere
uno del otro.

```sql
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,                -- consecutivo WOW-P-0001548

  customer_id uuid not null references customers(id),
  salesperson_id uuid not null references users(id),   -- vendedora de la operación (§5)
  responsible_id uuid not null references users(id),   -- responsable comercial al momento del pedido (snapshot)
  quote_id uuid references quotes(id),

  source_type source_type not null default 'live',     -- §25: histórico NUNCA dispara facturación
  order_status order_status not null default 'borrador',
  invoice_status invoice_status not null default 'pendiente',

  payment_method text,
  payment_reference text,

  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  retention_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,

  notes text,
  historical_invoice_number text,                       -- solo para source_type = historical/imported

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  invoiced_at timestamptz,
  dispatched_at timestamptz,
  delivered_at timestamptz,

  cancelled_at timestamptz,
  cancelled_by uuid references users(id),
  cancellation_reason text,

  returned_to_salesperson_at timestamptz,
  returned_reason text,
  returned_by uuid references users(id)
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id),
  product_code_snapshot text not null,
  product_name_snapshot text not null,
  unit_price numeric(14,2) not null,
  quantity numeric(12,2) not null,
  discount numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  retention numeric(14,2) not null default 0,
  subtotal numeric(14,2) not null
);

create index orders_customer_idx on orders (customer_id);
create index orders_salesperson_idx on orders (salesperson_id);
create index orders_status_idx on orders (order_status);
create index orders_invoice_status_idx on orders (invoice_status);
create index order_items_order_idx on order_items (order_id);

-- §26: cambiar de etapa nunca es suficiente para facturar. Regla dura en base de datos:
-- solo se puede entrar a 'facturando' si source_type = 'live'.
alter table orders add constraint orders_historical_never_invoices
  check (not (source_type <> 'live' and order_status in ('facturando','facturado')));
```

## 2.9 `order_status_history`

```sql
create table order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  from_status order_status,
  to_status order_status not null,
  changed_by uuid not null references users(id),
  changed_at timestamptz not null default now(),
  reason text
);

create index order_status_history_order_idx on order_status_history (order_id, changed_at);
```

Se llena por trigger (`log_order_status_change()`), nunca por el cliente directamente — así el
historial es imposible de falsear u olvidar (necesario para §33, tiempos de eficiencia).

## 2.10 `order_reviews`

Checklist formal de bodega (§16).

```sql
create table order_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  reviewed_by uuid not null references users(id),
  checklist jsonb not null,          -- { cliente_correcto, productos_correctos, cantidades_correctas,
                                      --   precios_correctos, inventario_disponible, forma_pago_correcta,
                                      --   comprobante_verificado, datos_fiscales_correctos }
  approved boolean not null default false,
  notes text,
  reviewed_at timestamptz not null default now()
);

create index order_reviews_order_idx on order_reviews (order_id);
```

## 2.11 `invoice_operations` — idempotencia (§20-23)

Esta tabla, no `invoices`, es la que protege contra doble clic/timeout/reintento. Se crea
**antes** de llamar a Siigo, nunca después.

```sql
create table invoice_operations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  idempotency_key text not null,           -- p.ej. 'WOW-ORDER-<order_number>'
  status invoice_operation_status not null default 'pendiente',
  attempt_number integer not null default 1,

  requested_by uuid not null references users(id),  -- siempre rol bodega/admin (validado en backend, §18)
  requested_at timestamptz not null default now(),

  siigo_request_payload jsonb,
  siigo_response jsonb,
  error_message text,

  resolved_at timestamptz
);

-- Núcleo de la idempotencia: la misma clave nunca puede tener dos operaciones "vivas" a la vez.
create unique index invoice_operations_active_key_uniq
  on invoice_operations (idempotency_key)
  where status in ('pendiente','procesando');

create index invoice_operations_order_idx on invoice_operations (order_id, requested_at desc);
```

Flujo (§21-23): un timeout deja la operación en `resultado_incierto`, nunca se reintenta creando
otra automáticamente — un proceso de reconciliación (backend, contra la API de Siigo) decide si
pasa a `confirmada` o a `error_reintentable`.

## 2.12 `invoices`

```sql
create table invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  invoice_operation_id uuid not null references invoice_operations(id),

  siigo_invoice_id text not null,
  invoice_number text not null,             -- p.ej. FV-4-36756
  siigo_document_id text not null,          -- 34963, etc.
  status text not null default 'activa',    -- 'activa' | 'anulada' (nunca se borra la fila, §24)

  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

-- §51: 1 pedido → máximo 1 factura activa. Nunca "muchas facturas accidentales".
create unique index invoices_order_uniq on invoices (order_id);
create unique index invoices_siigo_invoice_id_uniq on invoices (siigo_invoice_id);
```

`[DECISIÓN V1 — revisar]` Correcciones fiscales (notas crédito/débito) no entran en V1: la regla
de negocio (§51) exige que si aparecen, tengan **entidad propia** (`credit_notes`, futura), nunca
reemplazar o borrar la fila de `invoices` original.

## 2.13 `shipments`

```sql
create table shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  dispatched_by uuid not null references users(id),
  dispatched_at timestamptz not null default now(),
  tracking_info text,
  notes text
);
```

## 2.14 `follow_ups`

```sql
create table follow_ups (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  assigned_to uuid not null references users(id),
  due_date date not null,
  status follow_up_status not null default 'pendiente',
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index follow_ups_assigned_idx on follow_ups (assigned_to, due_date) where status = 'pendiente';
```

## 2.15 `attachments`

Comprobantes de pago y similares, en Supabase Storage; esta tabla es el índice.

```sql
create table attachments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,          -- 'order' | 'customer' | ...
  entity_id uuid not null,
  storage_path text not null,         -- bucket + path en Supabase Storage
  file_type text,
  uploaded_by uuid not null references users(id),
  uploaded_at timestamptz not null default now()
);

create index attachments_entity_idx on attachments (entity_type, entity_id);
```

## 2.16 `payments`

```sql
create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  method text not null,
  amount numeric(14,2) not null,
  reference text,
  attachment_id uuid references attachments(id),
  verified boolean not null default false,
  verified_by uuid references users(id),
  verified_at timestamptz
);

create index payments_order_idx on payments (order_id);
```

## 2.17 `audit_logs` (§34, §48)

Genérica, para cualquier entidad. No editable ni borrable por usuarios normales (solo RLS de
`service_role`/backend puede insertar).

```sql
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users(id),
  actor_role user_role,
  action text not null,               -- 'APROBÓ_PEDIDO', 'INICIÓ_FACTURACIÓN', ...
  entity_type text not null,
  entity_id uuid not null,
  before jsonb,
  after jsonb,
  result text,                        -- 'ok' | 'error'
  ip inet,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on audit_logs (entity_type, entity_id, created_at desc);
```

## 2.18 `integration_logs` (§35, §36)

Todo intercambio con Siigo/GHL, éxito o error — nunca un `catch(e){}` silencioso.

```sql
create table integration_logs (
  id uuid primary key default gen_random_uuid(),
  system integration_system not null,
  direction integration_direction not null,
  entity_type text,
  entity_id uuid,
  request jsonb,
  response jsonb,
  status_code integer,
  success boolean not null,
  error_message text,
  created_at timestamptz not null default now()
);

create index integration_logs_entity_idx on integration_logs (entity_type, entity_id, created_at desc);
```

## 2.19 `sync_jobs`

```sql
create table sync_jobs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,          -- 'product' | 'customer' | ...
  external_system integration_system not null,
  status text not null default 'pendiente',   -- pendiente|procesando|completado|error
  started_at timestamptz,
  finished_at timestamptz,
  records_processed integer default 0,
  records_failed integer default 0,
  error_message text,
  created_at timestamptz not null default now()
);
```

## 2.20 `settings`

Catálogos configurables (motivos de pérdida, responsabilidades fiscales, etc. — §12, §68.7).

```sql
create table settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  updated_by uuid references users(id),
  updated_at timestamptz not null default now()
);
```

---

# 3. Consecutivos internos (§41)

Generados en backend (nunca en el cliente, nunca editables):

```sql
create sequence order_number_seq;
create sequence quote_number_seq;

create or replace function next_order_number() returns text as $$
  select 'WOW-P-' || lpad(nextval('order_number_seq')::text, 7, '0');
$$ language sql;

create or replace function next_quote_number() returns text as $$
  select 'WOW-C-' || lpad(nextval('quote_number_seq')::text, 7, '0');
$$ language sql;
```

Se invocan solo desde la función/endpoint de backend que crea el pedido/cotización, dentro de la
misma transacción — nunca se calcula el consecutivo en el frontend.

---

# 4. Triggers y funciones clave

```sql
-- updated_at automático
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
-- (attach a customers, products, orders, quotes, users)

-- Historial de estado de pedido: se registra solo cuando el estado realmente cambia
create or replace function log_order_status_change() returns trigger as $$
begin
  if old.order_status is distinct from new.order_status then
    insert into order_status_history (order_id, from_status, to_status, changed_by, changed_at)
    values (new.id, old.order_status, new.order_status, auth.uid(), now());
  end if;
  return new;
end;
$$ language plpgsql;
create trigger orders_status_history
  after update on orders
  for each row execute function log_order_status_change();
```

La transición `order_status → facturando/facturado` **no** se hace con un `UPDATE` directo desde
el cliente: pasa siempre por una función backend (`RPC` con `security definer` o Edge Function con
`service_role`) que:
1. valida rol = bodega/admin (§18, §48 — el backend, no solo el frontend);
2. valida que `invoice_operations` no tenga ya una operación viva para ese pedido;
3. crea la fila en `invoice_operations` primero;
4. llama a Siigo;
5. según respuesta, actualiza `invoice_operations`, y solo si `confirmada`, inserta en `invoices`
   y mueve `orders.order_status`/`invoice_status`.

Esto es lo que convierte "facturar dos veces" en una **imposibilidad técnica** (§71), no una
buena práctica que alguien puede saltarse.

---

# 5. Row Level Security — estrategia por tabla

Función auxiliar:

```sql
create or replace function current_role() returns user_role as $$
  select role from users where id = auth.uid();
$$ language sql stable security definer;
```

| Tabla | SELECT | INSERT | UPDATE | Notas |
|---|---|---|---|---|
| `customers` | todo usuario autenticado activo | vendedora+ | responsable asignado, supervisor, admin | necesario ver todo para detectar duplicados (§6) |
| `customer_assignments` | todo autenticado | supervisor, admin | supervisor, admin | reasignar cliente no es acción de vendedora libre |
| `orders` | vendedora: propios (`salesperson_id = auth.uid()` o cliente asignado); bodega/supervisor/admin: todos | vendedora, bodega (histórico/importado) | según estado — bloqueado si `order_status` ≥ `aprobado_facturar` salvo bodega/admin | el bloqueo real vive también en constraint de backend, no solo RLS |
| `order_items` | igual que `orders` padre | igual que `orders` | bloqueado tras aprobación | |
| `order_reviews` | bodega, supervisor, admin | bodega | — | vendedora nunca ve el checklist como editable |
| `invoice_operations` | bodega, supervisor, admin | **ninguno vía cliente** | **ninguno vía cliente** | solo `service_role` desde el backend (§18, §36) |
| `invoices` | todos los que ven el pedido | **ninguno vía cliente** | nunca | inmutable desde el cliente (§24) |
| `products` | todo autenticado | admin | admin | sincronización real la hace `sync_jobs` con `service_role` |
| `quotes` / `quote_items` | igual regla que `orders` | vendedora | vendedora (mientras no `convertida`) | |
| `audit_logs` | supervisor, admin | **ninguno vía cliente** | nunca | solo `service_role` inserta |
| `integration_logs` | admin | **ninguno vía cliente** | nunca | solo `service_role` |
| `settings` | todo autenticado (lectura de catálogos) | admin | admin | |

Regla dura (§48, §59): **toda** política anterior se implementa con `RLS` real en Postgres, no
solo con lógica condicional en el frontend. El frontend oculta botones por UX; el backend/RLS
deniega por seguridad.

---

# 6. Vistas de apoyo (dashboards §30-32)

```sql
create view v_vendedora_hoy as
select
  o.salesperson_id,
  count(*) filter (where o.order_status = 'devuelto_vendedora') as pedidos_devueltos,
  count(*) filter (where o.order_status in ('borrador','enviado')) as pedidos_pendientes,
  count(*) filter (where q.status = 'en_seguimiento') as cotizaciones_abiertas
from orders o
full join quotes q on q.created_by = o.salesperson_id
group by o.salesperson_id;

create view v_bodega_cola as
select
  order_status,
  count(*) as total
from orders
where order_status in ('pendiente_revision','revision','aprobado_facturar','facturando','error_facturacion')
group by order_status;
```

(Se amplían en `09_UI_UX_Y_PANTALLAS.md`; aquí solo se deja la base para no bloquear el modelo.)

---

# 7. Puntos que siguen abiertos (heredados de §68 del maestro)

Ninguno de estos bloquea el esquema — están aislados en columnas `text`/`jsonb` flexibles
(`fiscal_responsibility`, `siigo_document_id`, `payload`s) precisamente para no tener que migrar
el esquema cuando se resuelvan contra la API real de Siigo:

1. Endpoint y forma exacta de consulta de stock por producto.
2. Catálogo completo de `fiscal_responsibility` y reglas de `vat_responsible`.
3. Numeración FV-1 vs FV-4 y su relación con `siigo_document_id`.
4. Estrategia exacta de reconciliación tras `resultado_incierto` (qué endpoint de Siigo consultar).
5. Estructura definitiva de nombre para persona natural (¿se valida contra cédula?).

---

# 8. Siguiente documento

`WOW_SALES_03_API_Y_LOGICA_BACKEND.md` — define los endpoints/RPCs, quién los puede llamar, y el
detalle de la máquina de estados de `invoice_operations` contra la API real de Siigo.
