-- Fase 12 (doc 10 §15, doc 09): infraestructura de migración — staging,
-- candidatos de fusión, lotes, y los campos "histórico" que faltaban en
-- invoices/quotes. Esto es SOLO la infraestructura: doc 09 §1 es explícito
-- en que el universo real de clientes a migrar (¿12k de Siigo/GHL o 26k del
-- catálogo de Apps Script?) "debe definirse antes de la migración" — sin
-- esa decisión y sin los archivos reales de origen, no hay ETL que
-- construir todavía (ver docs/PENDIENTES.md § Fase 12).

create type import_status as enum (
  'PENDING','NORMALIZED','DEDUPE_REVIEW','READY','IMPORTED','SKIPPED','FAILED'
);

-- doc 09 §17-19: cada lote de importación, con sus conteos antes/después.
create table migration_batches (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,          -- 'CUSTOMERS' | 'PRODUCTS' | 'ORDERS' | 'QUOTES' | 'PROSPECTS'
  label text,                         -- p.ej. "lote 1 = 50"
  source_system text,                 -- 'SIIGO' | 'GHL' | 'SHEET' | 'APPS_SCRIPT'
  records_source integer,             -- doc 09 §17: conteo en el origen, antes de importar
  records_created integer not null default 0,
  records_updated integer not null default 0,
  records_skipped integer not null default 0,
  records_failed integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

-- doc 09 §5-7: staging de clientes — nunca cargar directo a producción.
-- Normaliza documento/teléfono/email/nombre/ciudad antes de decidir si es
-- un cliente nuevo o ya existente (prioridad de dedup: documento > Siigo ID
-- > GHL ID > teléfono+nombre > email > similitud de nombre — nunca fusionar
-- solo por nombre).
create table customer_import_staging (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references migration_batches(id),
  source_system text not null,
  source_id text,
  raw_data jsonb not null,

  document_type text,
  document_number text,
  document_number_normalized text,
  phone text,
  email text,
  name text,
  city text,

  status import_status not null default 'PENDING',
  match_customer_id uuid references customers(id),
  match_reason text,
  needs_review boolean not null default false,
  review_notes text,

  imported_customer_id uuid references customers(id),
  error_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_import_staging_batch_idx on customer_import_staging (batch_id);
create index customer_import_staging_status_idx on customer_import_staging (status);
create index customer_import_staging_doc_idx on customer_import_staging (document_number_normalized);

-- doc 09 §8: candidatos de fusión que salen del dedupe — nunca se fusiona
-- solo, siempre lo confirma un humano.
create table customer_merge_candidates (
  id uuid primary key default gen_random_uuid(),
  customer_a uuid not null references customers(id),
  customer_b uuid not null references customers(id),
  reason text not null,
  confidence text,
  status text not null default 'PENDING',
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index customer_merge_candidates_status_idx on customer_merge_candidates (status);

-- doc 09 §13: facturas históricas — nunca se emiten, solo se guarda la
-- referencia de lo que ya existía en el sistema anterior. El pedido
-- histórico asociado NUNCA queda en INVOICING/INVOICED (constraint
-- orders_historical_never_invoices de la Fase 1, doc 04 §21) — su estado
-- final es DELIVERED, ya se entregó y facturó en el sistema viejo.
alter table invoices add column historical_invoice_number text;
alter table invoices add column historical_siigo_invoice_id text;
alter type invoice_status add value 'HISTORICAL';

-- doc 09 §14: cotizaciones antiguas sin estado real conocido.
alter type quote_status add value 'LEGACY_IMPORTED';

-- Todo esto es de operación de migración/admin — mismo patrón que
-- sync_jobs/integration_logs: solo admin lee, todas las escrituras pasan
-- por el backend con service_role (nunca desde el navegador).
alter table migration_batches enable row level security;
alter table customer_import_staging enable row level security;
alter table customer_merge_candidates enable row level security;

create policy migration_batches_select on migration_batches for select
  using (current_wow_role() = 'ADMIN');
create policy customer_import_staging_select on customer_import_staging for select
  using (current_wow_role() = 'ADMIN');
create policy customer_merge_candidates_select on customer_merge_candidates for select
  using (current_wow_role() = 'ADMIN');
