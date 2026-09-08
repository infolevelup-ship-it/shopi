-- El tipo de retorno cambia (de integer a jsonb), así que no basta un
-- CREATE OR REPLACE.
drop function if exists import_siigo_customers(jsonb);

create or replace function import_siigo_customers(p_customers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_unicos integer;
  v_guardados integer;
begin
  v_actor_id := current_wow_user_id();
  if v_actor_id is null or current_wow_role() <> 'ADMIN' then
    raise exception 'Solo un administrador puede importar clientes';
  end if;

  -- Siigo tiene terceros repetidos con el mismo documento (el mismo NIT dado
  -- de alta dos veces). Postgres rechaza la sentencia entera con "ON CONFLICT
  -- DO UPDATE command cannot affect row a second time" si dos filas de la
  -- misma tanda apuntan al mismo conflicto, así que se deduplica antes.
  --
  -- Se conserva el primero de cada documento en el orden en que Siigo los
  -- entrega, con `with ordinality`: sin ese orden explícito, cuál de los dos
  -- gana sería aleatorio entre una corrida y otra.
  with entrada as (
    select r.*, e.ord
    from jsonb_array_elements(p_customers) with ordinality as e(item, ord)
    cross join lateral jsonb_to_record(e.item) as r(
      siigo_customer_id text, customer_type text, document_type text, document_number text,
      document_number_normalized text, check_digit text, legal_name text, first_name text,
      last_name text, commercial_name text, address text, city text, department text,
      state_code text, city_code text, postal_code text,
      phone_indicative text, phone text, phone_extension text,
      contact_first_name text, contact_last_name text, contact_email text,
      contact_indicative text, contact_phone text,
      vat_responsible boolean, fiscal_responsibilities text[], fiscal_responsibility text,
      status text
    )
  ),
  unicos as (
    select distinct on (document_type, document_number_normalized) *
    from entrada
    order by document_type, document_number_normalized, ord
  ),
  guardado as (
    insert into customers (
      siigo_customer_id, customer_type, document_type, document_number,
      document_number_normalized, check_digit, legal_name, first_name, last_name,
      commercial_name, address, city, department, state_code, city_code, postal_code,
      phone_indicative, phone, phone_extension,
      contact_first_name, contact_last_name, contact_email, contact_indicative, contact_phone,
      vat_responsible, fiscal_responsibilities, fiscal_responsibility, status, source
    )
    select
      u.siigo_customer_id, u.customer_type, u.document_type, u.document_number,
      u.document_number_normalized, u.check_digit, u.legal_name, u.first_name, u.last_name,
      u.commercial_name, u.address, u.city, u.department, u.state_code, u.city_code, u.postal_code,
      u.phone_indicative, u.phone, u.phone_extension,
      u.contact_first_name, u.contact_last_name, u.contact_email, u.contact_indicative, u.contact_phone,
      u.vat_responsible, u.fiscal_responsibilities, u.fiscal_responsibility,
      u.status::customer_status, 'SIIGO'
    from unicos u
    on conflict (document_type, document_number_normalized)
      where merged_into_customer_id is null
    do update set
      -- Siigo manda en los datos fiscales: es la fuente de verdad para facturar.
      siigo_customer_id = excluded.siigo_customer_id,
      legal_name = excluded.legal_name,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      commercial_name = excluded.commercial_name,
      address = excluded.address,
      city = excluded.city,
      department = excluded.department,
      state_code = excluded.state_code,
      city_code = excluded.city_code,
      postal_code = excluded.postal_code,
      check_digit = excluded.check_digit,
      vat_responsible = excluded.vat_responsible,
      fiscal_responsibilities = excluded.fiscal_responsibilities,
      fiscal_responsibility = excluded.fiscal_responsibility,
      updated_at = now()
      -- NO se tocan `responsible_user_id` ni `source`: quién atiende al cliente
      -- es información de la plataforma, no de Siigo, y un cliente creado aquí
      -- no se convierte en "antiguo de Siigo" por aparecer también allá.
    returning 1
  )
  select (select count(*) from unicos), (select count(*) from guardado)
    into v_unicos, v_guardados;

  return jsonb_build_object(
    'guardados', v_guardados,
    'duplicados', jsonb_array_length(p_customers) - v_unicos
  );
end;
$$;

revoke execute on function import_siigo_customers(jsonb) from public, anon;
grant execute on function import_siigo_customers(jsonb) to authenticated;
