-- log_order_status_change() (0001_init.sql) usaba
-- coalesce(auth.uid(), new.seller_id) para "changed_by" — pero changed_by
-- referencia users(id) (el id interno de WOW), no auth.users(id) (lo que
-- devuelve auth.uid()). Son dos espacios de ID distintos.
--
-- Nunca falló en las pruebas de la Fase 1 porque esas corrieron sin sesión
-- JWT simulada (auth.uid() = null ahí, caía a seller_id por coincidencia).
-- En la Fase 5, con una sesión real simulada, auth.uid() devolvía un id de
-- auth.users que no existe en users -> violaba la FK de changed_by.
create or replace function log_order_status_change() returns trigger as $$
begin
  if old.status is distinct from new.status then
    insert into order_status_history (order_id, from_status, to_status, changed_by, created_at)
    values (new.id, old.status, new.status, coalesce(current_wow_user_id(), new.seller_id), now());
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
