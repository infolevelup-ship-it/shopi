import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";
import { DashboardPanel } from "./dashboard-panel";
import { getSellerDashboard } from "@/lib/actions/dashboard";

const ROLE_LABEL: Record<string, string> = {
  SELLER: "Vendedora",
  WAREHOUSE: "Bodega",
  SUPERVISOR: "Supervisor",
  ADMIN: "Administrador",
};

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // RLS on `users` only lets a signed-in user read their own row (see
  // supabase/migrations/0001_init.sql) — this is a real permission check,
  // not a display convenience.
  const { data: profile } = await supabase
    .from("users")
    .select("name, role, active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  // doc 01 §30: para la vendedora, "¿qué tengo que hacer hoy?" es la
  // primera pantalla. Supervisor/admin/bodega van directo a /reports
  // (Fase 11) — no tienen un panel diario propio, ese es específicamente
  // de la vendedora.
  const dashboard = profile?.active && profile.role === "SELLER" ? await getSellerDashboard() : null;

  return (
    <main className={`mx-auto flex min-h-screen flex-col gap-6 px-4 py-10 ${dashboard ? "max-w-3xl" : "max-w-2xl justify-center"}`}>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-900">WOW Sales</h1>
        <SignOutButton />
      </div>

      {!profile ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Tu cuenta ({user.email}) inició sesión correctamente, pero todavía no
          tiene un perfil en WOW Sales — un administrador debe crear tu fila en{" "}
          <code>public.users</code> con tu rol antes de que puedas operar.
        </div>
      ) : !profile.active ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Tu usuario está desactivado. Contacta a un administrador.
        </div>
      ) : dashboard ? (
        <>
          <DashboardPanel data={dashboard} />
          <div className="flex gap-2 border-t border-neutral-200 pt-4">
            <Link
              href="/customers"
              className="inline-block rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
            >
              Clientes
            </Link>
            <Link
              href="/products"
              className="inline-block rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-900"
            >
              Productos
            </Link>
            <Link
              href="/quotes"
              className="inline-block rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-900"
            >
              Cotizaciones
            </Link>
            <Link
              href="/orders"
              className="inline-block rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-900"
            >
              Pedidos
            </Link>
            <Link
              href="/reports"
              className="inline-block rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-900"
            >
              Reportes
            </Link>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-500">Bienvenida/o</p>
          <p className="text-xl font-medium text-neutral-900">{profile.name}</p>
          <p className="mt-1 text-sm text-neutral-500">
            Rol: {ROLE_LABEL[profile.role] ?? profile.role}
          </p>
          <div className="mt-4 flex gap-2">
            <Link
              href="/customers"
              className="inline-block rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
            >
              Clientes
            </Link>
            <Link
              href="/products"
              className="inline-block rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-900"
            >
              Productos
            </Link>
            <Link
              href="/quotes"
              className="inline-block rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-900"
            >
              Cotizaciones
            </Link>
            <Link
              href="/orders"
              className="inline-block rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-900"
            >
              Pedidos
            </Link>
            {(profile.role === "WAREHOUSE" || profile.role === "SUPERVISOR" || profile.role === "ADMIN") && (
              <Link
                href="/orders/review"
                className="inline-block rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-900"
              >
                Revisión bodega
              </Link>
            )}
            <Link
              href="/reports"
              className="inline-block rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-900"
            >
              Reportes
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
