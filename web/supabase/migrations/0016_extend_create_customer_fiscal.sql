-- create_customer con la ficha fiscal completa que capturaba el formulario
-- legado (doc 11 §25/§63). Se hace DROP + CREATE en vez de CREATE OR REPLACE:
-- agregar parámetros crea una sobrecarga nueva, y dos versiones con
-- parámetros nombrados serían ambiguas para PostgREST.
drop function if exists create_customer(text,text,text,text,text,text,text,text,text,text,text);

create function create_customer(
  p_customer_type text,
  p_document_type text,
  p_document_number text,
  p_legal_name text default null,
  p_first_name text default null,
  p_last_name text default null,
  p_commercial_name text default null,
  p_email text default null,
  p_phone text default null,
  p_address text default null,
  p_city text default null,
  -- ficha fiscal / facturación
  p_check_digit text default null,
  p_branch_code text default null,
  p_department text default null,
  p_state_code text default null,
  p_city_code text default null,
  p_postal_code text default null,
  p_fiscal_responsibility text default null,
  p_vat_responsible boolean default null,
  -- persona de contacto del salón
  p_phone_indicative text default null,
  p_contact_first_name text default null,
  p_contact_last_name text default null,
  p_contact_email text default null,
  p_contact_phone text default null,
  -- clasificación comercial
  p_purchase_type text default null,
  p_customer_type_classification text default null,
  p_channel text default null,
  p_credit_limit numeric default null,
  p_website_social text default null,
  p_birthday date default null
) returns customers
language plpgsql
set search_path = public
as $$
declare
  v_customer customers;
  v_actor_id uuid;
  v_document_normalized text;
begin
  v_actor_id := current_wow_user_id();
  if v_actor_id is null then
    raise exception 'No autorizado: no hay usuario WOW asociado a esta sesión';
  end if;

  if p_customer_type not in ('natural', 'juridica') then
    raise exception 'customer_type inválido: %', p_customer_type;
  end if;

  v_document_normalized := regexp_replace(p_document_number, '\D', '', 'g');
  if v_document_normalized = '' then
    raise exception 'document_number sin dígitos válidos: %', p_document_number;
  end if;

  insert into customers (
    customer_type, document_type, document_number, document_number_normalized,
    legal_name, first_name, last_name, commercial_name, email, phone, address, city,
    check_digit, branch_code, department, state_code, city_code, postal_code,
    fiscal_responsibility, vat_responsible,
    phone_indicative, contact_first_name, contact_last_name, contact_email, contact_phone,
    purchase_type, customer_type_classification, channel, credit_limit, website_social, birthday,
    responsible_user_id, status, source
  ) values (
    p_customer_type, p_document_type, p_document_number, v_document_normalized,
    p_legal_name, p_first_name, p_last_name, p_commercial_name, p_email, p_phone, p_address, p_city,
    p_check_digit, p_branch_code, p_department, p_state_code, p_city_code, p_postal_code,
    p_fiscal_responsibility, p_vat_responsible,
    p_phone_indicative, p_contact_first_name, p_contact_last_name, p_contact_email, p_contact_phone,
    p_purchase_type, p_customer_type_classification, p_channel, p_credit_limit, p_website_social, p_birthday,
    v_actor_id, 'ACTIVE', 'WEB'
  ) returning * into v_customer;

  insert into customer_assignments (customer_id, user_id, assignment_type, assigned_by)
  values (v_customer.id, v_actor_id, 'PRIMARY_OWNER', v_actor_id);

  insert into customer_activities (customer_id, user_id, activity_type, description)
  values (v_customer.id, v_actor_id, 'NOTE', 'Cliente creado');

  return v_customer;
end;
$$;

revoke execute on function create_customer(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,boolean,text,text,text,text,text,text,text,text,numeric,text,date) from public, anon;
grant execute on function create_customer(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,boolean,text,text,text,text,text,text,text,text,numeric,text,date) to authenticated;
