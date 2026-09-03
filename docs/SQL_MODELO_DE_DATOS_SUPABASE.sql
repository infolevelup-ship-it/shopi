-- ============================================================================
-- WOW SALES — SQL definitivo de Supabase
-- Deriva letra por letra de docs/02_MODELO_DE_DATOS_SUPABASE.md
-- (nombres de tabla, campo y estado son los del documento 02; este archivo
-- solo los convierte en DDL ejecutable. Si algo aquí contradice el 02,
-- gana el 02 — corregir este archivo, nunca al revés.)
--
-- Puntos marcados [DECISIÓN] son detalles de tipado que el 02 no fija
-- explícitamente (p.ej. si un status es enum o texto libre). Están aislados
-- para poder ajustarse sin romper el resto del esquema.
-- ============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- pg_trgm fuera de public (recomendación del linter de seguridad de Supabase:
-- no instalar extensiones en el schema expuesto por PostgREST)
create schema if not exists extensions;
create extension if not exists pg_trgm schema extensions;   -- búsqueda por similitud (nombre, marca)

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

create type user_role as enum ('SELLER','WAREHOUSE','SUPERVISOR','ADMIN');

create type customer_status as enum ('PROSPECT','ACTIVE','INACTIVE','RECOVERY','BLOCKED');

create type assignment_type as enum ('PRIMARY_OWNER','TEMPORARY_SUPPORT');

create type activity_type as enum (
  'CALL','WHATSAPP','EMAIL','VISIT','NOTE',
  'QUOTE_CREATED','QUOTE_SENT','QUOTE_WON','QUOTE_LOST',
  'ORDER_CREATED','ORDER_UPDATED','INVOICE_CREATED','SHIPMENT','FOLLOW_UP','OTHER'
);

create type prospect_stage as enum (
  'NEW','CONTACTED','INTERESTED','QUOTE','NEGOTIATION','WON','LOST'
);

create type quote_status as enum (
  'DRAFT','SENT','FOLLOW_UP','ACCEPTED','CONVERTED','LOST','EXPIRED','CANCELLED'
);

-- §10 doc 04 / §21 doc 04: histórico jamás puede llegar a INVOICING/INVOICED
create type order_source_type as enum ('LIVE','HISTORICAL','IMPORTED');

create type order_status as enum (
  'DRAFT','SUBMITTED','PENDING_REVIEW','IN_REVIEW','RETURNED_TO_SELLER',
  'APPROVED_FOR_INVOICE','INVOICING','INVOICED',
  'READY_FOR_DISPATCH','DISPATCHED','DELIVERED',
  'CANCELLED','BLOCKED'
);

create type order_review_status as enum ('PENDING','APPROVED','RETURNED');

-- Reutilizado por invoices e invoice_operations (mismo ciclo de vida fiscal, §16/§17/§14 doc 03/04)
create type invoice_status as enum (
  'PENDING','PROCESSING','ISSUED','UNCERTAIN','ERROR_RETRYABLE','ERROR_FINAL'
);

create type follow_up_status as enum ('PENDING','COMPLETED','OVERDUE','CANCELLED');

-- [DECISIÓN] doc 02 no enumera estados de shipment; se infiere del flujo del doc 04 §15
create type shipment_status as enum ('PENDING','DISPATCHED','DELIVERED','CANCELLED');

-- [DECISIÓN] doc 02 no enumera estados de payment; texto libre validado en backend, no enum cerrado
-- (las formas de pago reales se mapean en doc 06 §15 y pueden ampliarse sin migración)

create type integration_system as enum ('SIIGO','GHL');

create type sync_job_status as enum ('PENDING','RUNNING','COMPLETED','FAILED');

-- ============================================================================
-- 2. USERS  (doc 02 §3)
-- ============================================================================

create table users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete restrict,
  name text not null,
  email text not null unique,
  phone text,
  role user_role not null,
  active boolean not null default true,
  ghl_user_id text,
  seller_code text,
  branch_code text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 3. CUSTOMERS  (doc 02 §4)
-- ============================================================================

create table customers (
  id uuid primary key default gen_random_uuid(),
  customer_type text not null,                    -- 'natural' | 'juridica' (validado en backend)
  document_type text not null,
  document_number text not null,
  document_number_normalized text not null,        -- solo dígitos, sin puntos/guiones/DV
  check_digit text,
  legal_name text,
  first_name text,
  last_name text,
  commercial_name text,
  email text,
  phone text,
  secondary_phone text,
  address text,
  department text,
  city text,
  state_code text,
  city_code text,
  postal_code text,
  fiscal_responsibility text,
  vat_responsible boolean,
  purchase_type text,
  customer_type_classification text,               -- p.ej. salón / distribuidor / público
  channel text,
  credit_limit numeric(14,2),
  website_social text,

  siigo_customer_id text,
  ghl_contact_id text,

  status customer_status not null default 'PROSPECT',
  responsible_user_id uuid references users(id),

  source text,
  is_duplicate_candidate boolean not null default false,
  merged_into_customer_id uuid references customers(id),

  last_purchase_at timestamptz,
  last_contact_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Dedup real (doc 01 §7, doc 02 §4): mismo documento normalizado no puede repetirse
-- entre clientes "vivos" (no fusionados)
create unique index customers_document_uniq
  on customers (document_type, document_number_normalized)
  where merged_into_customer_id is null;

create index customers_responsible_idx on customers (responsible_user_id);
create index customers_siigo_id_idx on customers (siigo_customer_id);
create index customers_ghl_contact_idx on customers (ghl_contact_id);
create index customers_phone_idx on customers (phone);
create index customers_display_name_trgm on customers using gin (coalesce(commercial_name, legal_name, first_name || ' ' || last_name) extensions.gin_trgm_ops);

-- ============================================================================
-- 4. CUSTOMER ASSIGNMENTS  (doc 02 §5)
-- ============================================================================

create table customer_assignments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  user_id uuid not null references users(id),
  assignment_type assignment_type not null,
  start_at timestamptz not null default now(),
  end_at timestamptz,
  active boolean not null default true,
  reason text,
  assigned_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

-- Máximo un propietario primario activo por cliente (doc 02 §5)
create unique index customer_assignments_primary_owner_uniq
  on customer_assignments (customer_id)
  where active and assignment_type = 'PRIMARY_OWNER';

create index customer_assignments_customer_idx on customer_assignments (customer_id, active);
create index customer_assignments_user_idx on customer_assignments (user_id, active);

-- ============================================================================
-- 5. CUSTOMER ACTIVITIES  (doc 02 §6)
-- ============================================================================

create table customer_activities (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  user_id uuid not null references users(id),
  activity_type activity_type not null,
  description text,
  reference_type text,
  reference_id uuid,
  activity_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index customer_activities_customer_idx on customer_activities (customer_id, activity_at desc);

-- ============================================================================
-- 6. PROSPECTS  (doc 02 §7)
-- ============================================================================

create table prospects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  name text not null,
  commercial_name text,
  phone text,
  email text,
  city text,
  user_id uuid not null references users(id),
  stage prospect_stage not null default 'NEW',
  first_visit_at timestamptz,
  last_visit_at timestamptz,
  next_follow_up_at timestamptz,
  notes text,
  source text,
  lost_reason text,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index prospects_user_idx on prospects (user_id, stage);
create index prospects_next_follow_up_idx on prospects (next_follow_up_at) where stage not in ('WON','LOST');

-- ============================================================================
-- 7. PRODUCTS  (doc 02 §8)
-- ============================================================================

create table products (
  id uuid primary key default gen_random_uuid(),
  -- null = todavía no sincronizado con Siigo (creado a mano en admin antes de
  -- que exista la integración real, doc 10 Fase 7). El índice único de abajo
  -- tolera múltiples NULL sin problema — Postgres no los considera iguales.
  siigo_product_id text,
  code text not null,
  name text not null,
  brand text,
  description text,
  active boolean not null default true,
  tax_id text,
  tax_percent numeric(5,2),
  unit_code text,
  price_public numeric(14,2),
  price_professional numeric(14,2),
  price_salon numeric(14,2),
  stock_cache integer,
  stock_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index products_code_uniq on products (code);
create unique index products_siigo_id_uniq on products (siigo_product_id);
create index products_name_trgm on products using gin (name extensions.gin_trgm_ops);
create index products_brand_trgm on products using gin (brand extensions.gin_trgm_ops);
create index products_active_idx on products (active);

-- ============================================================================
-- 8. QUOTES / QUOTE_ITEMS  (doc 02 §9)
-- ============================================================================

create table quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique,
  customer_id uuid not null references customers(id),
  seller_id uuid not null references users(id),
  status quote_status not null default 'DRAFT',
  source_type order_source_type not null default 'LIVE',
  price_list text,
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  retention_total numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  valid_until date,
  notes text,
  sent_at timestamptz,
  accepted_at timestamptz,
  converted_order_id uuid,        -- FK diferida, ver sección 10 (orders se crea después)
  lost_at timestamptz,
  lost_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  product_id uuid references products(id),
  product_code_snapshot text not null,
  product_name_snapshot text not null,
  quantity numeric(12,2) not null,
  unit_price numeric(14,2) not null,
  discount_percent numeric(5,2) not null default 0,
  discount_value numeric(14,2) not null default 0,
  tax_id text,
  tax_percent numeric(5,2),
  line_subtotal numeric(14,2) not null,
  line_tax numeric(14,2) not null default 0,
  line_total numeric(14,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quotes_customer_idx on quotes (customer_id);
create index quotes_seller_idx on quotes (seller_id, status);
create index quote_items_quote_idx on quote_items (quote_id);

-- ============================================================================
-- 9. ORDERS / ORDER_ITEMS  (doc 02 §10 / §11)
-- ============================================================================

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references customers(id),
  seller_id uuid not null references users(id),
  responsible_customer_owner_id uuid not null references users(id),   -- snapshot del responsable al momento del pedido
  source_type order_source_type not null default 'LIVE',
  channel text,
  status order_status not null default 'DRAFT',

  document_type text,
  price_list text,
  payment_method text,
  payment_method_detail text,

  subtotal_gross numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  subtotal_net numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  retention_total numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,

  notes text,

  ghl_opportunity_id text,
  siigo_invoice_id text,
  invoice_number text,

  warehouse_reviewed_by uuid references users(id),
  approved_by uuid references users(id),
  invoiced_by uuid references users(id),
  dispatched_by uuid references users(id),

  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  review_started_at timestamptz,
  approved_at timestamptz,
  invoicing_started_at timestamptz,
  invoiced_at timestamptz,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table quotes
  add constraint quotes_converted_order_fk
  foreign key (converted_order_id) references orders(id);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id),
  product_code_snapshot text not null,
  product_name_snapshot text not null,
  quantity numeric(12,2) not null,
  unit_price numeric(14,2) not null,
  discount_percent numeric(5,2) not null default 0,
  discount_value numeric(14,2) not null default 0,
  tax_id text,
  tax_percent numeric(5,2),
  unit_code text,
  siigo_product_id text,
  line_subtotal numeric(14,2) not null,
  line_tax numeric(14,2) not null default 0,
  line_total numeric(14,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_customer_idx on orders (customer_id);
create index orders_seller_idx on orders (seller_id);
create index orders_status_idx on orders (status);
create index orders_created_at_idx on orders (created_at);
create index order_items_order_idx on order_items (order_id);

-- Regla dura (doc 01 §26, doc 04 §21/§23): un pedido histórico/importado NUNCA
-- puede entrar a estado de facturación por la ruta viva.
alter table orders add constraint orders_historical_never_invoices
  check (not (source_type <> 'LIVE' and status in ('INVOICING','INVOICED')));

-- ============================================================================
-- 10. ORDER STATUS HISTORY  (doc 02 §12)
-- ============================================================================

create table order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  from_status order_status,
  to_status order_status not null,
  changed_by uuid not null references users(id),
  reason text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index order_status_history_order_idx on order_status_history (order_id, created_at);

-- security definer: order_status_history tiene RLS sin política de INSERT
-- (nadie debe insertar ahí a mano, solo este trigger). SECURITY DEFINER lo
-- hace correr como el dueño de la tabla, que sí puede escribir pese al RLS.
create or replace function log_order_status_change() returns trigger as $$
begin
  if old.status is distinct from new.status then
    insert into order_status_history (order_id, from_status, to_status, changed_by, created_at)
    values (new.id, old.status, new.status, coalesce(auth.uid(), new.seller_id), now());
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger orders_status_history
  after update on orders
  for each row execute function log_order_status_change();

-- ============================================================================
-- 11. ORDER REVIEWS  (doc 02 §13 — checklist de bodega, doc 04 §10)
-- ============================================================================

create table order_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  reviewed_by uuid not null references users(id),
  customer_ok boolean not null default false,
  products_ok boolean not null default false,
  quantities_ok boolean not null default false,
  prices_ok boolean not null default false,
  inventory_ok boolean not null default false,
  payment_ok boolean not null default false,
  receipts_ok boolean not null default false,
  fiscal_data_ok boolean not null default false,
  printed_receipt boolean not null default false,
  status order_review_status not null default 'PENDING',
  notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index order_reviews_order_idx on order_reviews (order_id);

-- ============================================================================
-- 12. PAYMENTS  (doc 02 §14)
-- ============================================================================

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  payment_method text not null,
  amount numeric(14,2) not null,
  payment_date date,
  reference text,
  status text not null default 'pending',   -- ver [DECISIÓN] en sección de enums
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index payments_order_idx on payments (order_id);

-- ============================================================================
-- 13. ATTACHMENTS  (doc 02 §15 — máximo 3 comprobantes por pedido)
-- ============================================================================

create table attachments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,        -- 'order' | 'customer' | ...
  entity_id uuid not null,
  storage_path text not null,       -- bucket + path en Supabase Storage
  original_filename text,
  mime_type text,
  size_bytes bigint,
  checksum text,
  uploaded_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index attachments_entity_idx on attachments (entity_type, entity_id);

-- Tope de 3 comprobantes de pago por pedido (doc 02 §15), aplicado en base de datos
create or replace function enforce_max_receipts_per_order() returns trigger as $$
begin
  if new.entity_type = 'order' and (
    select count(*) from attachments
    where entity_type = 'order' and entity_id = new.entity_id
  ) >= 3 then
    raise exception 'El pedido % ya tiene el máximo de 3 comprobantes', new.entity_id;
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

create trigger attachments_max_receipts
  before insert on attachments
  for each row execute function enforce_max_receipts_per_order();

-- ============================================================================
-- 14. INVOICES  (doc 02 §16)
-- ============================================================================

create table invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  customer_id uuid not null references customers(id),
  siigo_invoice_id text,
  invoice_number text,
  invoice_status invoice_status not null default 'PENDING',
  siigo_status text,               -- estado fiscal crudo devuelto por Siigo (stamp/DIAN)
  total numeric(14,2),
  invoice_date timestamptz,
  issued_by uuid not null references users(id),
  response_reference jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Doc 02 §16: "Debe existir como máximo una factura activa por pedido."
create unique index invoices_order_uniq on invoices (order_id);
create unique index invoices_siigo_invoice_id_uniq on invoices (siigo_invoice_id) where siigo_invoice_id is not null;

-- ============================================================================
-- 15. INVOICE OPERATIONS  (doc 02 §17 — idempotencia real)
-- ============================================================================

create table invoice_operations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  idempotency_key text not null,
  status invoice_status not null default 'PENDING',
  attempt_count integer not null default 1,
  request_started_at timestamptz not null default now(),
  response_received_at timestamptz,
  siigo_invoice_id text,
  error_code text,
  error_message text,
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Núcleo de la idempotencia (doc 01 §20, doc 03 §12): mientras una operación
-- esté viva para una idempotency_key, no puede existir otra.
create unique index invoice_operations_active_key_uniq
  on invoice_operations (idempotency_key)
  where status in ('PENDING','PROCESSING','UNCERTAIN');

create index invoice_operations_order_idx on invoice_operations (order_id, created_at desc);

-- ============================================================================
-- 16. FOLLOW UPS  (doc 02 §18)
-- ============================================================================

create table follow_ups (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  seller_id uuid not null references users(id),
  type text,
  priority text,
  scheduled_at timestamptz not null,
  completed_at timestamptz,
  status follow_up_status not null default 'PENDING',
  reason text,
  result text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index follow_ups_seller_status_idx on follow_ups (seller_id, status, scheduled_at);

-- ============================================================================
-- 17. SHIPMENTS  (doc 02 §19)
-- ============================================================================

create table shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  status shipment_status not null default 'PENDING',
  dispatched_by uuid references users(id),
  dispatched_at timestamptz,
  delivery_confirmed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shipments_order_idx on shipments (order_id);

-- ============================================================================
-- 18. AUDIT LOGS  (doc 02 §20)
-- ============================================================================

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  action text not null,              -- APPROVE_ORDER, RETURN_ORDER, START_INVOICE, INVOICE_SUCCESS,
                                      -- INVOICE_ERROR, CANCEL_ORDER, ASSIGN, REASSIGN, MANUAL_OVERRIDE, ...
  entity_type text not null,
  entity_id uuid not null,
  before_data jsonb,
  after_data jsonb,
  context jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on audit_logs (entity_type, entity_id, created_at desc);

-- ============================================================================
-- 19. INTEGRATION LOGS  (doc 02 §21)
-- ============================================================================

create table integration_logs (
  id uuid primary key default gen_random_uuid(),
  system integration_system not null,
  operation text not null,
  entity_type text,
  entity_id uuid,
  external_id text,
  status text not null,
  http_status integer,
  request_id text,
  error_code text,
  error_message text,
  attempt integer not null default 1,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index integration_logs_entity_idx on integration_logs (entity_type, entity_id, created_at desc);

-- ============================================================================
-- 20. SYNC JOBS  (doc 02 §22)
-- ============================================================================

create table sync_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,             -- PRODUCT_SYNC, CUSTOMER_SYNC, STOCK_SYNC, RECONCILIATION
  system integration_system not null,
  status sync_job_status not null default 'PENDING',
  started_at timestamptz,
  finished_at timestamptz,
  cursor text,
  records_processed integer not null default 0,
  records_failed integer not null default 0,
  error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 21. APP SETTINGS  (doc 02 §2 — catálogos configurables)
-- ============================================================================

create table app_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  updated_by uuid references users(id),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 22. updated_at automático (aplica a toda tabla con esa columna)
-- ============================================================================

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

do $$
declare t text;
begin
  foreach t in array array[
    'users','customers','products','quotes','quote_items','orders','order_items',
    'prospects','invoices','invoice_operations','follow_ups','shipments','sync_jobs'
  ] loop
    execute format('create trigger set_updated_at before update on %I for each row execute function set_updated_at();', t);
  end loop;
end $$;

-- ============================================================================
-- 23. VISTA customer_metrics  (doc 02 §23 — valores derivados, nunca hechos históricos)
-- ============================================================================

-- security_invoker: sin esto la vista corre con los privilegios de quien la
-- creó (de facto salta el RLS de quien consulta) — Postgres 15+.
create view customer_metrics with (security_invoker = true) as
select
  c.id as customer_id,
  count(o.id) filter (where o.status not in ('CANCELLED')) as orders_count,
  coalesce(sum(o.grand_total) filter (where o.status = 'INVOICED'), 0) as lifetime_value,
  coalesce(avg(o.grand_total) filter (where o.status = 'INVOICED'), 0) as average_ticket,
  max(o.invoiced_at) as last_order_at,
  extract(day from now() - max(o.invoiced_at)) as days_since_last_order,
  count(q.id) filter (where q.status in ('SENT','FOLLOW_UP')) as open_quotes_count,
  count(f.id) filter (where f.status = 'PENDING') as open_followups_count
from customers c
left join orders o on o.customer_id = c.id
left join quotes q on q.customer_id = c.id
left join follow_ups f on f.customer_id = c.id
group by c.id;

-- ============================================================================
-- 24. ROW LEVEL SECURITY  (doc 05 — seguridad real, no solo ocultar botones)
-- ============================================================================

create or replace function current_wow_role() returns user_role as $$
  select role from users where auth_user_id = auth.uid();
$$ language sql stable security definer set search_path = public;

create or replace function current_wow_user_id() returns uuid as $$
  select id from users where auth_user_id = auth.uid();
$$ language sql stable security definer set search_path = public;

-- Estas dos son helpers internos usados dentro de políticas RLS, no
-- endpoints públicos. Postgres las expone por defecto a anon/authenticated
-- vía /rest/v1/rpc/... al crearlas (Supabase advisor: "Public Can Execute
-- SECURITY DEFINER Function") — restringir a solo lo que las políticas
-- necesitan (authenticated; ninguna política nuestra depende de ellas para
-- anon, que nunca tiene auth.uid()).
revoke execute on function current_wow_role() from anon, authenticated;
revoke execute on function current_wow_user_id() from anon, authenticated;
grant execute on function current_wow_role() to authenticated;
grant execute on function current_wow_user_id() to authenticated;

alter table users enable row level security;
alter table customers enable row level security;
alter table customer_assignments enable row level security;
alter table customer_activities enable row level security;
alter table prospects enable row level security;
alter table products enable row level security;
alter table quotes enable row level security;
alter table quote_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_status_history enable row level security;
alter table order_reviews enable row level security;
alter table payments enable row level security;
alter table attachments enable row level security;
alter table invoices enable row level security;
alter table invoice_operations enable row level security;
alter table follow_ups enable row level security;
alter table shipments enable row level security;
alter table audit_logs enable row level security;
alter table integration_logs enable row level security;
alter table sync_jobs enable row level security;
alter table app_settings enable row level security;

-- Usuarios: cualquier cuenta interna autenticada puede leer el directorio de
-- usuarios (roster pequeño, 4 vendedoras + bodega + admin — necesario para
-- mostrar nombres de responsables/vendedoras en pedidos y clientes). Nadie
-- escribe su propia fila desde el cliente: alta, cambio de rol y
-- activar/desactivar son exclusivos de ADMIN (doc 05 §5), vía función
-- backend, nunca UPDATE directo.
-- (select auth.uid()) en vez de auth.uid() a secas: evita que Postgres la
-- reevalúe fila por fila (Supabase performance advisor "Auth RLS Initplan").
create policy users_select on users for select
  using ((select auth.uid()) is not null);

-- Clientes: todo usuario interno activo puede leer (necesario para detectar
-- duplicados, doc 01 §6); escritura solo vendedora+ (backend valida propiedad)
create policy customers_select on customers for select
  using (current_wow_role() is not null);
create policy customers_insert on customers for insert
  with check (current_wow_role() in ('SELLER','WAREHOUSE','SUPERVISOR','ADMIN'));

-- customer_assignments: todos ven quién es responsable de qué (doc 01 §5/§6);
-- solo puede insertar quien se asigna a sí misma (alta de cliente nuevo) o
-- supervisor/admin (reasignación real, doc 05 §6)
create policy customer_assignments_select on customer_assignments for select
  using (current_wow_role() is not null);
create policy customer_assignments_insert on customer_assignments for insert
  with check (user_id = current_wow_user_id() or current_wow_role() in ('SUPERVISOR','ADMIN'));

-- customer_activities: línea de tiempo visible y editable por cualquier interno
create policy customer_activities_select on customer_activities for select
  using (current_wow_role() is not null);
create policy customer_activities_insert on customer_activities for insert
  with check (current_wow_role() is not null);

-- prospects: cada vendedora ve/gestiona los propios; supervisor/admin ven todos
create policy prospects_select on prospects for select
  using (user_id = current_wow_user_id() or current_wow_role() in ('SUPERVISOR','ADMIN'));
create policy prospects_insert on prospects for insert
  with check (user_id = current_wow_user_id() or current_wow_role() in ('SUPERVISOR','ADMIN'));

-- products: catálogo de lectura para todos los roles internos; alta/edición
-- solo admin (la sincronización real corre con service_role, no con esto)
create policy products_select on products for select
  using (current_wow_role() is not null);
create policy products_insert on products for insert
  with check (current_wow_role() = 'ADMIN');

-- quotes: misma regla que orders (seller ve lo propio; bodega/supervisor/admin ven todo)
create policy quotes_select on quotes for select
  using (
    seller_id = current_wow_user_id()
    or current_wow_role() in ('WAREHOUSE','SUPERVISOR','ADMIN')
  );
-- OJO: "seller_id = current_wow_user_id()" solo por sí sola NO restringe
-- nada — cualquier rol (incluida bodega) puede insertar poniéndose a sí
-- mismo como seller_id. Hace falta exigir el rol explícitamente primero
-- (doc 01 §4.1-4.3: solo SELLER/SUPERVISOR/ADMIN crean cotizaciones).
create policy quotes_insert on quotes for insert
  with check (
    current_wow_role() in ('SELLER','SUPERVISOR','ADMIN')
    and (seller_id = current_wow_user_id() or current_wow_role() in ('SUPERVISOR','ADMIN'))
  );

create policy quote_items_select on quote_items for select
  using (exists (select 1 from quotes q where q.id = quote_items.quote_id));
create policy quote_items_insert on quote_items for insert
  with check (exists (select 1 from quotes q where q.id = quote_items.quote_id));

-- Pedidos: vendedora ve los propios; bodega/supervisor/admin ven todos
create policy orders_select on orders for select
  using (
    seller_id = current_wow_user_id()
    or current_wow_role() in ('WAREHOUSE','SUPERVISOR','ADMIN')
  );
-- Mismo cuidado que en quotes_insert: exigir el rol explícitamente, no solo
-- "seller_id = uno mismo" (eso lo cumple cualquier rol trivialmente).
create policy orders_insert on orders for insert
  with check (
    current_wow_role() in ('SELLER','SUPERVISOR','ADMIN')
    and (seller_id = current_wow_user_id() or current_wow_role() in ('SUPERVISOR','ADMIN'))
  );

create policy order_items_select on order_items for select
  using (exists (select 1 from orders o where o.id = order_items.order_id));

-- order_status_history: visible según se pueda ver el pedido; nadie inserta
-- manualmente — solo el trigger log_order_status_change (security definer)
create policy order_status_history_select on order_status_history for select
  using (exists (select 1 from orders o where o.id = order_status_history.order_id));

-- order_reviews: checklist de bodega — nunca visible para vendedora (doc 08 §15)
create policy order_reviews_select on order_reviews for select
  using (current_wow_role() in ('WAREHOUSE','SUPERVISOR','ADMIN'));
create policy order_reviews_insert on order_reviews for insert
  with check (current_wow_role() in ('WAREHOUSE','SUPERVISOR','ADMIN'));

-- payments: visible según se pueda ver el pedido; cualquier interno registra
create policy payments_select on payments for select
  using (exists (select 1 from orders o where o.id = payments.order_id));
create policy payments_insert on payments for insert
  with check (current_wow_role() is not null);

-- attachments: comprobantes — sube la vendedora, verifica bodega
create policy attachments_select on attachments for select
  using (current_wow_role() is not null);
create policy attachments_insert on attachments for insert
  with check (current_wow_role() is not null);

-- Facturación: solo lectura desde el cliente. Toda escritura pasa por
-- función backend con service_role (doc 01 §18, doc 03 §13) — nunca INSERT
-- directo desde el navegador.
create policy invoices_select on invoices for select
  using (current_wow_role() in ('WAREHOUSE','SUPERVISOR','ADMIN'));
create policy invoice_operations_select on invoice_operations for select
  using (current_wow_role() in ('WAREHOUSE','SUPERVISOR','ADMIN'));

-- follow_ups: cada vendedora ve/gestiona los propios; supervisor/admin ven todos
create policy follow_ups_select on follow_ups for select
  using (seller_id = current_wow_user_id() or current_wow_role() in ('SUPERVISOR','ADMIN'));
create policy follow_ups_insert on follow_ups for insert
  with check (seller_id = current_wow_user_id() or current_wow_role() in ('SUPERVISOR','ADMIN'));

-- shipments: visible según se pueda ver el pedido; solo bodega despacha
create policy shipments_select on shipments for select
  using (exists (select 1 from orders o where o.id = shipments.order_id));
create policy shipments_insert on shipments for insert
  with check (current_wow_role() in ('WAREHOUSE','SUPERVISOR','ADMIN'));

-- Auditoría: solo supervisor/admin leen; nadie escribe desde el cliente
create policy audit_logs_select on audit_logs for select
  using (current_wow_role() in ('SUPERVISOR','ADMIN'));
create policy integration_logs_select on integration_logs for select
  using (current_wow_role() = 'ADMIN');

-- sync_jobs: solo admin — el resto de escrituras las hace el backend con
-- service_role (bypassa RLS), esto es únicamente para que admin pueda auditar
create policy sync_jobs_select on sync_jobs for select
  using (current_wow_role() = 'ADMIN');

-- app_settings: catálogos configurables — lectura para todos, escritura admin
create policy app_settings_select on app_settings for select
  using (current_wow_role() is not null);
create policy app_settings_insert on app_settings for insert
  with check (current_wow_role() = 'ADMIN');
create policy app_settings_update on app_settings for update
  using (current_wow_role() = 'ADMIN');

-- Nota: las políticas de UPDATE para transiciones de estado (aprobar,
-- devolver, facturar, despachar) se implementan como funciones RPC
-- `security definer` que revalidan rol + estado antes de mutar, en vez de
-- políticas RLS genéricas de UPDATE — así la máquina de estados del doc 04
-- vive en un solo lugar (ver docs/03_LOGICA_BACKEND_Y_API.md §9, "commands
-- vs updates").

-- ============================================================================
-- 25. Índices en columnas FK "quién hizo esto" (Supabase performance advisor)
-- ============================================================================

create index app_settings_updated_by_idx on app_settings (updated_by);
create index attachments_uploaded_by_idx on attachments (uploaded_by);
create index audit_logs_user_id_idx on audit_logs (user_id);
create index customer_activities_user_id_idx on customer_activities (user_id);
create index customer_assignments_assigned_by_idx on customer_assignments (assigned_by);
create index customers_merged_into_idx on customers (merged_into_customer_id);
create index follow_ups_customer_id_idx on follow_ups (customer_id);
create index invoices_customer_id_idx on invoices (customer_id);
create index invoices_issued_by_idx on invoices (issued_by);
create index order_items_product_id_idx on order_items (product_id);
create index order_reviews_reviewed_by_idx on order_reviews (reviewed_by);
create index order_status_history_changed_by_idx on order_status_history (changed_by);
create index orders_approved_by_idx on orders (approved_by);
create index orders_dispatched_by_idx on orders (dispatched_by);
create index orders_invoiced_by_idx on orders (invoiced_by);
create index orders_responsible_owner_idx on orders (responsible_customer_owner_id);
create index orders_warehouse_reviewed_by_idx on orders (warehouse_reviewed_by);
create index payments_created_by_idx on payments (created_by);
create index prospects_customer_id_idx on prospects (customer_id);
create index quote_items_product_id_idx on quote_items (product_id);
create index quotes_converted_order_idx on quotes (converted_order_id);
create index shipments_dispatched_by_idx on shipments (dispatched_by);
