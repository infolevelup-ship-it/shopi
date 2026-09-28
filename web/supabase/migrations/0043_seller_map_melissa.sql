-- ============================================================================
-- Completa `siigo_seller_map` (ver 0042): Melissa Comercial también cae en el
-- respaldo (Karina Noriega) porque su id de Siigo nunca se cargó al mapa,
-- aunque ya estaba documentado y confirmado por el equipo en
-- docs/PENDIENTES.md § "Configuración de Siigo aplicada" (3651, activa).
--
-- Con esto, las dos únicas vendedoras con pedidos reales (Melissa: 23
-- pedidos hasta hoy; Sandra, mapeada en 0042: 17 pedidos hasta hoy) quedan
-- cubiertas. "Karina Ríos" y "Laura Gómez" son cuentas de prueba de la Fase 1
-- (correo @productoswow.test, cero pedidos desde 2026-09-01/02) — no
-- necesitan mapeo.
-- ============================================================================

insert into app_settings (key, value) values
  ('siigo_seller_map', '{"d1c84364-642f-43e1-8e65-ee0f5f791ee7": 3651}'::jsonb)
on conflict (key) do update
  set value = coalesce(app_settings.value, '{}'::jsonb) || excluded.value;
