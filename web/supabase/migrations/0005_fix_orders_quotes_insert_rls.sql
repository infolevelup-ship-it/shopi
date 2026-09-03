-- quotes_insert y orders_insert (0001_init.sql) dejaban crear a CUALQUIER
-- rol autenticado, incluida bodega: "seller_id = current_wow_user_id()" se
-- cumple sola sin importar el rol, porque seller_id siempre es quien llama.
-- Doc 01 §4.1-4.3: solo SELLER/SUPERVISOR/ADMIN crean cotizaciones y pedidos.
-- Verificado en vivo con una sesión de bodega simulada: bloqueada tras este
-- fix (insufficient_privilege), antes no lo estaba.
drop policy quotes_insert on quotes;
create policy quotes_insert on quotes for insert
  with check (
    current_wow_role() in ('SELLER','SUPERVISOR','ADMIN')
    and (seller_id = current_wow_user_id() or current_wow_role() in ('SUPERVISOR','ADMIN'))
  );

drop policy orders_insert on orders;
create policy orders_insert on orders for insert
  with check (
    current_wow_role() in ('SELLER','SUPERVISOR','ADMIN')
    and (seller_id = current_wow_user_id() or current_wow_role() in ('SUPERVISOR','ADMIN'))
  );
