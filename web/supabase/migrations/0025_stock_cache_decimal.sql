-- ============================================================================
-- El inventario de Siigo tiene decimales.
--
-- `stock_cache` se creó como `integer`, y la primera sincronización real del
-- catálogo falló entera con:
--
--   invalid input syntax for type integer: "150.16"
--
-- No es un caso raro: Siigo calcula `available_quantity` y devuelve
-- fracciones. Redondear al guardar sería tapar el error mostrándole a bodega
-- una cantidad que no es la que hay, así que se guarda el valor tal cual.
--
-- Un `alter column ... type numeric` sobre integer es una conversión sin
-- pérdida y no necesita `using`; la tabla se reescribe, pero con ~100
-- productos eso es instantáneo.
-- ============================================================================

alter table products
  alter column stock_cache type numeric(14,3);

comment on column products.stock_cache is
  'Inventario disponible según Siigo, con decimales. Es una foto del momento de la última sincronización (stock_updated_at), no un saldo en vivo.';
