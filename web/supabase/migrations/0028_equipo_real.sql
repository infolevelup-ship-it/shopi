-- ============================================================================
-- El equipo real de Productos WOW.
--
-- `users.auth_user_id` es NOT NULL: una fila aquí exige que la persona ya
-- exista en `auth.users`. Los logins se crean en el panel de Supabase
-- (Authentication → Users → Add user, con "Auto Confirm User"), porque la
-- contraseña la elige quien la va a usar, no esta migración.
--
-- Esta función toma a quien ya tenga login y le crea (o actualiza) su ficha
-- con su rol. Es idempotente a propósito: se corre las veces que haga falta,
-- según se vayan creando los logins, y devuelve quién quedó listo y quién no.
--
-- El `ghl_user_id` NO se pone aquí. Los ids de GHL mezclan 1/l y 0/O, y
-- copiarlos de una captura de pantalla es una forma silenciosa de asignarle
-- las oportunidades a otra persona: dos capturas de la misma lista daban
-- `N4xqjZOCrv7DfXk1jOQc` y `N4xqjZOCrv7DfXklj0Qc`. Se vinculan aparte,
-- leyéndolos de la API de GHL y emparejando por correo (Configuración →
-- GoHighLevel → "Vincular usuarias por correo").
--
-- El emparejamiento es por CORREO, nunca por nombre. En esta cuenta existe
-- "Karina Ríos" (usuaria de demostración) y "Karina Noriega" (la jefa
-- comercial): emparejar por nombre le habría dado los pedidos y las facturas
-- de una a la otra.
--
-- Roles según lo definido por el dueño:
--   Ivonne  — dueña                → ADMIN
--   Karina  — vendedora y jefa     → ADMIN (acceso completo)
--   Silvia  — marketing            → ADMIN (mismo acceso que Karina)
--   Ferney  — desarrollo           → ADMIN
--   Melissa — vendedora            → SELLER
--   Sandra  — vendedora            → SELLER
--   Carlos  — logística / bodega   → WAREHOUSE
-- ============================================================================

create or replace function sync_equipo_real()
returns table (correo text, estado text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_equipo jsonb := '[
    {"email":"ivonnedazav@gmail.com",          "name":"Ivonne Daza",     "role":"ADMIN"},
    {"email":"comercialproductoswow@gmail.com","name":"Karina Noriega",  "role":"ADMIN"},
    {"email":"marketingproductoswow@gmail.com","name":"Silvia Lombana",  "role":"ADMIN"},
    {"email":"ferney25898@gmail.com",          "name":"Ferney Aponte",   "role":"ADMIN"},
    {"email":"onlineventasredes@gmail.com",    "name":"Melissa Comercial","role":"SELLER"},
    {"email":"comercialwowbogota@gmail.com",   "name":"Sandra Ayala",    "role":"SELLER"},
    {"email":"logistica@productoswow.com",     "name":"Carlos (Logística)","role":"WAREHOUSE"}
  ]'::jsonb;
  v_p jsonb;
  v_auth uuid;
begin
  if current_wow_role() is distinct from 'ADMIN' then
    raise exception 'Solo un administrador puede sincronizar el equipo';
  end if;

  for v_p in select * from jsonb_array_elements(v_equipo)
  loop
    select id into v_auth from auth.users where lower(email) = lower(v_p->>'email');

    if v_auth is null then
      correo := v_p->>'email';
      estado := 'FALTA EL LOGIN — créalo en Supabase → Authentication → Users';
      return next;
      continue;
    end if;

    insert into users (auth_user_id, name, email, role, active)
    values (v_auth, v_p->>'name', v_p->>'email', (v_p->>'role')::user_role, true)
    on conflict (auth_user_id) do update
      set name = excluded.name,
          email = excluded.email,
          role = excluded.role,
          active = true,
          updated_at = now();

    correo := v_p->>'email';
    estado := 'listo (' || (v_p->>'role') || ')';
    return next;
  end loop;
end;
$$;

revoke execute on function sync_equipo_real() from public, anon;
grant execute on function sync_equipo_real() to authenticated;
