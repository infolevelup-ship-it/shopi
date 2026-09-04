-- create_order / create_quote con los campos que capturaba el formulario
-- legado y aquí no llegaban a la base: tipo de documento, lista de precio,
-- medio de pago real (por dónde entró la plata) y origen de la venta.
-- Los cálculos NO cambian: son los mismos verificados en la Fase 5
-- (400.000 − 40.000 + 68.400 − 9.000 = 419.400).
-- DROP + CREATE por la misma razón que create_customer: agregar parámetros
-- crearía una sobrecarga ambigua para PostgREST.
drop function if exists create_order(uuid,jsonb,text,numeric,text,text);

create function create_order(
  p_customer_id uuid,
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
set search_path = public
as $$
declare
  v_order orders;
  v_actor_id uuid;
  v_responsible_id uuid;
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
begin
  v_actor_id := current_wow_user_id();
  if v_actor_id is null then
    raise exception 'No autorizado: no hay usuario WOW asociado a esta sesión';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Un pedido necesita al menos un producto';
  end if;

  select responsible_user_id into v_responsible_id from customers where id = p_customer_id;
  if v_responsible_id is null then
    raise exception 'Cliente % no existe o no tiene responsable asignado', p_customer_id;
  end if;

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
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_discount_percent := coalesce((v_item->>'discount_percent')::numeric, 0);

    v_line_subtotal := round(v_unit_price * v_quantity, 2);
    v_discount_value := round(v_line_subtotal * v_discount_percent / 100, 2);
    v_line_net := v_line_subtotal - v_discount_value;
    v_line_tax := round(v_line_net * coalesce(v_product.tax_percent, 0) / 100, 2);
    v_line_total := v_line_net + v_line_tax;

    insert into order_items (
      order_id, product_id, product_code_snapshot, product_name_snapshot,
      quantity, unit_price, discount_percent, discount_value,
      tax_id, tax_percent, unit_code, siigo_product_id,
      line_subtotal, line_tax, line_total
    ) values (
      v_order.id, v_product.id, v_product.code, v_product.name,
      v_quantity, v_unit_price, v_discount_percent, v_discount_value,
      v_product.tax_id, v_product.tax_percent, v_product.unit_code, v_product.siigo_product_id,
      v_line_subtotal, v_line_tax, v_line_total
    );
  end loop;

  insert into customer_activities (customer_id, user_id, activity_type, description, reference_type, reference_id)
  values (p_customer_id, v_actor_id, 'ORDER_CREATED', 'Pedido ' || v_order.order_number || ' creado', 'order', v_order.id);

  return v_order;
end;
$$;

revoke execute on function create_order(uuid,jsonb,text,numeric,text,text,text,text,text,text) from public, anon;
grant execute on function create_order(uuid,jsonb,text,numeric,text,text,text,text,text,text) to authenticated;

-- La cotización queda como entidad propia (no como "tipo de documento" del
-- pedido), pero con la misma retención para que el total que ve el cliente
-- sea el mismo que va a pagar.
drop function if exists create_quote(uuid,jsonb,text,text,date);

create function create_quote(
  p_customer_id uuid,
  p_items jsonb,
  p_price_list text default null,
  p_notes text default null,
  p_valid_until date default null,
  p_retention_percent numeric default 0,
  p_payment_method text default null
) returns quotes
language plpgsql
set search_path = public
as $$
declare
  v_quote quotes;
  v_actor_id uuid;
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
  if v_actor_id is null then
    raise exception 'No autorizado: no hay usuario WOW asociado a esta sesión';
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
    v_unit_price := (v_item->>'unit_price')::numeric;
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

  -- misma fórmula que el pedido: la retención se aplica sobre el neto
  -- (subtotal menos descuentos), nunca sobre el total con IVA.
  v_retention_total := round((v_subtotal - v_discount_total) * coalesce(p_retention_percent, 0) / 100, 2);
  v_grand_total := v_grand_total - v_retention_total;

  insert into quotes (
    quote_number, customer_id, seller_id, status, price_list, notes, valid_until,
    payment_method, retention_percent, retention_total,
    subtotal, discount_total, tax_total, grand_total
  ) values (
    next_quote_number(), p_customer_id, v_actor_id, 'DRAFT', p_price_list, p_notes, p_valid_until,
    p_payment_method, coalesce(p_retention_percent, 0), v_retention_total,
    v_subtotal, v_discount_total, v_tax_total, v_grand_total
  ) returning * into v_quote;

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
    v_line_total := v_line_net + v_line_tax;

    insert into quote_items (
      quote_id, product_id, product_code_snapshot, product_name_snapshot,
      quantity, unit_price, discount_percent, discount_value,
      tax_id, tax_percent, line_subtotal, line_tax, line_total
    ) values (
      v_quote.id, v_product.id, v_product.code, v_product.name,
      v_quantity, v_unit_price, v_discount_percent, v_discount_value,
      v_product.tax_id, v_product.tax_percent, v_line_subtotal, v_line_tax, v_line_total
    );
  end loop;

  insert into customer_activities (customer_id, user_id, activity_type, description, reference_type, reference_id)
  values (p_customer_id, v_actor_id, 'QUOTE_CREATED', 'Cotización ' || v_quote.quote_number || ' creada', 'quote', v_quote.id);

  return v_quote;
end;
$$;

revoke execute on function create_quote(uuid,jsonb,text,text,date,numeric,text) from public, anon;
grant execute on function create_quote(uuid,jsonb,text,text,date,numeric,text) to authenticated;
