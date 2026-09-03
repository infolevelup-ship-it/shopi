import { createClient } from "@/lib/supabase/server";

export type CurrentProfile = {
  id: string;
  name: string;
  role: string;
  active: boolean;
} | null;

// RLS en `users` deja leer cualquier fila a cualquier interno autenticado
// (roster pequeño, ver 0001_init.sql) — este helper solo trae la propia.
export async function getCurrentProfile(): Promise<CurrentProfile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("id, name, role, active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return data;
}
