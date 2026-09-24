"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { customerDisplayName } from "@/lib/ui/format";

// Fase 13 (mejora, no fix): admin/supervisor pedían ver en un solo lugar los
// seguimientos y visitas que cada vendedora ya programó, sin tener que
// entrar cliente por cliente. La RLS de follow_ups/prospects/prospect_visits
// ya deja ver todo a SUPERVISOR/ADMIN (doc 05) — lo que faltaba era la
// pantalla, no el permiso.

export type FollowUpRow = {
  id: string;
  customerId: string;
  customerName: string;
  sellerName: string;
  scheduledAt: string;
  type: string | null;
  reason: string | null;
};

export type ProspectFollowUpRow = {
  id: string;
  prospectName: string;
  sellerName: string;
  scheduledAt: string;
  stage: string;
};

export type SeguimientosGenerales = {
  followUps: FollowUpRow[];
  prospectFollowUps: ProspectFollowUpRow[];
};

async function requireSupervisorOrAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "SUPERVISOR" && profile.role !== "ADMIN")) return null;
  return profile;
}

export async function getSeguimientosGenerales(): Promise<SeguimientosGenerales | null> {
  if (!(await requireSupervisorOrAdmin())) return null;

  const supabase = await createClient();

  const [{ data: followUps }, { data: prospects }] = await Promise.all([
    supabase
      .from("follow_ups")
      .select(
        "id, scheduled_at, type, reason, customer:customers!follow_ups_customer_id_fkey(id, commercial_name, legal_name, first_name, last_name), seller:users!follow_ups_seller_id_fkey(name)",
      )
      .eq("status", "PENDING")
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("prospects")
      .select("id, name, commercial_name, stage, next_follow_up_at, user:users!prospects_user_id_fkey(name)")
      .not("next_follow_up_at", "is", null)
      .not("stage", "in", "(WON,LOST)")
      .order("next_follow_up_at", { ascending: true }),
  ]);

  return {
    followUps: (followUps ?? []).map((f) => {
      const customer = Array.isArray(f.customer) ? f.customer[0] : f.customer;
      const seller = Array.isArray(f.seller) ? f.seller[0] : f.seller;
      return {
        id: f.id,
        customerId: customer?.id ?? "",
        customerName: customer ? customerDisplayName(customer) : "(sin cliente)",
        sellerName: seller?.name ?? "(sin vendedora)",
        scheduledAt: f.scheduled_at,
        type: f.type,
        reason: f.reason,
      };
    }),
    prospectFollowUps: (prospects ?? []).map((p) => {
      const user = Array.isArray(p.user) ? p.user[0] : p.user;
      return {
        id: p.id,
        prospectName: p.commercial_name ?? p.name,
        sellerName: user?.name ?? "(sin vendedora)",
        scheduledAt: p.next_follow_up_at as string,
        stage: p.stage,
      };
    }),
  };
}

/** Solo el conteo, para la StatTile de la home — sin traer las filas completas. */
export async function getSeguimientosPendientesCount(): Promise<number | null> {
  if (!(await requireSupervisorOrAdmin())) return null;

  const supabase = await createClient();
  const [followUps, prospects] = await Promise.all([
    supabase.from("follow_ups").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    supabase
      .from("prospects")
      .select("id", { count: "exact", head: true })
      .not("next_follow_up_at", "is", null)
      .not("stage", "in", "(WON,LOST)"),
  ]);

  return (followUps.count ?? 0) + (prospects.count ?? 0);
}
