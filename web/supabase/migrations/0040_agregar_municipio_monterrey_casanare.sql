-- ============================================================================
-- dane_locations es un catálogo curado, no el listado completo de los ~1100
-- municipios de Colombia (doc 06 §10, misma nota que migración 0037) — por
-- eso siguen faltando municipios reales a medida que aparecen clientes de
-- ahí. Reportado por el equipo (2026-09-26): Monterrey, Casanare, no salía
-- en el selector de ciudad.
-- ============================================================================

insert into dane_locations (department, state_code, city_name, city_code)
values ('Casanare', '85', 'Monterrey', '85162')
on conflict do nothing;
