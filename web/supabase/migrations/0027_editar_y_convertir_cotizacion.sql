-- ============================================================================
-- Editar una cotización y pasarla a pedido.
--
-- El caso real: se cotiza, a los días el cliente confirma pero pide agregar
-- algo o quitar algo. Hasta ahora la vendedora tenía que teclear el pedido
-- entero de nuevo, y la cotización quedaba en "Aceptada" para siempre, sin
-- ningún vínculo con la venta que salió de ella.
--
-- La base ya venía preparada: `quotes.converted_order_id` y el estado
-- 'CONVERTED' existían desde el principio, sin usar.
--
-- Sobre el precio: `create_order` ya toma el precio del catálogo (migración
-- 0026), así que el pedido sale con el precio de hoy, no con el cotizado. La
-- pantalla compara y avisa cuáles cambiaron antes de convertir.
-- ============================================================================

-- El enum de actividades tenía QUOTE_CREATED/SENT/WON/LOST pero no la edición.
-- Sin esto, `update_quote` fallaría al escribir el historial del cliente.
alter type activity_type add value if not exists 'QUOTE_UPDATED';

-- `quotes` y `quote_items` no tienen política de UPDATE ni DELETE — desde el
-- navegador un update no daría error, simplemente no afectaría ninguna fila.
-- De ahí el security definer, con la validación de dueño hecha a mano.
create or replace function update_quote(
  p_quote_id uuid,
  p_items jsonb,
  p_price_list text default null,
  p_notes text default null,
  p_valid_until date default null,
  p_retention_percent numeric default 0,
  p_payment_method text default null
) returns quotes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote quotes;
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
  v_line_total numeric(14,2);
  v_subtotal numeric(14,2) := 0;
  v_discount_total numeric(14,2) := 0;
  v_tax_total numeric(14,2) := 0;
  v_retention_total numeric(14,2) := 0;
  v_grand_total numeric(14,2) := 0;
begin
  v_actor_id := current_wow_user_id();
  v_role := current_wow_role();
  if v_actor_id is null then
    raise exception 'No autorizado: no hay usuario WOW asociado a esta sesión';
  end if;

  select * into v_quote from quotes where id = p_quote_id;
  if v_quote.id is null then
    raise exception 'Cotización no encontrada';
  end if;
  if v_quote.seller_id <> v_actor_id and v_role not in ('SUPERVISOR', 'ADMIN') then
    raise exception 'No autorizado para esta cotización';
  end if;

  -- Una cotización ya convertida es el respaldo de un pedido que existe:
  -- cambiarla haría que el papel que firmó el cliente y la venta dejaran de
  -- coincidir. Perdida o vencida tampoco: para eso se hace una nueva.
  if v_quote.status not in ('DRAFT', 'SENT', 'FOLLOW_UP', 'ACCEPTED') then
    raise exception 'Esta cotización ya no se puede editar (estado actual: %)', v_quote.status;
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Una cotización necesita al menos un producto';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from products where id = (v_item->>'product_id')::uuid;
    if v_product.id is null then
      raise exception 'Producto % no existe', v_item->>'product_id';
    end if;

    v_quantity := (v_item->>'quantity')::numeric;
    v_unit_price := catalog_unit_price(v_product, p_price_list);
    v_discount_percent := coalesce((v_item->>'discount_percent')::numeric, 0);

    if v_quantity <= 0 then
      raise exception 'Cantidad inválida para %', v_product.name;
    end if;

    v_line_subtotal := round(v_unit_price * v_quantity, 2);
    v_discount_value := round(v_line_subtotal * v_discount_percent / 100, 2);
    v_line_net := v_line_subtotal - v_discount_value;
    v_line_tax := round(v_line_net * coalesce(v_product.tax_percent, 0) / 100, 2);
    v_line_total := v_line_net + v_line_tax;

    v_subtotal := v_subtotal + v_line_subtotal;
    v_discount_total := v_discount_total + v_discount_value;
    v_tax_total := v_tax_total + v_line_tax;
    v_grand_total := v_grand_total + v_line_total;
  end loop;

  -- Misma fórmula que create_quote y que el pedido: la retención se aplica
  -- sobre el neto (subtotal menos descuentos), nunca sobre el total con IVA.
  v_retention_total := round((v_subtotal - v_discount_total) * coalesce(p_retention_percent, 0) / 100, 2);
  v_grand_total := v_grand_total - v_retention_total;

  delete from quote_items where quote_id = p_quote_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from products where id = (v_item->>'product_id')::uuid;

    v_quantity := (v_item->>'quantity')::numeric;
    v_unit_price := catalog_unit_price(v_product, p_price_list);
    v_discount_percent := coalesce((v_item->>'discount_percent')::numeric, 0);

    v_line_subtotal := round(v_unit_price * v_quantity, 2);
    v_discount_value := round(v_line_subtotal * v_discount_percent / 100, 2);
    v_line_net := v_line_subtotal - v_discount_value;
    v_line_tax := round(v_line_net * coalesce(v_product.tax_percent, 0) / 100, 2);
    v_line_total := v_line_net + v_line_tax;

    insert into quote_items (
      quote_id, product_id, product_code_snapshot, product_name_snapshot,
      quantity, unit_price, discount_percent, discount_value,
      tax_id, tax_percent, line_subtotal, line_tax, line_total
    ) values (
      p_quote_id, v_product.id, v_product.code, v_product.name,
      v_quantity, v_unit_price, v_discount_percent, v_discount_value,
      v_product.tax_id, v_product.tax_percent, v_line_subtotal, v_line_tax, v_line_total
    );
  end loop;

  update quotes set
    price_list = p_price_list,
    notes = p_notes,
    valid_until = p_valid_until,
    payment_method = p_payment_method,
    retention_percent = coalesce(p_retention_percent, 0),
    retention_total = v_retention_total,
    subtotal = v_subtotal,
    discount_total = v_discount_total,
    tax_total = v_tax_total,
    grand_total = v_grand_total,
    updated_at = now()
  where id = p_quote_id
  returning * into v_quote;

  insert into customer_activities (customer_id, user_id, activity_type, description, reference_type, reference_id)
  values (v_quote.customer_id, v_actor_id, 'QUOTE_UPDATED',
          'Cotización ' || v_quote.quote_number || ' editada', 'quote', v_quote.id);

  return v_quote;
end;
$$;

revoke execute on function update_quote(uuid, jsonb, text, text, date, numeric, text) from public, anon;
grant execute on function update_quote(uuid, jsonb, text, text, date, numeric, text) to authenticated;


-- Pasar la cotización a pedido. Se apoya en create_order en vez de repetir el
-- cálculo de totales: un segundo sitio donde se calculen IVA y retención es un
-- sitio donde pueden dejar de coincidir.
create or replace function convert_quote_to_order(
  p_quote_id uuid,
  p_payment_method text default null,
  p_payment_method_detail text default null,
  p_channel text default null,
  p_sale_origin text default null,
  p_document_type text default null
) returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote quotes;
  v_actor_id uuid;
  v_role user_role;
  v_items jsonb;
  v_order orders;
  v_numero text;
begin
  v_actor_id := current_wow_user_id();
  v_role := current_wow_role();
  if v_actor_id is null then
    raise exception 'No autorizado: no hay usuario WOW asociado a esta sesión';
  end if;

  select * into v_quote from quotes where id = p_quote_id;
  if v_quote.id is null then
    raise exception 'Cotización no encontrada';
  end if;
  if v_quote.seller_id <> v_actor_id and v_role not in ('SUPERVISOR', 'ADMIN') then
    raise exception 'No autorizado para esta cotización';
  end if;

  -- Convertir dos veces crearía dos pedidos por la misma venta, y el segundo
  -- descontaría inventario que nadie pidió. El mensaje dice cuál fue el
  -- pedido para que la vendedora lo abra en vez de volver a intentarlo.
  if v_quote.converted_order_id is not null then
    select order_number into v_numero from orders where id = v_quote.converted_order_id;
    raise exception 'Esta cotización ya es el pedido %', coalesce(v_numero, '(eliminado)');
  end if;

  if v_quote.status in ('LOST', 'CANCELLED', 'EXPIRED') then
    raise exception 'Una cotización en estado % no se puede pasar a pedido', v_quote.status;
  end if;

  select jsonb_agg(
           jsonb_build_object(
             'product_id', qi.product_id,
             'quantity', qi.quantity,
             -- create_order lo ignora y usa el catálogo; va para que el JSON
             -- sea legible en los logs y no parezca que falta un dato.
             'unit_price', qi.unit_price,
             'discount_percent', qi.discount_percent
           )
           order by qi.created_at
         )
    into v_items
    from quote_items qi
   where qi.quote_id = p_quote_id
     and qi.product_id is not null;

  if v_items is null then
    raise exception 'La cotización no tiene productos que se puedan pedir';
  end if;

  v_order := create_order(
    p_customer_id => v_quote.customer_id,
    p_items => v_items,
    p_payment_method => coalesce(p_payment_method, v_quote.payment_method),
    p_retention_percent => v_quote.retention_percent,
    p_channel => p_channel,
    p_notes => v_quote.notes,
    p_document_type => p_document_type,
    p_price_list => v_quote.price_list,
    p_payment_method_detail => p_payment_method_detail,
    p_sale_origin => p_sale_origin
  );

  update quotes set
    status = 'CONVERTED',
    converted_order_id = v_order.id,
    accepted_at = coalesce(accepted_at, now()),
    updated_at = now()
  where id = p_quote_id;

  insert into customer_activities (customer_id, user_id, activity_type, description, reference_type, reference_id)
  values (v_quote.customer_id, v_actor_id, 'ORDER_CREATED',
          'Cotización ' || v_quote.quote_number || ' pasada al pedido ' || v_order.order_number,
          'order', v_order.id);

  return v_order;
end;
$$;

revoke execute on function convert_quote_to_order(uuid, text, text, text, text, text) from public, anon;
grant execute on function convert_quote_to_order(uuid, text, text, text, text, text) to authenticated;
