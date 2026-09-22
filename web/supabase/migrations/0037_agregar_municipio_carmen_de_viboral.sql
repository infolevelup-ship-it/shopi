-- ============================================================================
-- dane_locations es un catálogo curado, no el listado completo de los ~1100
-- municipios de Colombia (doc 06 §10) — por eso faltan municipios reales a
-- medida que aparecen clientes de ahí. Reportado por el equipo (2026-09-22):
-- El Carmen de Viboral, Antioquia, no salía en el selector de ciudad.
-- ============================================================================

insert into dane_locations (department, state_code, city_name, city_code)
values ('Antioquia', '05', 'El Carmen de Viboral', '05148')
on conflict do nothing;
