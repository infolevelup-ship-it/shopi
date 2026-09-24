-- ============================================================================
-- Reasignar un cliente a otra vendedora (mejora pedida por el equipo,
-- 2026-09-24). `claim_customer` (migración 0023) ya deja el hueco anotado en
-- su propio comentario: "quitárselo a otra vendedora es una reasignación,
-- que es una decisión de supervisión y otra operación" — esta función es
-- exactamente esa operación, separada a propósito.
--
-- Solo ADMIN (así se pidió explícitamente) puede reasignar, y solo hacia una
-- vendedora activa (rol SELLER) — nunca a ciegas: ocultar el selector en la
-- pantalla no es seguridad, la regla vive aquí también.
-- ============================================================================

create or replace function reassign_customer(
  p_customer_id uuid,
  p_new_seller_id uuid,
  p_reason text default null
)
returns customers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_customer customers;
  v_previous_seller_id uuid;
  v_new_seller users;
begin
  if current_wow_role() is distinct from 'ADMIN' then
    raise exception 'Solo un administrador puede reasignar clientes';
  end if;
  v_actor_id := current_wow_user_id();

  select * into v_customer from customers where id = p_customer_id;
  if v_customer.id is null then
    raise exception 'El cliente no existe';
  end if;
  v_previous_seller_id := v_customer.responsible_user_id;

  select * into v_new_seller from users where id = p_new_seller_id;
  if v_new_seller.id is null then
    raise exception 'La vendedora no existe';
  end if;
  if v_new_seller.role <> 'SELLER' then
    raise exception 'Solo se puede reasignar a una vendedora';
  end if;
  if v_new_seller.active is not true then
    raise exception 'Esa vendedora está desactivada';
  end if;

  update customers set responsible_user_id = p_new_seller_id, updated_at = now()
  where id = p_customer_id
  returning * into v_customer;

  -- Historial de dueños del cliente, mismo patrón que claim_customer.
  insert into customer_assignments (customer_id, user_id, assignment_type, assigned_by, reason)
  values (p_customer_id, p_new_seller_id, 'PRIMARY_OWNER', v_actor_id, p_reason);

  insert into customer_activities (customer_id, user_id, activity_type, description)
  values (
    p_customer_id,
    v_actor_id,
    'OTHER',
    'Reasignado a ' || v_new_seller.name || case when p_reason is not null then ' — ' || p_reason else '' end
  );

  insert into audit_logs (user_id, action, entity_type, entity_id, context)
  values (
    v_actor_id,
    'CUSTOMER_REASSIGNED',
    'customer',
    p_customer_id,
    jsonb_build_object(
      'previous_seller_id', v_previous_seller_id,
      'new_seller_id', p_new_seller_id,
      'new_seller_name', v_new_seller.name,
      'reason', p_reason
    )
  );

  return v_customer;
end;
$$;

revoke execute on function reassign_customer(uuid, uuid, text) from public, anon;
grant execute on function reassign_customer(uuid, uuid, text) to authenticated;
