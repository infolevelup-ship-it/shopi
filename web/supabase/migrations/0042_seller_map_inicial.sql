-- ============================================================================
-- Todos los pedidos llegan a Siigo a nombre de "Karina Noriega" en vez de la
-- vendedora real (reportado por el equipo 2026-09-28). Causa: `siigo_seller_map`
-- nunca se llenó, así que TODOS los pedidos caían en el respaldo
-- `siigo_default_seller_id` (3375 = Karina Noriega, una cuenta de admin en
-- Siigo, no una vendedora).
--
-- Se arranca solo con Sandra Ayala: es la única vendedora con una coincidencia
-- inequívoca en Siigo (nombre completo idéntico, cuenta activa, id 3565).
-- Las otras 3 vendedoras quedan pendientes — hay que confirmar con el equipo:
--   - Melissa Comercial: dos candidatas en Siigo, ninguna sin dudas
--     (3651 "Melissa Garzon" activa pero con otro correo; 3530 "Zuleyma
--     Valbuena" con el correo exacto de Melissa pero inactiva y otro nombre).
--   - Karina Ríos y Laura Gómez: ninguna cuenta en Siigo les corresponde
--     (revisadas las 29 cuentas registradas). Necesitan usuario propio en
--     Siigo antes de poder mapearlas.
-- Mientras tanto sus facturas seguirán cayendo en el respaldo por defecto.
-- ============================================================================

insert into app_settings (key, value) values
  ('siigo_seller_map', '{"7a772009-9322-45e7-9422-82206592263f": 3565}'::jsonb)
on conflict (key) do update
  set value = coalesce(app_settings.value, '{}'::jsonb) || excluded.value;
