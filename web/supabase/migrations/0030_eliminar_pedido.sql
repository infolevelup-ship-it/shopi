-- ============================================================================
-- Eliminar un pedido de verdad (solo ADMIN).
--
-- Cancelar deja el pedido a la vista, que es lo correcto para una venta que se
-- cayó. Pero para limpiar pruebas hace falta que desaparezca: si no, la lista
-- termina llena de pedidos que nadie hizo y las cifras de los reportes salen
-- mal.
--
-- El candado: un pedido que ya pasó por facturación NO se elimina. Borrarlo
-- aquí no borra la factura en Siigo — dejaría un documento fiscal sin nada que
-- lo explique, que es peor que tener un pedido de más.
--
-- Solo `order_items` tiene borrado en cascada; el resto de tablas que apuntan
-- al pedido son NO ACTION, así que un DELETE directo fallaría siempre (el
-- historial de estados nunca está vacío). Por eso se limpian en orden.
-- ============================================================================

create or replace function delete_order(p_order_id uuid, p_reason text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
  v_numero text;
  v_facturas int;
  v_intentos int;
begin
  if current_wow_role() is distinct from 'ADMIN' then
    raise exception 'Solo un administrador puede eliminar pedidos';
  end if;

  select * into v_order from orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Pedido no encontrado';
  end if;

  select count(*) into v_facturas from invoices where order_id = p_order_id;
  select count(*) into v_intentos from invoice_operations where order_id = p_order_id;

  if v_facturas > 0 or v_intentos > 0 or v_order.status in ('INVOICED', 'INVOICING') then
    raise exception
      'El pedido % ya pasó por facturación, así que no se elimina. Si fue un error, anúlalo en Siigo y cancela el pedido aquí.',
      v_order.order_number;
  end if;

  v_numero := v_order.order_number;

  delete from order_status_history where order_id = p_order_id;
  delete from order_reviews where order_id = p_order_id;
  delete from payments where order_id = p_order_id;
  delete from shipments where order_id = p_order_id;

  -- Estas dos referencian por (tipo, id) y no por llave foránea, así que no
  -- bloquean el borrado — pero dejarlas convertiría el historial del cliente
  -- en enlaces a un pedido que ya no existe.
  delete from attachments where entity_type = 'order' and entity_id = p_order_id;
  delete from customer_activities where reference_type = 'order' and reference_id = p_order_id;

  -- Si el pedido salió de una cotización, esta vuelve a quedar disponible: si
  -- no, quedaría marcada como convertida apuntando a un pedido borrado y no se
  -- podría volver a convertir nunca.
  update quotes
     set converted_order_id = null,
         status = 'ACCEPTED',
         updated_at = now()
   where converted_order_id = p_order_id;

  delete from order_items where order_id = p_order_id;
  delete from orders where id = p_order_id;

  -- El pedido desaparece, pero que alguien lo borró no: es lo único que queda
  -- para explicar un consecutivo que se salta.
  insert into audit_logs (user_id, action, entity_type, entity_id, context)
  values (current_wow_user_id(), 'ORDER_DELETED', 'order', p_order_id,
          jsonb_build_object(
            'order_number', v_numero,
            'status', v_order.status,
            'grand_total', v_order.grand_total,
            'customer_id', v_order.customer_id,
            'reason', p_reason));

  return v_numero;
end;
$$;

revoke execute on function delete_order(uuid, text) from public, anon;
grant execute on function delete_order(uuid, text) to authenticated;
