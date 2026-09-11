-- ============================================================================
-- Bodega puede corregir la forma/medio de pago mientras revisa el pedido.
--
-- La vendedora anota lo que el cliente le dijo al tomar el pedido; el
-- comprobante real (adjunto en Comprobantes de pago) es lo que bodega mira
-- para el checklist "Forma de pago correcta" — y ahí a veces se ve que el
-- pago entró por un canal distinto al anotado (p.ej. la vendedora puso
-- "Efectivo" pero el comprobante es de Bancolombia). Hoy no hay forma de
-- corregir eso sin devolver el pedido entero a la vendedora.
--
-- `update_order` no sirve para esto a propósito: reabre cantidades/precios,
-- que es justo lo que la revisión de bodega no debe tocar (0020_edit_order).
-- Esta función es angosta: solo toca payment_method/payment_method_detail,
-- y se permite en cualquier estado previo a facturar — corregir un dato antes
-- de facturar siempre es seguro; después de INVOICING ya no, porque ahí el
-- valor viajó a Siigo.
-- ============================================================================

create or replace function correct_order_payment_method(
  p_order_id uuid,
  p_payment_method text,
  p_payment_method_detail text default null
) returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
  v_actor_id uuid;
  v_role user_role;
begin
  v_actor_id := current_wow_user_id();
  v_role := current_wow_role();
  if v_actor_id is null or v_role not in ('WAREHOUSE', 'SUPERVISOR', 'ADMIN') then
    raise exception 'No autorizado: se requiere rol de bodega, supervisor o admin';
  end if;

  if p_payment_method is null or trim(p_payment_method) = '' then
    raise exception 'La forma de pago es obligatoria';
  end if;

  select * into v_order from orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Pedido no encontrado';
  end if;
  if v_order.status in ('INVOICING', 'INVOICED', 'CANCELLED') then
    raise exception 'Este pedido ya no se puede corregir (estado actual: %)', v_order.status;
  end if;

  update orders set
    payment_method = p_payment_method,
    payment_method_detail = p_payment_method_detail,
    updated_at = now()
  where id = p_order_id
  returning * into v_order;

  insert into customer_activities (customer_id, user_id, activity_type, description, reference_type, reference_id)
  values (
    v_order.customer_id, v_actor_id, 'ORDER_UPDATED',
    'Pedido ' || v_order.order_number || ' — forma de pago corregida al verificar el comprobante',
    'order', v_order.id
  );

  return v_order;
end;
$$;

revoke execute on function correct_order_payment_method(uuid, text, text) from public, anon;
grant execute on function correct_order_payment_method(uuid, text, text) to authenticated;
