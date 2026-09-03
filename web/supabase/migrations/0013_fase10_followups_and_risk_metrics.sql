-- Fase 10 (doc 10 §13, doc 01 §27-30/§58): seguimiento inteligente, riesgo,
-- próxima compra estimada, y completar seguimientos.

-- Mismo hueco de rol que ya se encontró y corrigió en orders_insert (Fase 1)
-- y quotes_insert (Fase 4): "seller_id = uno mismo" no restringe nada, lo
-- cumple cualquier rol poniéndose a sí mismo. doc 05: solo Seller "hace
-- seguimiento" — Warehouse no debería poder crear follow_ups.
drop policy if exists follow_ups_insert on follow_ups;
create policy follow_ups_insert on follow_ups for insert
  with check (
    current_wow_role() in ('SELLER', 'SUPERVISOR', 'ADMIN')
    and (seller_id = current_wow_user_id() or current_wow_role() in ('SUPERVISOR', 'ADMIN'))
  );

-- follow_ups no tiene política de UPDATE (mismo diseño que orders/quotes) —
-- completar un seguimiento pasa por esta función.
create or replace function complete_follow_up(p_follow_up_id uuid, p_result text) returns follow_ups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_follow_up follow_ups;
  v_actor_id uuid;
  v_role user_role;
begin
  v_actor_id := current_wow_user_id();
  v_role := current_wow_role();
  if v_actor_id is null then
    raise exception 'No autorizado';
  end if;

  select * into v_follow_up from follow_ups where id = p_follow_up_id;
  if v_follow_up.id is null then
    raise exception 'Seguimiento no encontrado';
  end if;
  if v_follow_up.seller_id <> v_actor_id and v_role not in ('SUPERVISOR', 'ADMIN') then
    raise exception 'No autorizado para este seguimiento';
  end if;
  if v_follow_up.status <> 'PENDING' then
    raise exception 'Este seguimiento ya no está pendiente (estado actual: %)', v_follow_up.status;
  end if;

  update follow_ups set status = 'COMPLETED', completed_at = now(), result = p_result
  where id = p_follow_up_id
  returning * into v_follow_up;

  insert into customer_activities (customer_id, user_id, activity_type, description, reference_type, reference_id)
  values (v_follow_up.customer_id, v_actor_id, 'FOLLOW_UP', coalesce(p_result, 'Seguimiento completado'), 'follow_up', v_follow_up.id);

  return v_follow_up;
end;
$$;

revoke execute on function complete_follow_up(uuid, text) from public, anon;
grant execute on function complete_follow_up(uuid, text) to authenticated;

-- Extiende customer_metrics (Fase 1) con lo que pide doc 01 §28-29:
-- frecuencia histórica, próxima compra estimada, y bandera de riesgo.
create or replace view customer_metrics with (security_invoker = true) as
with invoiced_gaps as (
  select
    customer_id,
    invoiced_at,
    invoiced_at - lag(invoiced_at) over (partition by customer_id order by invoiced_at) as gap
  from orders
  where status = 'INVOICED' and invoiced_at is not null
),
frequency as (
  select customer_id, avg(extract(epoch from gap) / 86400) as avg_days_between_orders
  from invoiced_gaps
  where gap is not null
  group by customer_id
)
select
  c.id as customer_id,
  count(o.id) filter (where o.status not in ('CANCELLED')) as orders_count,
  coalesce(sum(o.grand_total) filter (where o.status = 'INVOICED'), 0) as lifetime_value,
  coalesce(avg(o.grand_total) filter (where o.status = 'INVOICED'), 0) as average_ticket,
  max(o.invoiced_at) as last_order_at,
  extract(day from now() - max(o.invoiced_at)) as days_since_last_order,
  count(q.id) filter (where q.status in ('SENT', 'FOLLOW_UP')) as open_quotes_count,
  count(f.id) filter (where f.status = 'PENDING') as open_followups_count,
  fr.avg_days_between_orders,
  case
    when fr.avg_days_between_orders is not null and max(o.invoiced_at) is not null
    then max(o.invoiced_at) + make_interval(days => fr.avg_days_between_orders::int)
    else null
  end as estimated_next_purchase_at,
  -- doc 01 §29: "días desde última compra > frecuencia habitual + tolerancia".
  -- Tolerancia = 50% de la frecuencia — primer valor razonable hasta tener
  -- datos reales para ajustarlo (doc 01 §58: "la fórmula exacta se definirá
  -- después de observar datos reales"; nunca debe ser caja negra).
  (
    fr.avg_days_between_orders is not null
    and extract(day from now() - max(o.invoiced_at)) > fr.avg_days_between_orders * 1.5
  ) as is_at_risk
from customers c
left join orders o on o.customer_id = c.id
left join quotes q on q.customer_id = c.id
left join follow_ups f on f.customer_id = c.id
left join frequency fr on fr.customer_id = c.id
group by c.id, fr.avg_days_between_orders;
