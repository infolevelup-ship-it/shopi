import Link from "next/link";
import { listCustomers } from "@/lib/actions/customers";
import { getCurrentProfile } from "@/lib/auth";
import { customerDisplayName, formatDate, formatMoney } from "@/lib/ui/format";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { SearchForm } from "@/components/search-form";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const [profile, customers] = await Promise.all([getCurrentProfile(), listCustomers(q)]);
  const canCreate = profile?.role !== "WAREHOUSE";

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={q ? `Resultados para "${q}"` : "Los más recientes"}
        actions={
          canCreate ? (
            <Link href="/customers/new" className="btn btn-primary btn-block-mobile">
              + Nuevo cliente
            </Link>
          ) : undefined
        }
      />

      <SearchForm
        action="/customers"
        placeholder="Buscar por documento, nombre o teléfono…"
        defaultValue={q}
      />

      {customers.length === 0 ? (
        <EmptyState
          title={q ? "Sin resultados" : "Todavía no hay clientes"}
          description={
            q
              ? "Prueba con el número de documento o parte del nombre."
              : "Cuando crees el primer cliente aparecerá aquí."
          }
          action={
            canCreate ? (
              <Link href="/customers/new" className="btn btn-primary">
                + Nuevo cliente
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* -------------------------------------------------- desktop */}
          <div className="desktop-only card overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Responsable</th>
                  <th>Última compra</th>
                  <th className="text-right">Ticket promedio</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/customers/${c.id}`} className="font-medium hover:underline">
                        {customerDisplayName(c)}
                      </Link>
                      <div className="text-xs text-text-soft">
                        {c.document_type} {c.document_number}
                        {c.phone ? ` · ${c.phone}` : ""}
                      </div>
                    </td>
                    <td className="text-text-soft">{c.responsible_name ?? "—"}</td>
                    <td>
                      {formatDate(c.lastOrderAt)}
                      {c.isAtRisk && (
                        <div className="text-xs font-medium text-danger">
                          fuera de ciclo ({Math.round(c.daysSinceLastOrder ?? 0)} días)
                        </div>
                      )}
                    </td>
                    <td className="text-right">
                      {c.averageTicket ? formatMoney(c.averageTicket) : "—"}
                    </td>
                    <td>
                      <StatusBadge kind="customer" status={c.status} />
                    </td>
                    <td className="text-right">
                      <Link href={`/customers/${c.id}`} className="btn btn-secondary btn-sm">
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* --------------------------------------------------- mobile */}
          <ul className="mobile-only grid gap-2">
            {customers.map((c) => (
              <li key={c.id}>
                <Link href={`/customers/${c.id}`} className="card card-pad block">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium text-text">{customerDisplayName(c)}</span>
                    <StatusBadge kind="customer" status={c.status} />
                  </div>
                  <p className="mt-1 text-sm text-text-soft">
                    {c.document_type} {c.document_number}
                    {c.responsible_name ? ` · ${c.responsible_name}` : ""}
                  </p>
                  <p className="mt-2 text-sm text-text-soft">
                    Última compra {formatDate(c.lastOrderAt)}
                    {c.averageTicket ? ` · ticket ${formatMoney(c.averageTicket)}` : ""}
                  </p>
                  {c.isAtRisk && (
                    <p className="mt-1 text-sm font-medium text-danger">
                      🔴 Fuera de ciclo hace {Math.round(c.daysSinceLastOrder ?? 0)} días
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
