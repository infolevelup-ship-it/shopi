-- ============================================================================
-- Lista de precio "Tienda": negociada a mano, solo ADMIN/SUPERVISOR.
--
-- Público, Profesional y Salón viven en el catálogo (`products.price_*`) y
-- 0026 blindó que el precio lo pone el catálogo, no el navegador. "Tienda" es
-- distinta por diseño: es un precio que se negocia caso por caso con el
-- cliente, así que no tiene (ni debe tener) columna en `products`. No hay
-- forma de que el servidor "calcule" ese precio — tiene que recibirlo de
-- quien arma el pedido.
--
-- Eso reabre justo el hueco que 0026 cerró, así que la excepción se controla
-- en el mismo lugar que cualquier otra regla de negocio sensible de esta
-- base: adentro de la función SQL, no en la pantalla (mismo patrón que
-- `delete_order`, 0030: esconder el botón no es una restricción).
--
-- `resolve_unit_price` es el único punto por el que puede entrar un precio
-- escrito a mano:
--   - Para cualquier lista que no sea 'tienda', delega en `catalog_unit_price`
--     tal cual funcionaba antes. Cero cambio de comportamiento ahí.
--   - Para 'tienda', exige que quien ejecuta la función sea ADMIN o
--     SUPERVISOR (si no, nunca se guarda nada) y exige que el precio que
--     llegue en el item sea un número de al menos $1.000 — el mismo piso que
--     ya usa la pantalla (`PRECIO_MINIMO_CREIBLE` en precios.ts) para avisar
--     de precios sospechosos. Una factura electrónica por un precio mal
--     tecleado solo se corrige con nota crédito, así que acá sí bloquea en
--     vez de solo avisar.
--
-- `create_order`, `update_order`, `create_quote` y `update_quote` se
-- reescriben completos (no con el parche de texto que usó 0026) porque además
-- de cambiar la llamada a `catalog_unit_price` hace falta agregar `v_role` a
-- dos de ellas (`create_order` y `create_quote` no lo tenían declarado). Las
-- definiciones de abajo son copia exacta de lo que corre hoy en producción
-- (tomada con `pg_get_functiondef`), con esos dos cambios puntuales.
-- ============================================================================

create or replace function resolve_unit_price(p_product products, p_price_list text, p_item jsonb, p_role user_role)
returns numeric
language plpgsql
immutable
as $$
declare
  v_precio numeric(14,2);
begin
  if p_price_list = 'tienda' then
    if p_role is null or p_role not in ('ADMIN', 'SUPERVISOR') then
      raise exception 'Solo un administrador o supervisor puede vender con la lista "Tienda".';
    end if;

    v_precio := (p_item->>'unit_price')::numeric;
    if v_precio is null or v_precio < 1000 then
      raise exception
        'El precio de "Tienda" para "%" (%) se escribe a mano y debe ser de al menos $1.000. Revísalo antes de guardar.',
        p_product.name, p_product.code;
    end if;

    return v_precio;
  end if;

  return catalog_unit_price(p_product, p_price_list);
end;
$$;

revoke execute on function resolve_unit_price(products, text, jsonb, user_role) from public, anon;
grant execute on function resolve_unit_price(products, text, jsonb, user_role) to authenticated;

-- ----------------------------------------------------------------------------
-- create_order: agrega v_role (no existía) y usa resolve_unit_price.
-- ----------------------------------------------------------------------------
create or replace function public.create_order(p_customer_id uuid, p_items jsonb, p_payment_method text DEFAULT NULL::text, p_retention_percent numeric DEFAULT 0, p_channel text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_document_type text DEFAULT NULL::text, p_price_list text DEFAULT NULL::text, p_payment_method_detail text DEFAULT NULL::text, p_sale_origin text DEFAULT NULL::text)
 RETURNS orders
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_order orders;
  v_actor_id uuid;
  v_role user_role;
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
  v_role := current_wow_role();
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
    v_unit_price := resolve_unit_price(v_product, v_item_price_list, v_item, v_role);
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
    v_unit_price := resolve_unit_price(v_product, v_item_price_list, v_item, v_role);
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

-- ----------------------------------------------------------------------------
-- update_order: ya tenía v_role; solo cambian las dos llamadas de precio.
-- ----------------------------------------------------------------------------
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
    v_unit_price := resolve_unit_price(v_product, v_item_price_list, v_item, v_role);
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
    v_unit_price := resolve_unit_price(v_product, v_item_price_list, v_item, v_role);
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

-- ----------------------------------------------------------------------------
-- create_quote: agrega v_role (no existía) y usa resolve_unit_price. La lista
-- es una sola para toda la cotización (no hay selector por línea como en
-- pedidos), así que p_price_list se evalúa igual en cada vuelta del loop.
-- ----------------------------------------------------------------------------
create or replace function public.create_quote(p_customer_id uuid, p_items jsonb, p_price_list text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_valid_until date DEFAULT NULL::date, p_retention_percent numeric DEFAULT 0, p_payment_method text DEFAULT NULL::text)
 RETURNS quotes
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
    v_unit_price := resolve_unit_price(v_product, p_price_list, v_item, v_role);
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
    v_unit_price := resolve_unit_price(v_product, p_price_list, v_item, v_role);
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
$function$;

-- ----------------------------------------------------------------------------
-- update_quote: ya tenía v_role; solo cambian las dos llamadas de precio.
-- ----------------------------------------------------------------------------
create or replace function public.update_quote(p_quote_id uuid, p_items jsonb, p_price_list text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_valid_until date DEFAULT NULL::date, p_retention_percent numeric DEFAULT 0, p_payment_method text DEFAULT NULL::text)
 RETURNS quotes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    v_unit_price := resolve_unit_price(v_product, p_price_list, v_item, v_role);
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

  v_retention_total := round((v_subtotal - v_discount_total) * coalesce(p_retention_percent, 0) / 100, 2);
  v_grand_total := v_grand_total - v_retention_total;

  delete from quote_items where quote_id = p_quote_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from products where id = (v_item->>'product_id')::uuid;

    v_quantity := (v_item->>'quantity')::numeric;
    v_unit_price := resolve_unit_price(v_product, p_price_list, v_item, v_role);
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
$function$;
