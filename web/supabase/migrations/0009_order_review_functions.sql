-- ============================================================================
-- Fase 6 (doc 10 §9) — revisión de bodega: cola, checklist, aprobar, devolver.
-- `orders` sigue sin política de UPDATE (mismo diseño que Fase 4/5) — estas
-- tres funciones SECURITY DEFINER son el único camino para mover el pedido
-- por SUBMITTED/PENDING_REVIEW -> IN_REVIEW -> APPROVED_FOR_INVOICE /
-- RETURNED_TO_SELLER, revalidando rol y estado ellas mismas.
-- ============================================================================

-- Abrir para revisión: SUBMITTED/PENDING_REVIEW -> IN_REVIEW. Idempotente si
-- ya está en revisión (abrir el detalle dos veces no debe fallar).
create or replace function start_order_review(p_order_id uuid) returns orders
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

  select * into v_order from orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Pedido no encontrado';
  end if;

  if v_order.status = 'IN_REVIEW' then
    return v_order;
  end if;

  if v_order.status not in ('SUBMITTED', 'PENDING_REVIEW') then
    raise exception 'Este pedido no está listo para revisión (estado actual: %)', v_order.status;
  end if;

  update orders set
    status = 'IN_REVIEW',
    warehouse_reviewed_by = v_actor_id,
    review_started_at = now()
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

-- Aprobar: exige el checklist completo (doc 01 §16, doc 04 §10) y deja el
-- pedido listo para que el rol autorizado lo facture en Fase 7 — nunca crea
-- factura aquí (doc 01 §18: "la aprobación no crea factura").
create or replace function approve_order_for_invoice(
  p_order_id uuid,
  p_customer_ok boolean,
  p_products_ok boolean,
  p_quantities_ok boolean,
  p_prices_ok boolean,
  p_inventory_ok boolean,
  p_payment_ok boolean,
  p_receipts_ok boolean,
  p_fiscal_data_ok boolean,
  p_printed_receipt boolean,
  p_notes text default null
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

  if not (
    p_customer_ok and p_products_ok and p_quantities_ok and p_prices_ok
    and p_inventory_ok and p_payment_ok and p_receipts_ok and p_fiscal_data_ok
    and p_printed_receipt
  ) then
    raise exception 'No se puede aprobar: falta marcar todos los puntos del checklist';
  end if;

  select * into v_order from orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Pedido no encontrado';
  end if;
  if v_order.status <> 'IN_REVIEW' then
    raise exception 'Solo se puede aprobar un pedido en revisión (estado actual: %)', v_order.status;
  end if;

  insert into order_reviews (
    order_id, reviewed_by, customer_ok, products_ok, quantities_ok, prices_ok,
    inventory_ok, payment_ok, receipts_ok, fiscal_data_ok, printed_receipt,
    status, notes, reviewed_at
  ) values (
    p_order_id, v_actor_id, p_customer_ok, p_products_ok, p_quantities_ok, p_prices_ok,
    p_inventory_ok, p_payment_ok, p_receipts_ok, p_fiscal_data_ok, p_printed_receipt,
    'APPROVED', p_notes, now()
  );

  update orders set
    status = 'APPROVED_FOR_INVOICE',
    approved_by = v_actor_id,
    approved_at = now()
  where id = p_order_id
  returning * into v_order;

  insert into customer_activities (customer_id, user_id, activity_type, description, reference_type, reference_id)
  values (v_order.customer_id, v_actor_id, 'ORDER_UPDATED', 'Pedido ' || v_order.order_number || ' aprobado para facturar', 'order', v_order.id);

  return v_order;
end;
$$;

-- doc 01 §45: la vendedora debe ver el motivo de la devolución en su
-- pedido. `order_reviews` es interno de bodega (RLS no lo expone a
-- SELLER), así que el motivo se duplica en esta columna, visible vía la
-- misma política orders_select que ya usa la vendedora para ver lo suyo.
alter table orders add column return_reason text;

-- Devolver: siempre con motivo (doc 01 §44-45, doc 04 §9). El checklist
-- parcial queda igual guardado, para saber qué faltaba cuando se devolvió.
create or replace function return_order_to_seller(
  p_order_id uuid,
  p_reason text,
  p_customer_ok boolean default false,
  p_products_ok boolean default false,
  p_quantities_ok boolean default false,
  p_prices_ok boolean default false,
  p_inventory_ok boolean default false,
  p_payment_ok boolean default false,
  p_receipts_ok boolean default false,
  p_fiscal_data_ok boolean default false,
  p_printed_receipt boolean default false
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
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'El motivo de la devolución es obligatorio';
  end if;

  select * into v_order from orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Pedido no encontrado';
  end if;
  if v_order.status <> 'IN_REVIEW' then
    raise exception 'Solo se puede devolver un pedido en revisión (estado actual: %)', v_order.status;
  end if;

  insert into order_reviews (
    order_id, reviewed_by, customer_ok, products_ok, quantities_ok, prices_ok,
    inventory_ok, payment_ok, receipts_ok, fiscal_data_ok, printed_receipt,
    status, notes, reviewed_at
  ) values (
    p_order_id, v_actor_id, p_customer_ok, p_products_ok, p_quantities_ok, p_prices_ok,
    p_inventory_ok, p_payment_ok, p_receipts_ok, p_fiscal_data_ok, p_printed_receipt,
    'RETURNED', p_reason, now()
  );

  update orders set status = 'RETURNED_TO_SELLER', return_reason = p_reason where id = p_order_id returning * into v_order;

  insert into customer_activities (customer_id, user_id, activity_type, description, reference_type, reference_id)
  values (v_order.customer_id, v_actor_id, 'ORDER_UPDATED', 'Pedido ' || v_order.order_number || ' devuelto a vendedora: ' || p_reason, 'order', v_order.id);

  return v_order;
end;
$$;

revoke execute on function start_order_review(uuid) from public, anon;
revoke execute on function approve_order_for_invoice(uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, text) from public, anon;
revoke execute on function return_order_to_seller(uuid, text, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function start_order_review(uuid) to authenticated;
grant execute on function approve_order_for_invoice(uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, text) to authenticated;
grant execute on function return_order_to_seller(uuid, text, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;
