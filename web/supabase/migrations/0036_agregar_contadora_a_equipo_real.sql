-- ============================================================================
-- "Crear/actualizar fichas del equipo" muestra una lista fija de quiénes
-- son y qué rol tienen — no una consulta en vivo de `users`. Olga Forero
-- (contadora, rol ADMIN) se agregó directamente a la base cuando se creó su
-- ficha, así que quedó activa y funcionando, pero no aparecía en esta
-- pantalla porque no estaba en la lista fija. Se agrega aquí para que de
-- ahora en adelante también salga en el resumen.
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
    {"email":"logistica@productoswow.com",     "name":"Carlos (Logística)","role":"WAREHOUSE"},
    {"email":"contabilidadpwow@gmail.com",     "name":"Olga Forero",     "role":"ADMIN"}
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
