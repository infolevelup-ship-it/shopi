-- ============================================================================
-- Fase 4 (doc 10 §7) — cotizaciones: consecutivo, creación con líneas
-- calculadas en el servidor, y transiciones de estado.
-- ============================================================================

-- Consecutivo interno (doc 01 §41): generado en backend, nunca por el
-- cliente. Formato WOW-C-0000001.
create sequence if not exists quote_number_seq;

create or replace function next_quote_number() returns text
language sql
set search_path = public
as $$
  select 'WOW-C-' || lpad(nextval('quote_number_seq')::text, 7, '0');
$$;
revoke execute on function next_quote_number() from public, anon;
grant execute on function next_quote_number() to authenticated;

-- Crea la cotización y sus líneas en una sola transacción, con los totales
-- calculados aquí — nunca confiar en un total armado en el navegador
-- (doc 03 §10). Cada línea recalcula: subtotal, descuento, neto, IVA, total.
-- security invoker (default): las políticas quotes_insert/quote_items_insert
-- ya existentes se siguen aplicando de verdad.
--
-- IMPORTANTE — encontrado probando contra el proyecto real: esta función
-- NUNCA hace UPDATE sobre `quotes`. La tabla tiene RLS encendido sin
-- ninguna política de UPDATE a propósito (las transiciones de estado son
-- exclusivas de send_quote/mark_quote_accepted/mark_quote_lost, que sí son
-- SECURITY DEFINER). Un UPDATE aquí no da error: silenciosamente no afecta
-- ninguna fila (0 rows matched por RLS) y deja los totales en 0 sin avisar
-- — así se detectó, verificando el flujo completo contra datos reales, no
-- solo revisando que el SQL compilara. Por eso los totales se calculan
-- ANTES del único INSERT en quotes, nunca después con un UPDATE.
create or replace function create_quote(
  p_customer_id uuid,
  p_items jsonb,        -- [{product_id, quantity, unit_price, discount_percent}]
  p_price_list text default null,
  p_notes text default null,
  p_valid_until date default null
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
  v_grand_total numeric(14,2) := 0;
begin
  v_actor_id := current_wow_user_id();
  if v_actor_id is null then
    raise exception 'No autorizado: no hay usuario WOW asociado a esta sesión';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Una cotización necesita al menos un producto';
  end if;

  -- Primera pasada: validar todos los productos y sumar los totales, sin
  -- escribir nada todavía (si un producto no existe, no queda una
  -- cotización huérfana a medio armar).
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

  insert into quotes (
    quote_number, customer_id, seller_id, status, price_list, notes, valid_until,
    subtotal, discount_total, tax_total, grand_total
  ) values (
    next_quote_number(), p_customer_id, v_actor_id, 'DRAFT', p_price_list, p_notes, p_valid_until,
    v_subtotal, v_discount_total, v_tax_total, v_grand_total
  ) returning * into v_quote;

  -- Segunda pasada: ahora sí insertar las líneas, con quote_id ya real.
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
-- Endurecimiento defensivo (misma lección de 0001/0002): aunque no es
-- SECURITY DEFINER y por tanto el advisor no la marca, anon nunca debe poder
-- invocarla sin sesión real.
revoke execute on function create_quote(uuid, jsonb, text, text, date) from public, anon;
grant execute on function create_quote(uuid, jsonb, text, text, date) to authenticated;

-- ----------------------------------------------------------------------------
-- Transiciones de estado: no hay política de UPDATE en quotes a propósito.
-- Estas funciones SECURITY DEFINER son el único camino para cambiar estado —
-- revalidan rol + estado actual ellas mismas antes de mutar (mismo patrón ya
-- documentado para orders en 0001_init.sql §24).
-- ----------------------------------------------------------------------------

create or replace function send_quote(p_quote_id uuid) returns quotes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote quotes;
  v_actor_id uuid;
  v_role user_role;
begin
  v_actor_id := current_wow_user_id();
  v_role := current_wow_role();
  if v_actor_id is null then
    raise exception 'No autorizado';
  end if;

  select * into v_quote from quotes where id = p_quote_id;
  if v_quote.id is null then
    raise exception 'Cotización no encontrada';
  end if;
  if v_quote.seller_id <> v_actor_id and v_role not in ('SUPERVISOR', 'ADMIN') then
    raise exception 'No autorizado para esta cotización';
  end if;
  if v_quote.status <> 'DRAFT' then
    raise exception 'Solo se puede enviar una cotización en borrador (estado actual: %)', v_quote.status;
  end if;

  update quotes set status = 'SENT', sent_at = now() where id = p_quote_id returning * into v_quote;

  insert into customer_activities (customer_id, user_id, activity_type, description, reference_type, reference_id)
  values (v_quote.customer_id, v_actor_id, 'QUOTE_SENT', 'Cotización ' || v_quote.quote_number || ' enviada', 'quote', v_quote.id);

  return v_quote;
end;
$$;

create or replace function mark_quote_accepted(p_quote_id uuid) returns quotes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote quotes;
  v_actor_id uuid;
  v_role user_role;
begin
  v_actor_id := current_wow_user_id();
  v_role := current_wow_role();
  if v_actor_id is null then
    raise exception 'No autorizado';
  end if;

  select * into v_quote from quotes where id = p_quote_id;
  if v_quote.id is null then
    raise exception 'Cotización no encontrada';
  end if;
  if v_quote.seller_id <> v_actor_id and v_role not in ('SUPERVISOR', 'ADMIN') then
    raise exception 'No autorizado para esta cotización';
  end if;
  if v_quote.status not in ('SENT', 'FOLLOW_UP') then
    raise exception 'Solo una cotización enviada puede aceptarse (estado actual: %)', v_quote.status;
  end if;

  update quotes set status = 'ACCEPTED', accepted_at = now() where id = p_quote_id returning * into v_quote;

  insert into customer_activities (customer_id, user_id, activity_type, description, reference_type, reference_id)
  values (v_quote.customer_id, v_actor_id, 'QUOTE_WON', 'Cotización ' || v_quote.quote_number || ' aceptada', 'quote', v_quote.id);

  return v_quote;
end;
$$;

create or replace function mark_quote_lost(p_quote_id uuid, p_reason text) returns quotes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote quotes;
  v_actor_id uuid;
  v_role user_role;
begin
  v_actor_id := current_wow_user_id();
  v_role := current_wow_role();
  if v_actor_id is null then
    raise exception 'No autorizado';
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'El motivo de pérdida es obligatorio';
  end if;

  select * into v_quote from quotes where id = p_quote_id;
  if v_quote.id is null then
    raise exception 'Cotización no encontrada';
  end if;
  if v_quote.seller_id <> v_actor_id and v_role not in ('SUPERVISOR', 'ADMIN') then
    raise exception 'No autorizado para esta cotización';
  end if;
  if v_quote.status in ('CONVERTED', 'LOST', 'CANCELLED') then
    raise exception 'Esta cotización ya está cerrada (estado actual: %)', v_quote.status;
  end if;

  update quotes set status = 'LOST', lost_at = now(), lost_reason = p_reason where id = p_quote_id returning * into v_quote;

  insert into customer_activities (customer_id, user_id, activity_type, description, reference_type, reference_id)
  values (v_quote.customer_id, v_actor_id, 'QUOTE_LOST', 'Cotización ' || v_quote.quote_number || ' perdida: ' || p_reason, 'quote', v_quote.id);

  return v_quote;
end;
$$;

-- Las 3 funciones SECURITY DEFINER no deben quedar como RPC público (mismo
-- ajuste que current_wow_role en 0001). Supabase otorga EXECUTE a
-- anon/authenticated/service_role como grants propios al crear la función,
-- no solo por herencia de PUBLIC — hay que revocar de los dos, revocar solo
-- de PUBLIC no basta (confirmado en vivo: quedó anon con acceso hasta
-- revocarlo explícito).
revoke execute on function send_quote(uuid) from public, anon;
revoke execute on function mark_quote_accepted(uuid) from public, anon;
revoke execute on function mark_quote_lost(uuid, text) from public, anon;
grant execute on function send_quote(uuid) to authenticated;
grant execute on function mark_quote_accepted(uuid) to authenticated;
grant execute on function mark_quote_lost(uuid, text) to authenticated;
