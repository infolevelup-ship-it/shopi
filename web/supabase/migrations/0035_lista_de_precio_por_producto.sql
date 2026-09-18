-- ============================================================================
-- Lista de precio por producto, no por pedido completo.
--
-- Hasta ahora `orders.price_list` era una sola lista para TODO el pedido:
-- cambiar el selector de arriba re-tarifaba cada línea ya agregada. El
-- negocio necesita poder mezclar: un mismo cliente (p. ej. una estilista
-- recurrente) puede llevarse un producto a precio Salón como atención y otro
-- a precio Profesional en la misma compra.
--
-- `order_items.price_list` guarda la lista que se usó de verdad en CADA
-- línea. `orders.price_list` se conserva: sigue siendo el valor por defecto
-- con el que arranca un pedido nuevo (y lo que ya había en pedidos viejos).
-- No hace falta tocar la factura de Siigo: `buildSiigoInvoicePayload` ya usa
-- el `unit_price` de cada línea, que ya viene resuelto con la lista correcta
-- desde aquí — nunca dependió de una sola lista por pedido.
-- ============================================================================

alter table order_items add column price_list text;

create or replace function public.create_order(p_customer_id uuid, p_items jsonb, p_payment_method text DEFAULT NULL::text, p_retention_percent numeric DEFAULT 0, p_channel text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_document_type text DEFAULT NULL::text, p_price_list text DEFAULT NULL::text, p_payment_method_detail text DEFAULT NULL::text, p_sale_origin text DEFAULT NULL::text)
 RETURNS orders
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_order orders;
  v_actor_id uuid;
  v_responsible_id uuid;
  v_customer_name text;
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
  v_subtotal_gross numeric(14,2) := 0;
  v_discount_total numeric(14,2) := 0;
  v_subtotal_net numeric(14,2) := 0;
  v_tax_total numeric(14,2) := 0;
  v_retention_total numeric(14,2) := 0;
  v_grand_total numeric(14,2) := 0;
  -- Cada línea puede traer su propia lista; si no trae ninguna, se usa la
  -- del pedido (p_price_list), que a su vez cae a 'publico' dentro de
  -- catalog_unit_price.
  v_item_price_list text;
begin
  v_actor_id := current_wow_user_id();
  if v_actor_id is null then
    raise exception 'No autorizado: no hay usuario WOW asociado a esta sesión';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Un pedido necesita al menos un producto';
  end if;

  select c.responsible_user_id,
         coalesce(c.commercial_name, c.legal_name, nullif(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), ''), c.document_number)
    into v_responsible_id, v_customer_name
    from customers c where c.id = p_customer_id;

  if not found then
    raise exception 'El cliente de este pedido ya no existe.';
  end if;

  if v_responsible_id is null then
    raise exception 'El cliente "%" no tiene vendedora responsable. Ábrelo y pulsa "Hacerme responsable" antes de crear el pedido.', v_customer_name;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from products where id = (v_item->>'product_id')::uuid;
    if v_product.id is null then
      raise exception 'Producto % no existe', v_item->>'product_id';
    end if;

    v_quantity := (v_item->>'quantity')::numeric;
    v_item_price_list := coalesce(v_item->>'price_list', p_price_list);
    v_unit_price := catalog_unit_price(v_product, v_item_price_list);
    v_discount_percent := coalesce((v_item->>'discount_percent')::numeric, 0);

    if v_quantity <= 0 then
      raise exception 'Cantidad inválida para %', v_product.name;
    end if;

    v_line_subtotal := round(v_unit_price * v_quantity, 2);
    v_discount_value := round(v_line_subtotal * v_discount_percent / 100, 2);
    v_line_net := v_line_subtotal - v_discount_value;
    v_line_tax := round(v_line_net * coalesce(v_product.tax_percent, 0) / 100, 2);
    v_line_total := v_line_net + v_line_tax;

    v_subtotal_gross := v_subtotal_gross + v_line_subtotal;
    v_discount_total := v_discount_total + v_discount_value;
    v_subtotal_net := v_subtotal_net + v_line_net;
    v_tax_total := v_tax_total + v_line_tax;
  end loop;

  v_retention_total := round(v_subtotal_net * coalesce(p_retention_percent, 0) / 100, 2);
  v_grand_total := v_subtotal_net + v_tax_total - v_retention_total;

  insert into orders (
    order_number, customer_id, seller_id, responsible_customer_owner_id,
    channel, status, payment_method, payment_method_detail, notes,
    document_type, price_list, sale_origin,
    subtotal_gross, discount_total, subtotal_net, tax_total, retention_percent, retention_total, grand_total
  ) values (
    next_order_number(), p_customer_id, v_actor_id, v_responsible_id,
    p_channel, 'DRAFT', p_payment_method, p_payment_method_detail, p_notes,
    p_document_type, p_price_list, p_sale_origin,
    v_subtotal_gross, v_discount_total, v_subtotal_net, v_tax_total, coalesce(p_retention_percent, 0), v_retention_total, v_grand_total
  ) returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from products where id = (v_item->>'product_id')::uuid;

    v_quantity := (v_item->>'quantity')::numeric;
    v_item_price_list := coalesce(v_item->>'price_list', p_price_list);
    v_unit_price := catalog_unit_price(v_product, v_item_price_list);
    v_discount_percent := coalesce((v_item->>'discount_percent')::numeric, 0);

    v_line_subtotal := round(v_unit_price * v_quantity, 2);
    v_discount_value := round(v_line_subtotal * v_discount_percent / 100, 2);
    v_line_net := v_line_subtotal - v_discount_value;
    v_line_tax := round(v_line_net * coalesce(v_product.tax_percent, 0) / 100, 2);
    v_line_total := v_line_net + v_line_tax;

    insert into order_items (
      order_id, product_id, product_code_snapshot, product_name_snapshot,
      quantity, unit_price, discount_percent, discount_value,
      tax_id, tax_percent, unit_code, siigo_product_id, price_list,
      line_subtotal, line_tax, line_total
    ) values (
      v_order.id, v_product.id, v_product.code, v_product.name,
      v_quantity, v_unit_price, v_discount_percent, v_discount_value,
      v_product.tax_id, v_product.tax_percent, v_product.unit_code, v_product.siigo_product_id, v_item_price_list,
      v_line_subtotal, v_line_tax, v_line_total
    );
  end loop;

  insert into customer_activities (customer_id, user_id, activity_type, description, reference_type, reference_id)
  values (p_customer_id, v_actor_id, 'ORDER_CREATED', 'Pedido ' || v_order.order_number || ' creado', 'order', v_order.id);

  return v_order;
end;
$function$;

create or replace function public.update_order(p_order_id uuid, p_items jsonb, p_payment_method text DEFAULT NULL::text, p_retention_percent numeric DEFAULT 0, p_channel text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_document_type text DEFAULT NULL::text, p_price_list text DEFAULT NULL::text, p_payment_method_detail text DEFAULT NULL::text, p_sale_origin text DEFAULT NULL::text)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_item_price_list text;
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

  if v_order.status not in ('DRAFT', 'SUBMITTED', 'PENDING_REVIEW', 'RETURNED_TO_SELLER') then
    raise exception 'Este pedido ya no se puede editar (estado actual: %). Bodega lo está revisando o ya se facturó.', v_order.status;
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Un pedido necesita al menos un producto';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from products where id = (v_item->>'product_id')::uuid;
    if v_product.id is null then
      raise exception 'Producto % no existe', v_item->>'product_id';
    end if;

    v_quantity := (v_item->>'quantity')::numeric;
    v_item_price_list := coalesce(v_item->>'price_list', p_price_list);
    v_unit_price := catalog_unit_price(v_product, v_item_price_list);
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

  delete from order_items where order_id = p_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from products where id = (v_item->>'product_id')::uuid;

    v_quantity := (v_item->>'quantity')::numeric;
    v_item_price_list := coalesce(v_item->>'price_list', p_price_list);
    v_unit_price := catalog_unit_price(v_product, v_item_price_list);
    v_discount_percent := coalesce((v_item->>'discount_percent')::numeric, 0);

    v_line_subtotal := round(v_unit_price * v_quantity, 2);
    v_discount_value := round(v_line_subtotal * v_discount_percent / 100, 2);
    v_line_net := v_line_subtotal - v_discount_value;
    v_line_tax := round(v_line_net * coalesce(v_product.tax_percent, 0) / 100, 2);

    insert into order_items (
      order_id, product_id, product_code_snapshot, product_name_snapshot,
      quantity, unit_price, discount_percent, discount_value,
      tax_id, tax_percent, unit_code, siigo_product_id, price_list,
      line_subtotal, line_tax, line_total
    ) values (
      p_order_id, v_product.id, v_product.code, v_product.name,
      v_quantity, v_unit_price, v_discount_percent, v_discount_value,
      v_product.tax_id, v_product.tax_percent, v_product.unit_code, v_product.siigo_product_id, v_item_price_list,
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
$function$;
