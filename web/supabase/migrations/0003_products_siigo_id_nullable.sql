-- products.siigo_product_id era NOT NULL, pero en V1 (antes de que exista la
-- sincronización real con Siigo — doc 10 Fase 7) un admin necesita poder
-- cargar productos a mano para poder construir/probar cotizaciones y
-- pedidos. NULL = "todavía no sincronizado con Siigo". El índice único
-- products_siigo_id_uniq ya tolera múltiples NULL (Postgres no los trata
-- como iguales), así que no hace falta tocarlo.
alter table products alter column siigo_product_id drop not null;
