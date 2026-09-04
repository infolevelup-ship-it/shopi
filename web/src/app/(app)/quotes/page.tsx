import Link from "next/link";
import { searchQuotes } from "@/lib/actions/quotes";
import { formatMoney, formatRelative } from "@/lib/ui/format";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { SearchForm } from "@/components/search-form";

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const quotes = await searchQuotes(q);

  return (
    <div>
      <PageHeader
        title="Cotizaciones"
        subtitle={`${quotes.length} cotización(es)`}
        actions={
          <Link href="/quotes/new" className="btn btn-primary btn-block-mobile">
            + Nueva cotización
          </Link>
        }
      />

      <SearchForm action="/quotes" placeholder="Buscar por consecutivo…" defaultValue={q} />

      {quotes.length === 0 ? (
        <EmptyState
          title="Sin cotizaciones"
          description={
            q
              ? "Ninguna cotización coincide con esa búsqueda."
              : "Cuando crees una cotización aparecerá aquí."
          }
          action={
            <Link href="/quotes/new" className="btn btn-primary">
              + Nueva cotización
            </Link>
          }
        />
      ) : (
        <>
          <div className="desktop-only card overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th>Cotización</th>
                  <th>Cliente</th>
                  <th>Vendedora</th>
                  <th className="text-right">Valor</th>
                  <th>Creada</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {quotes.map((qt) => (
                  <tr key={qt.id}>
                    <td className="font-medium">
                      <Link href={`/quotes/${qt.id}`} className="hover:underline">
                        {qt.quote_number}
                      </Link>
                    </td>
                    <td>{qt.customer_name ?? "—"}</td>
                    <td className="text-text-soft">{qt.seller_name ?? "—"}</td>
                    <td className="text-right font-medium">{formatMoney(qt.grand_total)}</td>
                    <td className="text-text-soft">{formatRelative(qt.created_at)}</td>
                    <td>
                      <StatusBadge kind="quote" status={qt.status} />
                    </td>
                    <td className="text-right">
                      <Link href={`/quotes/${qt.id}`} className="btn btn-secondary btn-sm">
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mobile-only grid gap-2">
            {quotes.map((qt) => (
              <li key={qt.id}>
                <Link href={`/quotes/${qt.id}`} className="card card-pad block">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium text-text">{qt.quote_number}</span>
                    <span className="font-semibold whitespace-nowrap">
                      {formatMoney(qt.grand_total)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-text-soft">{qt.customer_name ?? "—"}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <StatusBadge kind="quote" status={qt.status} />
                    <span className="text-xs text-text-muted">
                      {formatRelative(qt.created_at)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
