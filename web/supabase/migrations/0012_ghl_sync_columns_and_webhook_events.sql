-- Fase 9 (doc 10 §12, doc 07 §8): estado de sincronización con GHL. "WOW
-- pedido ✓, GHL sync ✗" (doc 07 §9) nunca debe invalidar nada — estas
-- columnas son solo para saber qué falló y poder reintentar, no bloquean.
create type ghl_sync_status as enum ('PENDING','SYNCED','ERROR');

alter table customers add column ghl_sync_status ghl_sync_status;
alter table customers add column ghl_last_synced_at timestamptz;
alter table customers add column ghl_sync_error text;

alter table orders add column ghl_sync_status ghl_sync_status;
alter table orders add column ghl_last_synced_at timestamptz;
alter table orders add column ghl_sync_error text;

-- doc 07 §11: webhook debe autenticar, deduplicar, registrar, procesar.
-- ghl_event_key es lo que permite deduplicar — GHL no confirma un id de
-- evento estable en su payload, así que se calcula un hash del cuerpo
-- crudo si no viene uno (ver web/src/app/api/webhooks/ghl/route.ts).
create table ghl_webhook_events (
  id uuid primary key default gen_random_uuid(),
  ghl_event_key text not null unique,
  event_type text,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

alter table ghl_webhook_events enable row level security;
create policy ghl_webhook_events_select on ghl_webhook_events for select
  using (current_wow_role() = 'ADMIN');
-- Sin política de insert: el receptor del webhook escribe con service_role
-- (nunca desde el navegador, doc 07 §2: "Nunca: Browser → Siigo/GHL").

create index orders_ghl_sync_status_idx on orders (ghl_sync_status) where ghl_sync_status = 'ERROR';
create index customers_ghl_sync_status_idx on customers (ghl_sync_status) where ghl_sync_status = 'ERROR';
