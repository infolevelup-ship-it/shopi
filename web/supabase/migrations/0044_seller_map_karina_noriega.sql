-- ============================================================================
-- Karina Noriega SÍ es vendedora real (además de liderar al equipo, por eso
-- tiene permisos de ADMIN) — confirmado por el equipo 2026-09-28. Tiene 13
-- pedidos propios que hoy solo salen bien en Siigo por coincidencia: caen en
-- `siigo_default_seller_id`, que da la casualidad de que también es su id
-- (3375). Si ese respaldo alguna vez cambia de significado (p.ej. para un
-- pedido sin vendedora asignada), sus facturas se romperían sin avisar.
--
-- Se agrega su mapeo explícito en `siigo_seller_map` para que no dependa de
-- esa coincidencia.
-- ============================================================================

insert into app_settings (key, value) values
  ('siigo_seller_map', '{"24b33f29-86f8-4819-b48f-85e6b72f8c4d": 3375}'::jsonb)
on conflict (key) do update
  set value = coalesce(app_settings.value, '{}'::jsonb) || excluded.value;
