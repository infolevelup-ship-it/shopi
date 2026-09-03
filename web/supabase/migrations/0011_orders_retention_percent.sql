-- Fase 7/8: para facturar hace falta saber CUÁL % de retención se aplicó
-- (para elegir el id de Retefuente correcto en Siigo, doc 06 §14) — hasta
-- ahora create_order() solo guardaba el monto ya calculado (retention_total),
-- no el porcentaje. Sin esto, facturar tendría que adivinar el % dividiendo
-- montos ya redondeados, frágil y ambiguo en el caso 0%.
alter table orders add column retention_percent numeric(5,2) not null default 0;

create or replace function create_order(
  p_customer_id uuid,
  p_items jsonb,        -- [{product_id, quantity, unit_price, discount_percent}]
  p_payment_method text default null,
  p_retention_percent numeric default 0,
  p_channel text default null,
  p_notes text default null
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
    channel, status, payment_method, notes,
    subtotal_gross, discount_total, subtotal_net, tax_total, retention_percent, retention_total, grand_total
  ) values (
    next_order_number(), p_customer_id, v_actor_id, v_responsible_id,
    p_channel, 'DRAFT', p_payment_method, p_notes,
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
