-- ============================================================================
-- Un mensaje que se pueda leer cuando falta la vendedora responsable.
--
-- Decía: «Cliente c981e155-f4cd-… no existe o no tiene responsable asignado».
-- Dos problemas:
--   1. Junta dos causas distintas en una frase, así que no se sabe cuál es.
--   2. Muestra un identificador interno, que no le dice nada a quien lo lee
--      ni sirve para arreglarlo.
--
-- Aparece de verdad: los clientes importados de Siigo llegan sin responsable a
-- propósito (nadie los ha atendido todavía aquí) y `create_order` la exige.
--
-- El reemplazo se hace sobre la definición viva por lo mismo que en la
-- migración 0026: reescribir las 120 líneas del cálculo de totales para
-- cambiar un mensaje es la forma más fácil de meter un error de redondeo.
-- ============================================================================

do $migracion$
declare
  v_nombre text;
  v_def text;
  v_nueva text;
begin
  foreach v_nombre in array array['create_order']
  loop
    select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = v_nombre;

    if v_def is null then
      raise exception 'No existe la función %', v_nombre;
    end if;

    if position('select responsible_user_id into v_responsible_id from customers where id = p_customer_id;' in v_def) = 0 then
      raise exception 'La función % ya no lee el responsable como se esperaba', v_nombre;
    end if;

    v_nueva := replace(
      v_def,
      'select responsible_user_id into v_responsible_id from customers where id = p_customer_id;
  if v_responsible_id is null then
    raise exception ''Cliente % no existe o no tiene responsable asignado'', p_customer_id;
  end if;',
      'select c.responsible_user_id,
         coalesce(c.commercial_name, c.legal_name, nullif(trim(coalesce(c.first_name, '''') || '' '' || coalesce(c.last_name, '''')), ''''), c.document_number)
    into v_responsible_id, v_customer_name
    from customers c where c.id = p_customer_id;

  if not found then
    raise exception ''El cliente de este pedido ya no existe.'';
  end if;

  if v_responsible_id is null then
    raise exception ''El cliente "%" no tiene vendedora responsable. Ábrelo y pulsa "Hacerme responsable" antes de crear el pedido.'', v_customer_name;
  end if;'
    );

    if v_nueva = v_def then
      raise exception 'No se pudo reemplazar el mensaje en %', v_nombre;
    end if;

    v_nueva := replace(v_nueva, '  v_responsible_id uuid;', '  v_responsible_id uuid;' || chr(10) || '  v_customer_name text;');

    execute v_nueva;
  end loop;
end
$migracion$;
