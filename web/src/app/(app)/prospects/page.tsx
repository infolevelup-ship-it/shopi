import Link from "next/link";
import { listProspects } from "@/lib/actions/prospects";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { formatDate, formatRelative } from "@/lib/ui/format";

function overdue(iso: string | null) {
  return !!iso && new Date(iso).getTime() < Date.now();
}

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  const { ver } = await searchParams;
  const showClosed = ver === "cerrados";
  const prospects = await listProspects(showClosed);

  return (
    <div>
      <PageHeader
        title="Prospectos"
        subtitle={
          showClosed
            ? "Ganados y perdidos"
            : "Abiertos, ordenados por el próximo seguimiento"
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/prospects"
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                !showClosed
                  ? "border-primary bg-primary text-white"
                  : "border-line-strong bg-surface text-text-soft"
              }`}
            >
              Abiertos
            </Link>
            <Link
              href="/prospects?ver=cerrados"
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                showClosed
                  ? "border-primary bg-primary text-white"
                  : "border-line-strong bg-surface text-text-soft"
              }`}
            >
              Cerrados
            </Link>
            <Link href="/prospects/new" className="btn btn-primary btn-sm">
              Nuevo prospecto
            </Link>
          </div>
        }
      />

      {prospects.length === 0 ? (
        <EmptyState
          title={showClosed ? "Todavía no hay prospectos cerrados" : "Todavía no hay prospectos"}
          description={
            showClosed
              ? "Aquí van a aparecer los que se ganen o se pierdan."
              : "Un prospecto es un salón que todavía no compra. Registra el primero para empezar a hacerle seguimiento."
          }
          action={
            showClosed ? undefined : (
              <Link href="/prospects/new" className="btn btn-primary">
                Nuevo prospecto
              </Link>
            )
          }
        />
      ) : (
        <ul className="grid gap-2">
          {prospects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/prospects/${p.id}`}
                className="card block p-4 transition hover:border-line-strong"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.commercialName ?? p.name}</p>
                    <p className="text-sm text-text-soft">
                      {p.commercialName ? `${p.name} · ` : ""}
                      {p.city ?? "sin ciudad"}
                      {p.phone ? ` · ${p.phone}` : ""}
                    </p>
                  </div>
                  <StatusBadge kind="prospect" status={p.stage} />
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-soft">
                  <span>
                    Última visita:{" "}
                    {p.lastVisitAt ? formatRelative(p.lastVisitAt) : "todavía ninguna"}
                  </span>
                  {p.nextFollowUpAt && (
                    /* Lo que se pasó de fecha es lo único que la vendedora
                       necesita ver de un golpe al abrir la lista. */
                    <span className={overdue(p.nextFollowUpAt) ? "font-medium text-danger" : ""}>
                      {overdue(p.nextFollowUpAt) ? "⚠ Seguimiento vencido: " : "Próximo seguimiento: "}
                      {formatDate(p.nextFollowUpAt)}
                    </span>
                  )}
                  {p.ownerName && <span>{p.ownerName}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
