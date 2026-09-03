-- ============================================================================
-- Fase 2 (doc 10 §5) — funciones de backend para clientes.
-- Sigue el patrón "commands vs updates" del doc 03 §9: una operación de
-- negocio es una función nombrada, no INSERTs sueltos desde el cliente.
-- security invoker (default): corre como el usuario que llama, así el RLS
-- de customers/customer_assignments/customer_activities se sigue aplicando
-- de verdad dentro de la función, no se salta nada.
-- ============================================================================

-- Crea un cliente y, en la misma transacción, lo asigna como responsable
-- principal a quien lo crea (doc 01 §5: "vendedora crea cliente → queda
-- asignada") y registra la actividad. Si algo falla, no queda nada a medias.
create or replace function create_customer(
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
  p_city text default null
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
    responsible_user_id, status, source
  ) values (
    p_customer_type, p_document_type, p_document_number, v_document_normalized,
    p_legal_name, p_first_name, p_last_name, p_commercial_name, p_email, p_phone, p_address, p_city,
    v_actor_id, 'ACTIVE', 'WEB'
  ) returning * into v_customer;
  -- Si ya existe un cliente vivo con el mismo document_type + documento
  -- normalizado, el índice único customers_document_uniq revienta el INSERT
  -- aquí mismo — duplicado imposible por diseño, no por disciplina (doc 01 §71).

  insert into customer_assignments (customer_id, user_id, assignment_type, assigned_by)
  values (v_customer.id, v_actor_id, 'PRIMARY_OWNER', v_actor_id);

  insert into customer_activities (customer_id, user_id, activity_type, description)
  values (v_customer.id, v_actor_id, 'NOTE', 'Cliente creado');

  return v_customer;
end;
$$;

-- CREATE FUNCTION otorga EXECUTE a PUBLIC automáticamente, y PUBLIC aplica a
-- todos los roles sin excepción — revocar solo de anon no basta, anon
-- seguiría heredando acceso vía PUBLIC (aprendido con current_wow_role() en
-- 0001_init.sql). Hay que revocar de PUBLIC directamente.
revoke execute on function create_customer(text,text,text,text,text,text,text,text,text,text,text) from public;
grant execute on function create_customer(text,text,text,text,text,text,text,text,text,text,text) to authenticated;
