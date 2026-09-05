-- ============================================================================
-- Interruptores de la integración con Siigo (panel de administración).
--
-- Tres cosas que hoy no se pueden controlar sin tocar código ni variables de
-- entorno:
--   1. Un corte de emergencia: dejar de mandar cualquier cosa a Siigo.
--   2. Apagar solo la actualización de inventarios.
--   3. Cambiar el tipo de documento con el que se factura, para poder hacer
--      pruebas contra un documento que NO llega a la DIAN.
--
-- Viven en `app_settings` (que ya existe y solo ADMIN puede escribir) en vez
-- de en variables de entorno, porque una variable de entorno exige un
-- redespliegue: en una urgencia eso son minutos en los que se siguen mandando
-- documentos.
-- ============================================================================

create or replace function set_app_setting(p_key text, p_value jsonb)
returns app_settings
language plpgsql
-- `security definer` porque `audit_logs` no tiene política de INSERT (mismo
-- hueco que ya apareció en quotes, attachments y prospects): desde una función
-- invoker el registro de auditoría no daría error, simplemente no escribiría
-- nada. La función valida el rol ADMIN ella misma.
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_row app_settings;
begin
  v_actor_id := current_wow_user_id();
  if v_actor_id is null or current_wow_role() <> 'ADMIN' then
    raise exception 'Solo un administrador puede cambiar la configuración';
  end if;

  -- Validación de forma. Sin esto, guardar el texto "true" en vez del
  -- booleano true dejaría un interruptor que se ve encendido en pantalla y
  -- no apaga nada: exactamente el tipo de error que un corte de emergencia
  -- no puede permitirse.
  if p_key like '%_enabled' and jsonb_typeof(p_value) <> 'boolean' then
    raise exception '% debe ser true o false, no %', p_key, jsonb_typeof(p_value);
  end if;

  if p_key = 'siigo_invoice_document_id' and jsonb_typeof(p_value) <> 'number' then
    raise exception 'siigo_invoice_document_id debe ser un número';
  end if;

  insert into app_settings (key, value, updated_by, updated_at)
  values (p_key, p_value, v_actor_id, now())
  on conflict (key) do update
    set value = excluded.value,
        updated_by = excluded.updated_by,
        updated_at = now()
  returning * into v_row;

  -- Queda en la bitácora: quién apagó la integración y cuándo es justo lo que
  -- se pregunta después de un incidente.
  insert into audit_logs (user_id, action, entity_type, entity_id, context)
  values (v_actor_id, 'APP_SETTING_CHANGED', 'app_setting', v_row.id,
          jsonb_build_object('key', p_key, 'value', p_value));

  return v_row;
end;
$$;

revoke execute on function set_app_setting(text, jsonb) from public, anon;
grant execute on function set_app_setting(text, jsonb) to authenticated;
