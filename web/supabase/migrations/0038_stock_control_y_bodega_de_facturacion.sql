-- ============================================================================
-- Bodega "sin asignar" al facturar (reportado por el equipo 2026-09-22,
-- Carlos/bodega): la plataforma nunca mandó bodega en la factura, así que
-- Siigo descuenta el inventario de una bodega fantasma (id -1, "Sin
-- asignar") en vez de "Bodega Principal" (id 107, confirmado contra la
-- cuenta real). Verificado en un producto real: quedó en -4 unidades en
-- "Sin asignar" mientras "Bodega Principal" nunca se tocó.
--
-- No se puede mandar `warehouse` en TODAS las líneas: confirmado contra la
-- cuenta real que 18 de 1761 productos tienen `stock_control: false`
-- (tarjetas de regalo, fletes, descuentos, un curso) — Siigo rechaza la
-- factura completa si se manda `warehouse` en una línea de un producto sin
-- control de inventario. Por eso hace falta saber, por producto, si tiene
-- control de inventario antes de decidir si esa línea lleva bodega.
-- ============================================================================

alter table products add column if not exists stock_control boolean;

insert into app_settings (key, value) values
  ('siigo_warehouse_id', '107'::jsonb)
on conflict (key) do update set value = excluded.value;
