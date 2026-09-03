-- ============================================================================
-- Fase 5 (doc 10 §8) — pedidos: consecutivo, creación con cálculo completo
-- (IVA, descuento, retención) en el servidor, envío y cancelación.
-- ============================================================================

create sequence if not exists order_number_seq;

create or replace function next_order_number() returns text
language sql
set search_path = public
as $$
  select 'WOW-P-' || lpad(nextval('order_number_seq')::text, 7, '0');
$$;
revoke execute on function next_order_number() from public, anon;
grant execute on function next_order_number() to authenticated;

-- Crea el pedido y sus líneas en una sola transacción. Retención (doc 01,
-- fórmula del formulario legacy): "retención_línea = round(neto*ret%/100,2)"
-- sumada por línea — como order_items no tiene columna de retención por
-- línea (doc 02 §11 no la define), se aplica un único % de retención sobre
-- el neto total del pedido, igual que el dropdown único del formulario
-- anterior. total_a_pagar = Σ(neto+iva) − retención, fórmula exacta del
-- README original.
--
-- Igual que create_quote (Fase 4): NUNCA hace UPDATE sobre `orders` después
-- de insertar — esa tabla tiene RLS sin política de UPDATE a propósito, y
-- un UPDATE ahí no daría error, simplemente no afectaría ninguna fila.
-- Todos los totales se calculan antes del único INSERT.
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

  -- Primera pasada: validar y sumar, sin escribir nada todavía.
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
    subtotal_gross, discount_total, subtotal_net, tax_total, retention_total, grand_total
  ) values (
    next_order_number(), p_customer_id, v_actor_id, v_responsible_id,
    p_channel, 'DRAFT', p_payment_method, p_notes,
    v_subtotal_gross, v_discount_total, v_subtotal_net, v_tax_total, v_retention_total, v_grand_total
  ) returning * into v_order;

  -- Segunda pasada: ahora sí insertar las líneas, con order_id ya real.
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

revoke execute on function create_order(uuid, jsonb, text, numeric, text, text) from public, anon;
grant execute on function create_order(uuid, jsonb, text, numeric, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Transiciones: orders tiene RLS sin política de UPDATE a propósito (mismo
-- diseño que quotes) — estas SECURITY DEFINER son el único camino.
-- ----------------------------------------------------------------------------

-- Enviar: DRAFT -> SUBMITTED. La vendedora termina aquí su parte; el paso a
-- PENDIENTE DE REVISIÓN / EN REVISIÓN es del rol de bodega (Fase 6, todavía
-- no construida) — no lo hace esta función.
create or replace function submit_order(p_order_id uuid) returns orders
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
  if v_order.status <> 'DRAFT' then
    raise exception 'Solo se puede enviar un pedido en borrador (estado actual: %)', v_order.status;
  end if;

  update orders set status = 'SUBMITTED', submitted_at = now() where id = p_order_id returning * into v_order;

  insert into customer_activities (customer_id, user_id, activity_type, description, reference_type, reference_id)
  values (v_order.customer_id, v_actor_id, 'ORDER_UPDATED', 'Pedido ' || v_order.order_number || ' enviado', 'order', v_order.id);

  return v_order;
end;
$$;

-- Cancelar: nunca se borra (doc 01 §46). Una vendedora solo puede cancelar
-- mientras el pedido sigue siendo suyo para editar (DRAFT/SUBMITTED);
-- supervisor/admin pueden cancelar en cualquier estado no terminal.
create or replace function cancel_order(p_order_id uuid, p_reason text) returns orders
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
  if v_actor_id is null then
    raise exception 'No autorizado';
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'El motivo de cancelación es obligatorio';
  end if;

  select * into v_order from orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Pedido no encontrado';
  end if;
  if v_order.seller_id <> v_actor_id and v_role not in ('SUPERVISOR', 'ADMIN') then
    raise exception 'No autorizado para este pedido';
  end if;
  if v_role = 'SELLER' and v_order.status not in ('DRAFT', 'SUBMITTED') then
    raise exception 'Este pedido ya está en revisión — pide a un supervisor que lo cancele (estado actual: %)', v_order.status;
  end if;
  if v_order.status in ('INVOICED', 'DISPATCHED', 'DELIVERED', 'CANCELLED') then
    raise exception 'Este pedido ya no puede cancelarse (estado actual: %)', v_order.status;
  end if;

  update orders set
    status = 'CANCELLED',
    cancelled_at = now(),
    cancelled_by = v_actor_id,
    cancellation_reason = p_reason
  where id = p_order_id
  returning * into v_order;

  insert into customer_activities (customer_id, user_id, activity_type, description, reference_type, reference_id)
  values (v_order.customer_id, v_actor_id, 'ORDER_UPDATED', 'Pedido ' || v_order.order_number || ' cancelado: ' || p_reason, 'order', v_order.id);

  return v_order;
end;
$$;

revoke execute on function submit_order(uuid) from public, anon;
revoke execute on function cancel_order(uuid, text) from public, anon;
grant execute on function submit_order(uuid) to authenticated;
grant execute on function cancel_order(uuid, text) to authenticated;
