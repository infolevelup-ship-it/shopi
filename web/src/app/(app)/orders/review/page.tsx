import Link from "next/link";
import { searchReviewQueue } from "@/lib/actions/orders";
import { getCurrentProfile } from "@/lib/auth";
import { formatMoney, formatRelative } from "@/lib/ui/format";
import { Callout, EmptyState, PageHeader, StatusBadge } from "@/components/ui";

// doc 11 §37: la cola es la pantalla de trabajo de bodega — lo primero que
// importa es qué lleva más tiempo esperando, por eso la antigüedad va visible
// en las dos versiones (tabla y tarjetas) y el orden es el más viejo primero.
export default async function OrderReviewQueuePage() {
  const [items, profile] = await Promise.all([searchReviewQueue(), getCurrentProfile()]);
  const canReview =
    !!profile &&
    (profile.role === "WAREHOUSE" || profile.role === "SUPERVISOR" || profile.role === "ADMIN");

  return (
    <div>
      <PageHeader
        title="Cola de bodega"
        subtitle={
          items.length === 0
            ? "Nada pendiente de revisión"
            : `${items.length} pedido(s) esperando revisión`
        }
      />

      {!canReview && (
        <div className="mb-5">
          <Callout tone="warning" title="Vista limitada">
            Esta pantalla es de bodega, supervisor o administrador. Solo verás lo que tus
            permisos permitan.
          </Callout>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="Cola vacía"
          description="Cuando una vendedora envíe un pedido a revisión, aparecerá aquí."
        />
      ) : (
        <>
          <div className="desktop-only card overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Vendedora</th>
                  <th className="text-right">Valor</th>
                  <th>Esperando</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((o) => (
                  <tr key={o.id}>
                    <td className="font-medium">
                      <Link href={`/orders/${o.id}`} className="hover:underline">
                        {o.order_number}
                      </Link>
                    </td>
                    <td>{o.customer_name ?? "—"}</td>
                    <td className="text-text-soft">{o.seller_name ?? "—"}</td>
                    <td className="text-right font-medium">{formatMoney(o.grand_total)}</td>
                    <td className="text-text-soft">{formatRelative(o.submitted_at)}</td>
                    <td>
                      <StatusBadge kind="order" status={o.status} />
                    </td>
                    <td className="text-right">
                      <Link href={`/orders/${o.id}`} className="btn btn-primary btn-sm">
                        Revisar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mobile-only grid gap-2">
            {items.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="card card-pad block">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium text-text">{o.order_number}</span>
                    <span className="font-semibold whitespace-nowrap">
                      {formatMoney(o.grand_total)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-text-soft">
                    {o.customer_name ?? "—"}
                    {o.seller_name ? ` · ${o.seller_name}` : ""}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <StatusBadge kind="order" status={o.status} />
                    <span className="text-xs text-text-muted">
                      esperando {formatRelative(o.submitted_at)}
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
