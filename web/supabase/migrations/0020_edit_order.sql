-- ============================================================================
-- Editar un pedido antes de que bodega lo revise (doc 11 §49).
--
-- Dos cosas, y la segunda es un hueco real del flujo:
--
-- 1. `update_order`: reemplaza las líneas y las condiciones de un pedido que
--    todavía es de la vendedora (DRAFT o RETURNED_TO_SELLER) y recalcula los
--    totales con la MISMA aritmética de `create_order`. Va `security definer`
--    porque `orders` no tiene política de UPDATE — todas las transiciones
--    pasan por funciones (doc 03 §9).
--
-- 2. `submit_order` solo aceptaba DRAFT. Es decir: bodega devolvía un pedido
--    para corrección y la vendedora ya no tenía forma de reenviarlo — el
--    pedido quedaba atascado en RETURNED_TO_SELLER para siempre. Sin esto,
--    poder editarlo no sirve de nada.
-- ============================================================================

create or replace function update_order(
  p_order_id uuid,
  p_items jsonb,
  p_payment_method text default null,
  p_retention_percent numeric default 0,
  p_channel text default null,
  p_notes text default null,
  p_document_type text default null,
  p_price_list text default null,
  p_payment_method_detail text default null,
  p_sale_origin text default null
) returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
  v_actor_id uuid;
  v_role user_role;
  v_item jsonb;
  v_product products;
  v_quantity numeric(12,2);
  v_unit_price numeric(14,2);
  v_discount_percent numeric(5,2);
  v_line_subtotal numeric(14,2);
  v_discount_value numeric(14,2);
  v_line_net numeric(14,2);
  v_line_tax numeric(14,2);
  v_subtotal_gross numeric(14,2) := 0;
  v_discount_total numeric(14,2) := 0;
  v_subtotal_net numeric(14,2) := 0;
  v_tax_total numeric(14,2) := 0;
  v_retention_total numeric(14,2) := 0;
  v_grand_total numeric(14,2) := 0;
begin
  v_actor_id := current_wow_user_id();
  v_role := current_wow_role();
  if v_actor_id is null then
    raise exception 'No autorizado: no hay usuario WOW asociado a esta sesión';
  end if;

  select * into v_order from orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Pedido no encontrado';
  end if;
  if v_order.seller_id <> v_actor_id and v_role not in ('SUPERVISOR', 'ADMIN') then
    raise exception 'No autorizado para este pedido';
  end if;

  -- doc 04 §8: editable en DRAFT, SUBMITTED, PENDING_REVIEW y
  -- RETURNED_TO_SELLER. La frontera real es IN_REVIEW: ahí bodega ya lo abrió
  -- y lo está verificando contra el físico, y cambiarle las cantidades por
  -- debajo invalidaría esa revisión. En SUBMITTED/PENDING_REVIEW el pedido
  -- solo está en la cola, nadie lo ha tomado, y la vendedora que ve un error
  -- justo después de enviarlo debe poder corregirlo sin cancelar y rehacer.
  if v_order.status not in ('DRAFT', 'SUBMITTED', 'PENDING_REVIEW', 'RETURNED_TO_SELLER') then
    raise exception 'Este pedido ya no se puede editar (estado actual: %). Bodega lo está revisando o ya se facturó.', v_order.status;
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Un pedido necesita al menos un producto';
  end if;

  -- El cliente NO se cambia aquí a propósito: un pedido para otro cliente es
  -- otro pedido, no una edición de este.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from products where id = (v_item->>'product_id')::uuid;
    if v_product.id is null then
      raise exception 'Producto % no existe', v_item->>'product_id';
    end if;

    v_quantity := (v_item->>'quantity')::numeric;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_discount_percent := coalesce((v_item->>'discount_percent')::numeric, 0);

    if v_quantity <= 0 then
      raise exception 'Cantidad inválida para %', v_product.name;
    end if;

    v_line_subtotal := round(v_unit_price * v_quantity, 2);
    v_discount_value := round(v_line_subtotal * v_discount_percent / 100, 2);
    v_line_net := v_line_subtotal - v_discount_value;
    v_line_tax := round(v_line_net * coalesce(v_product.tax_percent, 0) / 100, 2);

    v_subtotal_gross := v_subtotal_gross + v_line_subtotal;
    v_discount_total := v_discount_total + v_discount_value;
    v_subtotal_net := v_subtotal_net + v_line_net;
    v_tax_total := v_tax_total + v_line_tax;
  end loop;

  v_retention_total := round(v_subtotal_net * coalesce(p_retention_percent, 0) / 100, 2);
  v_grand_total := v_subtotal_net + v_tax_total - v_retention_total;

  -- Se reemplazan todas las líneas en vez de intentar casarlas una a una: la
  -- vendedora puede haber quitado, agregado y cambiado productos, y adivinar
  -- qué línea es "la misma" produciría errores silenciosos en los totales.
  delete from order_items where order_id = p_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from products where id = (v_item->>'product_id')::uuid;

    v_quantity := (v_item->>'quantity')::numeric;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_discount_percent := coalesce((v_item->>'discount_percent')::numeric, 0);

    v_line_subtotal := round(v_unit_price * v_quantity, 2);
    v_discount_value := round(v_line_subtotal * v_discount_percent / 100, 2);
    v_line_net := v_line_subtotal - v_discount_value;
    v_line_tax := round(v_line_net * coalesce(v_product.tax_percent, 0) / 100, 2);

    insert into order_items (
      order_id, product_id, product_code_snapshot, product_name_snapshot,
      quantity, unit_price, discount_percent, discount_value,
      tax_id, tax_percent, unit_code, siigo_product_id,
      line_subtotal, line_tax, line_total
    ) values (
      p_order_id, v_product.id, v_product.code, v_product.name,
      v_quantity, v_unit_price, v_discount_percent, v_discount_value,
      v_product.tax_id, v_product.tax_percent, v_product.unit_code, v_product.siigo_product_id,
      v_line_subtotal, v_line_tax, v_line_net + v_line_tax
    );
  end loop;

  update orders set
    payment_method = p_payment_method,
    payment_method_detail = p_payment_method_detail,
    channel = p_channel,
    notes = p_notes,
    document_type = p_document_type,
    price_list = p_price_list,
    sale_origin = p_sale_origin,
    retention_percent = coalesce(p_retention_percent, 0),
    retention_total = v_retention_total,
    subtotal_gross = v_subtotal_gross,
    discount_total = v_discount_total,
    subtotal_net = v_subtotal_net,
    tax_total = v_tax_total,
    grand_total = v_grand_total,
    updated_at = now()
  where id = p_order_id
  returning * into v_order;

  insert into customer_activities (customer_id, user_id, activity_type, description, reference_type, reference_id)
  values (v_order.customer_id, v_actor_id, 'ORDER_UPDATED',
          'Pedido ' || v_order.order_number || ' editado', 'order', v_order.id);

  return v_order;
end;
$$;

revoke execute on function update_order(uuid,jsonb,text,numeric,text,text,text,text,text,text) from public, anon;
grant execute on function update_order(uuid,jsonb,text,numeric,text,text,text,text,text,text) to authenticated;

-- Un pedido devuelto tiene que poder volver a bodega. Antes solo se aceptaba
-- DRAFT, así que RETURNED_TO_SELLER era un callejón sin salida.
create or replace function submit_order(p_order_id uuid)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
  v_actor_id uuid;
  v_role user_role;
  v_was_returned boolean;
begin
  v_actor_id := current_wow_user_id();
  v_role := current_wow_role();
  if v_actor_id is null then
    raise exception 'No autorizado';
  end if;

  select * into v_order from orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Pedido no encontrado';
  end if;
  if v_order.seller_id <> v_actor_id and v_role not in ('SUPERVISOR', 'ADMIN') then
    raise exception 'No autorizado para este pedido';
  end if;
  if v_order.status not in ('DRAFT', 'RETURNED_TO_SELLER') then
    raise exception 'Solo se puede enviar un pedido en borrador o devuelto (estado actual: %)', v_order.status;
  end if;

  v_was_returned := v_order.status = 'RETURNED_TO_SELLER';

  update orders set status = 'SUBMITTED', submitted_at = now()
  where id = p_order_id returning * into v_order;

  insert into customer_activities (customer_id, user_id, activity_type, description, reference_type, reference_id)
  values (
    v_order.customer_id, v_actor_id, 'ORDER_UPDATED',
    'Pedido ' || v_order.order_number ||
      case when v_was_returned then ' corregido y reenviado a bodega' else ' enviado' end,
    'order', v_order.id
  );

  return v_order;
end;
$$;
