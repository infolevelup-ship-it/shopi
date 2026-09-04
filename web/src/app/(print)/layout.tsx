import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Las vistas de impresión viven fuera del AppShell a propósito: una hoja con
// barra lateral y navegación inferior impresa encima no sirve para nada. El
// control de acceso sí es el mismo que el del resto de la aplicación — que la
// página sea imprimible no la hace pública.
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getCurrentProfile();
  if (!profile || !profile.active) redirect("/");

  return <main className="min-h-full bg-bg">{children}</main>;
}
