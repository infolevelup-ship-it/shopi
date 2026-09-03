"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

// Fase 10 (doc 01 §28-30, doc 10 §13). follow_ups ya existía desde la Fase 1
// (tabla + RLS select/insert); esta fase agrega completar el seguimiento
// (complete_follow_up, doc03 §9 "commands vs updates" — no hay política de
// UPDATE) y la creación desde la UI.

export type FollowUpActionResult = { ok: true } | { ok: false; error: string };

export async function createFollowUpAction(
  customerId: string,
  scheduledAt: string,
  reason: string,
  type?: string,
): Promise<FollowUpActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { ok: false, error: "No autorizado" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("follow_ups").insert({
    customer_id: customerId,
    seller_id: profile.id,
    scheduled_at: scheduledAt,
    reason,
    type: type || null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function completeFollowUpAction(
  followUpId: string,
  result: string,
): Promise<FollowUpActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_follow_up", {
    p_follow_up_id: followUpId,
    p_result: result,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
