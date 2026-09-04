import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Layout de todo lo autenticado (doc 11 §3): el shell se monta una sola vez
// aquí en vez de repetirse pantalla por pantalla, y los dos casos de cuenta
// sin acceso (sin perfil / desactivada) se resuelven en un solo lugar — antes
// esa validación vivía solo en la home, así que entrando directo a /orders no
// se aplicaba.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const profile = await getCurrentProfile();

  if (!profile) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <div className="card card-pad">
          <h1 className="text-lg font-semibold">Cuenta sin perfil</h1>
          <p className="mt-2 text-sm text-text-soft">
            Tu cuenta ({user.email}) inició sesión correctamente, pero todavía no tiene un
            perfil en WOW Sales. Un administrador debe crear tu usuario con su rol antes de
            que puedas operar.
          </p>
        </div>
      </main>
    );
  }

  if (!profile.active) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <div className="card card-pad">
          <h1 className="text-lg font-semibold">Usuario desactivado</h1>
          <p className="mt-2 text-sm text-text-soft">
            Tu usuario está desactivado. Contacta a un administrador.
          </p>
        </div>
      </main>
    );
  }

  return (
    <AppShell user={{ name: profile.name, role: profile.role }}>{children}</AppShell>
  );
}
