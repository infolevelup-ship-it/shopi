-- Fase 5 (0006) agregó `orders.cancelled_by` pero se quedó sin su índice —
-- a diferencia de sus hermanas (approved_by, warehouse_reviewed_by, etc.),
-- todas indexadas desde el principio. Encontrado por el advisor de
-- performance de Supabase al revisar Fase 6, no por prueba manual.
create index orders_cancelled_by_idx on orders (cancelled_by);
