import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Bypasses RLS entirely — never import this outside a server action or API
// route, and never after checking only the frontend role. Every caller must
// re-verify role + state itself before using this (doc 01 §48: hiding a
// button is UX, not security). Reserved for the operations doc 01 §18/§36
// says the client may never perform directly: writing invoices,
// invoice_operations, audit_logs, integration_logs.
export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
