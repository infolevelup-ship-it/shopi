-- ============================================================================
-- Editar clientes, y hacerse responsable de uno importado.
--
-- `customers` no tiene política de UPDATE (mismo patrón que quotes, orders,
-- attachments, prospects, products): desde el cliente un UPDATE no daría
-- error, simplemente no afectaría ninguna fila. Por eso va como función
-- `security definer` que revalida rol y pertenencia.
--
-- Y `create_order` exige que el cliente tenga responsable. Los clientes
-- traídos de Siigo llegan sin ninguno — nadie los ha atendido todavía en la
-- plataforma —, así que sin `claim_customer` quedarían inservibles: visibles
-- pero incapaces de recibir un pedido.
-- ============================================================================

create or replace function update_customer(
  p_customer_id uuid,
  p_legal_name text default null,
  p_first_name text default null,
  p_last_name text default null,
  p_commercial_name text default null,
  p_email text default null,
  p_phone text default null,
  p_address text default null,
  p_city text default null,
  p_check_digit text default null,
  p_branch_code text default null,
  p_department text default null,
  p_state_code text default null,
  p_city_code text default null,
  p_postal_code text default null,
  p_fiscal_responsibilities text[] default null,
  p_vat_responsible boolean default null,
  p_phone_indicative text default null,
  p_phone_extension text default null,
  p_contact_first_name text default null,
  p_contact_last_name text default null,
  p_contact_email text default null,
  p_contact_indicative text default null,
  p_contact_phone text default null,
  p_purchase_type text default null,
  p_customer_type_classification text default null,
  p_channel text default null,
  p_credit_limit numeric default null,
  p_website_social text default null,
  p_birthday date default null
) returns customers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_role user_role;
  v_customer customers;
  v_responsibilities text[];
begin
  v_actor_id := current_wow_user_id();
  v_role := current_wow_role();
  if v_actor_id is null then
    raise exception 'No autorizado: no hay usuario WOW asociado a esta sesión';
  end if;

  select * into v_customer from customers where id = p_customer_id;
  if v_customer.id is null then
    raise exception 'El cliente no existe';
  end if;

  -- La vendedora responsable, supervisión, o cualquiera si el cliente todavía
  -- no tiene responsable (caso de los importados de Siigo).
  if v_role not in ('SUPERVISOR', 'ADMIN')
     and v_customer.responsible_user_id is not null
     and v_customer.responsible_user_id <> v_actor_id then
    raise exception 'Este cliente es responsabilidad de otra vendedora';
  end if;

  -- El documento NO se edita aquí a propósito: cambiarlo convierte al cliente
  -- en otro cliente distinto, y rompería el emparejamiento con Siigo y con el
  -- histórico de facturas. Para eso está la fusión de duplicados.
  v_responsibilities := coalesce(nullif(p_fiscal_responsibilities, '{}'),
                                 v_customer.fiscal_responsibilities,
                                 array['R-99-PN']);

  update customers set
    legal_name = p_legal_name,
    first_name = p_first_name,
    last_name = p_last_name,
    commercial_name = p_commercial_name,
    email = p_email,
    phone = p_phone,
    address = p_address,
    city = p_city,
    check_digit = p_check_digit,
    branch_code = p_branch_code,
    department = p_department,
    state_code = p_state_code,
    city_code = p_city_code,
    postal_code = p_postal_code,
    fiscal_responsibilities = v_responsibilities,
    fiscal_responsibility = v_responsibilities[1],
    vat_responsible = p_vat_responsible,
    phone_indicative = p_phone_indicative,
    phone_extension = p_phone_extension,
    contact_first_name = p_contact_first_name,
    contact_last_name = p_contact_last_name,
    contact_email = p_contact_email,
    contact_indicative = p_contact_indicative,
    contact_phone = p_contact_phone,
    purchase_type = p_purchase_type,
    customer_type_classification = p_customer_type_classification,
    channel = p_channel,
    credit_limit = p_credit_limit,
    website_social = p_website_social,
    birthday = p_birthday,
    updated_at = now()
  where id = p_customer_id
  returning * into v_customer;

  insert into customer_activities (customer_id, user_id, activity_type, description)
  values (p_customer_id, v_actor_id, 'NOTE', 'Datos del cliente actualizados');

  return v_customer;
end;
$$;

revoke execute on function update_customer(uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text[],boolean,text,text,text,text,text,text,text,text,text,text,numeric,text,date) from public, anon;
grant execute on function update_customer(uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text[],boolean,text,text,text,text,text,text,text,text,text,text,numeric,text,date) to authenticated;

-- Un cliente importado de Siigo llega sin responsable. `create_order` lo
-- exige, así que sin esto quedaría visible pero incapaz de recibir un pedido.
create or replace function claim_customer(p_customer_id uuid)
returns customers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_role user_role;
  v_customer customers;
begin
  v_actor_id := current_wow_user_id();
  v_role := current_wow_role();
  if v_actor_id is null then
    raise exception 'No autorizado';
  end if;

  select * into v_customer from customers where id = p_customer_id;
  if v_customer.id is null then
    raise exception 'El cliente no existe';
  end if;

  -- Solo se puede tomar un cliente sin dueño. Quitárselo a otra vendedora es
  -- una reasignación, que es una decisión de supervisión y otra operación.
  if v_customer.responsible_user_id is not null then
    if v_role not in ('SUPERVISOR', 'ADMIN') then
      raise exception 'Este cliente ya tiene vendedora responsable';
    end if;
  end if;

  update customers set responsible_user_id = v_actor_id, updated_at = now()
  where id = p_customer_id returning * into v_customer;

  insert into customer_assignments (customer_id, user_id, assignment_type, assigned_by)
  values (p_customer_id, v_actor_id, 'PRIMARY_OWNER', v_actor_id);

  insert into customer_activities (customer_id, user_id, activity_type, description)
  values (p_customer_id, v_actor_id, 'NOTE', 'Cliente tomado como responsable');

  return v_customer;
end;
$$;

revoke execute on function claim_customer(uuid) from public, anon;
grant execute on function claim_customer(uuid) to authenticated;
