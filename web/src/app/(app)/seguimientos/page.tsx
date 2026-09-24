import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getSeguimientosGenerales } from "@/lib/actions/seguimientos";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/ui/format";

function vencido(iso: string) {
  return new Date(iso).getTime() < Date.now();
}

// Solo supervisor/admin (doc 05): es la vista de "qué está pasando con todas
// las vendedoras", no algo que una vendedora necesite ver de las demás.
export default async function SeguimientosPage() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "SUPERVISOR" && profile.role !== "ADMIN")) {
    redirect("/");
  }

  const data = await getSeguimientosGenerales();
  if (!data) redirect("/");

  const { followUps, prospectFollowUps } = data;

  return (
    <div>
      <PageHeader
        title="Seguimientos"
        subtitle="Lo que cada vendedora programó, de todas a la vez"
      />

      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold text-text">Clientes</h2>
        {followUps.length === 0 ? (
          <EmptyState
            title="Sin seguimientos pendientes"
            description="Cuando una vendedora programe uno, aparece aquí."
          />
        ) : (
          <ul className="grid gap-2">
            {followUps.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/customers/${f.customerId}`}
                  className="card block p-4 transition hover:border-line-strong"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{f.customerName}</p>
                      <p className="text-sm text-text-soft">{f.sellerName}</p>
                    </div>
                    <span className={`text-sm ${vencido(f.scheduledAt) ? "font-medium text-danger" : "text-text-soft"}`}>
                      {vencido(f.scheduledAt) ? "⚠ Vencido: " : ""}
                      {formatDate(f.scheduledAt)}
                    </span>
                  </div>
                  {f.reason && <p className="mt-2 text-sm text-text-soft">{f.reason}</p>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-text">Prospectos</h2>
        {prospectFollowUps.length === 0 ? (
          <EmptyState
            title="Sin visitas programadas"
            description="Cuando una vendedora programe una, aparece aquí."
          />
        ) : (
          <ul className="grid gap-2">
            {prospectFollowUps.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/prospects/${p.id}`}
                  className="card block p-4 transition hover:border-line-strong"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.prospectName}</p>
                      <p className="text-sm text-text-soft">{p.sellerName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge kind="prospect" status={p.stage} />
                      <span className={`text-sm ${vencido(p.scheduledAt) ? "font-medium text-danger" : "text-text-soft"}`}>
                        {vencido(p.scheduledAt) ? "⚠ Vencido: " : ""}
                        {formatDate(p.scheduledAt)}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
