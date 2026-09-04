-- ============================================================================
-- Prospectos: registro de visitas y avance de etapa (doc 01 §12).
--
-- La tabla `prospects` existe desde la Fase 1 con políticas de SELECT e
-- INSERT, pero **sin política de UPDATE**: es el mismo hueco que ya mordió en
-- `quotes` (Fase 4) y en `attachments` (Fase D). Sin ella, avanzar de etapa no
-- da error — simplemente no afecta ninguna fila. Por eso todo cambio de estado
-- va como función `security definer` que revalida rol y estado ella misma
-- (doc 03 §9, "commands vs updates").
--
-- Además, `prospects` solo guarda `first_visit_at` / `last_visit_at`: un
-- resumen, no un historial. "Registrar una visita" contra ese modelo pisaría
-- la visita anterior y no dejaría rastro de qué se habló ni de quién fue. De
-- ahí la tabla nueva `prospect_visits`, que sí es el historial.
-- ============================================================================

create table prospect_visits (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete cascade,
  user_id uuid not null references users(id),
  visited_at timestamptz not null default now(),
  visit_type text,                       -- visita, llamada, whatsapp…
  stage_before prospect_stage,
  stage_after prospect_stage,
  notes text,
  next_follow_up_at timestamptz,
  created_at timestamptz not null default now()
);

create index prospect_visits_prospect_idx on prospect_visits (prospect_id, visited_at desc);

alter table prospect_visits enable row level security;

-- Se ve exactamente lo que se puede ver del prospecto: la vendedora dueña y
-- supervisión. No hay política de INSERT a propósito — las visitas solo entran
-- por `register_prospect_visit`, para que no se puedan escribir sueltas.
create policy prospect_visits_select on prospect_visits for select
  using (
    exists (
      select 1 from prospects p
      where p.id = prospect_visits.prospect_id
        and (p.user_id = current_wow_user_id()
             or current_wow_role() in ('SUPERVISOR', 'ADMIN'))
    )
  );

-- --------------------------------------------------------------- funciones

-- Crear solo inserta, así que va `security invoker`: la política
-- `prospects_insert` de la Fase 1 es la que decide de verdad.
create or replace function create_prospect(
  p_name text,
  p_commercial_name text default null,
  p_phone text default null,
  p_email text default null,
  p_city text default null,
  p_source text default null,
  p_notes text default null,
  p_next_follow_up_at timestamptz default null
) returns prospects
language plpgsql
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_prospect prospects;
begin
  v_actor_id := current_wow_user_id();
  if v_actor_id is null then
    raise exception 'No autorizado: no hay usuario WOW asociado a esta sesión';
  end if;

  if coalesce(btrim(p_name), '') = '' then
    raise exception 'El prospecto necesita un nombre';
  end if;

  insert into prospects (
    name, commercial_name, phone, email, city, user_id, stage, source, notes, next_follow_up_at
  ) values (
    btrim(p_name), p_commercial_name, p_phone, p_email, p_city,
    v_actor_id, 'NEW', p_source, p_notes, p_next_follow_up_at
  ) returning * into v_prospect;

  return v_prospect;
end;
$$;

revoke execute on function create_prospect(text,text,text,text,text,text,text,timestamptz) from public, anon;
grant execute on function create_prospect(text,text,text,text,text,text,text,timestamptz) to authenticated;

-- Registrar una visita y, si corresponde, avanzar de etapa. `security definer`
-- porque `prospects` no tiene política de UPDATE; revalida dueño y estado.
create or replace function register_prospect_visit(
  p_prospect_id uuid,
  p_visit_type text default null,
  p_notes text default null,
  p_stage prospect_stage default null,
  p_next_follow_up_at timestamptz default null
) returns prospects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_actor_role text;
  v_prospect prospects;
  v_stage_before prospect_stage;
  v_stage_after prospect_stage;
begin
  v_actor_id := current_wow_user_id();
  v_actor_role := current_wow_role();
  if v_actor_id is null then
    raise exception 'No autorizado: no hay usuario WOW asociado a esta sesión';
  end if;

  select * into v_prospect from prospects where id = p_prospect_id;
  if v_prospect.id is null then
    raise exception 'El prospecto no existe';
  end if;

  if v_prospect.user_id <> v_actor_id and v_actor_role not in ('SUPERVISOR', 'ADMIN') then
    raise exception 'Este prospecto es de otra vendedora';
  end if;

  if v_prospect.stage in ('WON', 'LOST') then
    raise exception 'El prospecto ya está cerrado (%); no admite más visitas', v_prospect.stage;
  end if;

  -- Ganado y perdido son cierres, y cada uno tiene su propia función porque
  -- exigen datos que una visita no pide (el cliente creado, el motivo).
  if p_stage in ('WON', 'LOST') then
    raise exception 'Para cerrar el prospecto usa convertir a cliente o marcar como perdido';
  end if;

  -- La etapa anterior se guarda ANTES del update: si se leyera después,
  -- `stage_before` quedaría con la etapa nueva y el historial diría que nunca
  -- hubo un cambio.
  v_stage_before := v_prospect.stage;
  v_stage_after := coalesce(p_stage, v_prospect.stage);

  update prospects set
    stage = v_stage_after,
    first_visit_at = coalesce(first_visit_at, now()),
    last_visit_at = now(),
    next_follow_up_at = p_next_follow_up_at,
    updated_at = now()
  where id = p_prospect_id
  returning * into v_prospect;

  insert into prospect_visits (
    prospect_id, user_id, visit_type, stage_before, stage_after, notes, next_follow_up_at
  ) values (
    p_prospect_id, v_actor_id, p_visit_type, v_stage_before, v_stage_after,
    p_notes, p_next_follow_up_at
  );

  return v_prospect;
end;
$$;

revoke execute on function register_prospect_visit(uuid,text,text,prospect_stage,timestamptz) from public, anon;
grant execute on function register_prospect_visit(uuid,text,text,prospect_stage,timestamptz) to authenticated;

-- doc 01 §12: perder un prospecto debe registrar motivo, fecha y usuario.
create or replace function mark_prospect_lost(
  p_prospect_id uuid,
  p_reason text
) returns prospects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_actor_role text;
  v_prospect prospects;
begin
  v_actor_id := current_wow_user_id();
  v_actor_role := current_wow_role();
  if v_actor_id is null then
    raise exception 'No autorizado: no hay usuario WOW asociado a esta sesión';
  end if;

  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'Perder un prospecto exige un motivo';
  end if;

  select * into v_prospect from prospects where id = p_prospect_id;
  if v_prospect.id is null then
    raise exception 'El prospecto no existe';
  end if;
  if v_prospect.user_id <> v_actor_id and v_actor_role not in ('SUPERVISOR', 'ADMIN') then
    raise exception 'Este prospecto es de otra vendedora';
  end if;
  if v_prospect.stage in ('WON', 'LOST') then
    raise exception 'El prospecto ya está cerrado (%)', v_prospect.stage;
  end if;

  insert into prospect_visits (
    prospect_id, user_id, visit_type, stage_before, stage_after, notes
  ) values (
    p_prospect_id, v_actor_id, 'cierre', v_prospect.stage, 'LOST',
    'Marcado como perdido: ' || btrim(p_reason)
  );

  update prospects set
    stage = 'LOST',
    lost_reason = btrim(p_reason),
    next_follow_up_at = null,     -- un prospecto perdido no debe seguir apareciendo en la agenda
    updated_at = now()
  where id = p_prospect_id
  returning * into v_prospect;

  return v_prospect;
end;
$$;

revoke execute on function mark_prospect_lost(uuid,text) from public, anon;
grant execute on function mark_prospect_lost(uuid,text) to authenticated;

-- El prospecto que compra se vuelve cliente. No crea el cliente aquí: crearlo
-- exige la ficha fiscal completa (DANE, responsabilidad fiscal, …) y eso ya lo
-- resuelve `create_customer`. Esta función solo enlaza y cierra.
create or replace function convert_prospect_to_customer(
  p_prospect_id uuid,
  p_customer_id uuid
) returns prospects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_actor_role text;
  v_prospect prospects;
begin
  v_actor_id := current_wow_user_id();
  v_actor_role := current_wow_role();
  if v_actor_id is null then
    raise exception 'No autorizado: no hay usuario WOW asociado a esta sesión';
  end if;

  select * into v_prospect from prospects where id = p_prospect_id;
  if v_prospect.id is null then
    raise exception 'El prospecto no existe';
  end if;
  if v_prospect.user_id <> v_actor_id and v_actor_role not in ('SUPERVISOR', 'ADMIN') then
    raise exception 'Este prospecto es de otra vendedora';
  end if;
  if v_prospect.stage = 'WON' then
    raise exception 'El prospecto ya fue convertido en cliente';
  end if;
  if v_prospect.stage = 'LOST' then
    raise exception 'El prospecto está marcado como perdido';
  end if;

  if not exists (select 1 from customers where id = p_customer_id) then
    raise exception 'El cliente no existe';
  end if;

  insert into prospect_visits (
    prospect_id, user_id, visit_type, stage_before, stage_after, notes
  ) values (
    p_prospect_id, v_actor_id, 'cierre', v_prospect.stage, 'WON', 'Convertido en cliente'
  );

  update prospects set
    stage = 'WON',
    customer_id = p_customer_id,
    converted_at = now(),
    next_follow_up_at = null,
    updated_at = now()
  where id = p_prospect_id
  returning * into v_prospect;

  insert into customer_activities (customer_id, user_id, activity_type, description, reference_type, reference_id)
  values (p_customer_id, v_actor_id, 'NOTE', 'Creado a partir del prospecto ' || v_prospect.name, 'prospect', p_prospect_id);

  return v_prospect;
end;
$$;

revoke execute on function convert_prospect_to_customer(uuid,uuid) from public, anon;
grant execute on function convert_prospect_to_customer(uuid,uuid) to authenticated;
