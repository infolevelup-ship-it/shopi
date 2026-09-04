"use server";

import { createClient } from "@/lib/supabase/server";
import type { ProspectStage } from "@/lib/ui/prospects";

export type ProspectRow = {
  id: string;
  name: string;
  commercialName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  stage: string;
  source: string | null;
  lastVisitAt: string | null;
  nextFollowUpAt: string | null;
  createdAt: string;
  ownerName: string | null;
  customerId: string | null;
};

const LIST_SELECT =
  "id, name, commercial_name, phone, email, city, stage, source, last_visit_at, next_follow_up_at, created_at, customer_id, owner:users!prospects_user_id_fkey(name)";

type RawProspect = {
  id: string;
  name: string;
  commercial_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  stage: string;
  source: string | null;
  last_visit_at: string | null;
  next_follow_up_at: string | null;
  created_at: string;
  customer_id: string | null;
  owner: { name: string }[] | { name: string } | null;
};

function toRow(p: RawProspect): ProspectRow {
  const owner = Array.isArray(p.owner) ? p.owner[0] : p.owner;
  return {
    id: p.id,
    name: p.name,
    commercialName: p.commercial_name,
    phone: p.phone,
    email: p.email,
    city: p.city,
    stage: p.stage,
    source: p.source,
    lastVisitAt: p.last_visit_at,
    nextFollowUpAt: p.next_follow_up_at,
    createdAt: p.created_at,
    ownerName: owner?.name ?? null,
    customerId: p.customer_id,
  };
}

// Los abiertos primero y ordenados por el próximo seguimiento: lo primero que
// necesita saber una vendedora al abrir la pantalla es a quién le toca hoy.
// Los cerrados (ganados y perdidos) se piden aparte con `closed`.
export async function listProspects(closed = false): Promise<ProspectRow[]> {
  const supabase = await createClient();
  const closedStages: ProspectStage[] = ["WON", "LOST"];

  let request = supabase.from("prospects").select(LIST_SELECT).limit(100);
  request = closed
    ? request.in("stage", closedStages).order("updated_at", { ascending: false })
    : request
        .not("stage", "in", "(WON,LOST)")
        .order("next_follow_up_at", { ascending: true, nullsFirst: false });

  const { data, error } = await request;
  if (error) throw new Error(`No se pudieron cargar los prospectos: ${error.message}`);
  return (data ?? []).map((p) => toRow(p as RawProspect));
}

export type ProspectVisit = {
  id: string;
  visitedAt: string;
  visitType: string | null;
  stageBefore: string | null;
  stageAfter: string | null;
  notes: string | null;
  userName: string | null;
};

export async function getProspect(
  id: string,
): Promise<{ prospect: ProspectRow & { notes: string | null; lostReason: string | null; firstVisitAt: string | null; convertedAt: string | null; ownerId: string }; visits: ProspectVisit[] } | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("prospects")
    .select(`${LIST_SELECT}, notes, lost_reason, first_visit_at, converted_at, user_id`)
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  const { data: rawVisits } = await supabase
    .from("prospect_visits")
    .select("id, visited_at, visit_type, stage_before, stage_after, notes, user:users!prospect_visits_user_id_fkey(name)")
    .eq("prospect_id", id)
    .order("visited_at", { ascending: false });

  const visits = (rawVisits ?? []).map((v) => {
    const user = Array.isArray(v.user) ? v.user[0] : v.user;
    return {
      id: v.id,
      visitedAt: v.visited_at,
      visitType: v.visit_type,
      stageBefore: v.stage_before,
      stageAfter: v.stage_after,
      notes: v.notes,
      userName: user?.name ?? null,
    };
  });

  return {
    prospect: {
      ...toRow(data as unknown as RawProspect),
      notes: data.notes,
      lostReason: data.lost_reason,
      firstVisitAt: data.first_visit_at,
      convertedAt: data.converted_at,
      ownerId: data.user_id,
    },
    visits,
  };
}

export type ProspectResult = { ok: true; prospectId: string } | { ok: false; error: string };
export type ProspectActionResult = { ok: true } | { ok: false; error: string };

export async function createProspectAction(input: {
  name: string;
  commercialName?: string;
  phone?: string;
  email?: string;
  city?: string;
  source?: string;
  notes?: string;
  nextFollowUpAt?: string;
}): Promise<ProspectResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_prospect", {
    p_name: input.name,
    p_commercial_name: input.commercialName || undefined,
    p_phone: input.phone || undefined,
    p_email: input.email || undefined,
    p_city: input.city || undefined,
    p_source: input.source || undefined,
    p_notes: input.notes || undefined,
    p_next_follow_up_at: input.nextFollowUpAt || undefined,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, prospectId: data!.id };
}

export async function registerProspectVisitAction(input: {
  prospectId: string;
  visitType?: string;
  notes?: string;
  stage?: ProspectStage;
  nextFollowUpAt?: string;
}): Promise<ProspectActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_prospect_visit", {
    p_prospect_id: input.prospectId,
    p_visit_type: input.visitType || undefined,
    p_notes: input.notes || undefined,
    p_stage: input.stage || undefined,
    p_next_follow_up_at: input.nextFollowUpAt || undefined,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function markProspectLostAction(
  prospectId: string,
  reason: string,
): Promise<ProspectActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_prospect_lost", {
    p_prospect_id: prospectId,
    p_reason: reason,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function convertProspectAction(
  prospectId: string,
  customerId: string,
): Promise<ProspectActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("convert_prospect_to_customer", {
    p_prospect_id: prospectId,
    p_customer_id: customerId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
