-- ============================================================================
-- Importar los clientes que ya existen en Siigo.
--
-- Se hace con función y no con un upsert de PostgREST porque el índice único
-- de `customers` es parcial:
--
--   customers_document_uniq on (document_type, document_number_normalized)
--     where merged_into_customer_id is null
--
-- PostgREST no sabe mandar ese `where` en el ON CONFLICT, así que un
-- `.upsert({ onConflict: "document_type,document_number_normalized" })`
-- fallaría en tiempo de ejecución ("no unique or exclusion constraint
-- matching the ON CONFLICT specification"). La función escribe el predicado.
--
-- Además `customers` no tiene política de UPDATE: desde el navegador un
-- UPDATE no daría error, simplemente afectaría 0 filas. De ahí el
-- `security definer`, con la validación de ADMIN hecha a mano.
-- ============================================================================

create or replace function import_siigo_customers(p_customers jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_insertados integer;
begin
  v_actor_id := current_wow_user_id();
  if v_actor_id is null or current_wow_role() <> 'ADMIN' then
    raise exception 'Solo un administrador puede importar clientes';
  end if;

  insert into customers (
    siigo_customer_id, customer_type, document_type, document_number,
    document_number_normalized, check_digit, legal_name, first_name, last_name,
    commercial_name, address, city, department, state_code, city_code, postal_code,
    phone_indicative, phone, phone_extension,
    contact_first_name, contact_last_name, contact_email, contact_indicative, contact_phone,
    vat_responsible, fiscal_responsibilities, fiscal_responsibility, status, source
  )
  select
    r.siigo_customer_id, r.customer_type, r.document_type, r.document_number,
    r.document_number_normalized, r.check_digit, r.legal_name, r.first_name, r.last_name,
    r.commercial_name, r.address, r.city, r.department, r.state_code, r.city_code, r.postal_code,
    r.phone_indicative, r.phone, r.phone_extension,
    r.contact_first_name, r.contact_last_name, r.contact_email, r.contact_indicative, r.contact_phone,
    r.vat_responsible, r.fiscal_responsibilities, r.fiscal_responsibility,
    r.status::customer_status, 'SIIGO'
  from jsonb_to_recordset(p_customers) as r(
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
  ;

  get diagnostics v_insertados = row_count;
  return v_insertados;
end;
$$;

revoke execute on function import_siigo_customers(jsonb) from public, anon;
grant execute on function import_siigo_customers(jsonb) to authenticated;
