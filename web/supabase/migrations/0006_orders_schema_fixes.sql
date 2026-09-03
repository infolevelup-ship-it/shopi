-- ============================================================================
-- Fase 5 (doc 10 §8) — arreglos de esquema encontrados ANTES de escribir la
-- lógica de negocio (revisando el esquema real en vez de asumir, tras el
-- susto de la Fase 4 con quotes).
-- ============================================================================

-- doc 01 §46: "No borrar pedidos. Siempre CANCELADO con cancelled_at,
-- cancelled_by, cancellation_reason." Solo existía cancelled_at.
alter table orders add column cancelled_by uuid references users(id);
alter table orders add column cancellation_reason text;

-- order_items no tenía política de INSERT (mismo hueco que tuvo quote_items
-- en la Fase 4, esta vez detectado por revisión antes de escribir código).
create policy order_items_insert on order_items for insert
  with check (exists (select 1 from orders o where o.id = order_items.order_id));
