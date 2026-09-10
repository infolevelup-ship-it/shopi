-- ============================================================================
-- Dos correcciones a la integración con Siigo, confirmadas contra la API
-- real (2026-09-10, por otra sesión con acceso real a la cuenta):
--
-- 1. `id_type` va como string plano al ESCRIBIR (POST/PUT), no como objeto.
--    Siigo lo devuelve como objeto al leer ({"code":"13","name":"Cédula..."})
--    — de ahí que se hubiera tipado igual para escribir, por simetría con la
--    lectura. Pero al escribir rechaza el objeto con "el campo id_type es
--    obligatorio", aunque sí vaya en el cuerpo. El cambio de código (en
--    web/src/lib/siigo/client.ts y types.ts) ya corrige esto; esta migración
--    solo agrega la columna que hace falta para el segundo punto.
--
-- 2. `branch_office` se mandaba siempre en 0 al actualizar un tercero, sin
--    saber cuál era el real. Para un tercero cuya sucursal real no es 0, eso
--    equivale a pedirle a Siigo que la cambie, y Siigo puede tratarla como
--    parte del identificador y rechazar la escritura entera.
--
-- La columna es nullable: null significa "no se sabe" (clientes creados en
-- WOW antes de este cambio, o nunca sincronizados) y en ese caso se sigue
-- usando 0, que es lo correcto para un tercero que nunca ha existido en
-- Siigo.
-- ============================================================================

alter table customers add column if not exists siigo_branch_office integer;

comment on column customers.siigo_branch_office is
  'Sucursal (branch_office) del tercero en Siigo, tal como la devuelve la API al leerlo. Null si nunca se ha confirmado contra Siigo — en ese caso se asume 0 al escribir.';

-- import_siigo_customers pasa a guardar también la sucursal, para que un
-- cliente traído de Siigo llegue listo para editarse sin depender de que
-- antes alguien lo sincronice a mano.
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

  with entrada as (
    select r.*, e.ord
    from jsonb_array_elements(p_customers) with ordinality as e(item, ord)
    cross join lateral jsonb_to_record(e.item) as r(
      siigo_customer_id text, siigo_branch_office integer,
      customer_type text, document_type text, document_number text,
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
      siigo_customer_id, siigo_branch_office, customer_type, document_type, document_number,
      document_number_normalized, check_digit, legal_name, first_name, last_name,
      commercial_name, address, city, department, state_code, city_code, postal_code,
      phone_indicative, phone, phone_extension,
      contact_first_name, contact_last_name, contact_email, contact_indicative, contact_phone,
      vat_responsible, fiscal_responsibilities, fiscal_responsibility, status, source
    )
    select
      u.siigo_customer_id, u.siigo_branch_office, u.customer_type, u.document_type, u.document_number,
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
      siigo_customer_id = excluded.siigo_customer_id,
      siigo_branch_office = excluded.siigo_branch_office,
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
