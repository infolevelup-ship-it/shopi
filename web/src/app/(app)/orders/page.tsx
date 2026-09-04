import Link from "next/link";
import { searchOrders } from "@/lib/actions/orders";
import { getCurrentProfile } from "@/lib/auth";
import { formatMoney, formatRelative } from "@/lib/ui/format";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { SearchForm } from "@/components/search-form";
import type { Database } from "@/lib/supabase/database.types";

type OrderStatus = Database["public"]["Enums"]["order_status"];

// Filtros por lo que la gente realmente pregunta ("¿qué falta por facturar?"),
// no por cada uno de los 13 estados sueltos.
const FILTERS: { key: string; label: string; statuses?: OrderStatus[] }[] = [
  { key: "todos", label: "Todos" },
  {
    key: "en_curso",
    label: "En curso",
    statuses: ["DRAFT", "SUBMITTED", "PENDING_REVIEW", "IN_REVIEW"],
  },
  { key: "por_facturar", label: "Por facturar", statuses: ["APPROVED_FOR_INVOICE", "INVOICING"] },
  { key: "facturados", label: "Facturados", statuses: ["INVOICED", "READY_FOR_DISPATCH", "DISPATCHED", "DELIVERED"] },
  { key: "devueltos", label: "Devueltos", statuses: ["RETURNED_TO_SELLER", "BLOCKED"] },
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtro?: string }>;
}) {
  const { q = "", filtro = "todos" } = await searchParams;
  const active = FILTERS.find((f) => f.key === filtro) ?? FILTERS[0];

  const [profile, orders] = await Promise.all([
    getCurrentProfile(),
    searchOrders(q, active.statuses),
  ]);
  const canCreate = profile?.role !== "WAREHOUSE";

  return (
    <div>
      <PageHeader
        title="Pedidos"
        subtitle={`${orders.length} pedido(s)${active.statuses ? ` · ${active.label.toLowerCase()}` : ""}`}
        actions={
          canCreate ? (
            <Link href="/orders/new" className="btn btn-primary btn-block-mobile">
              + Nuevo pedido
            </Link>
          ) : undefined
        }
      />

      <SearchForm
        action="/orders"
        placeholder="Buscar por consecutivo (WOW-P-…)"
        defaultValue={q}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const href = `/orders?filtro=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
          const isActive = f.key === active.key;
          return (
            <Link
              key={f.key}
              href={href}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                isActive
                  ? "border-primary bg-primary text-white"
                  : "border-line-strong bg-surface text-text-soft hover:text-text"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="Sin pedidos"
          description={
            q
              ? "Ningún pedido coincide con esa búsqueda."
              : "Cuando se cree un pedido aparecerá aquí."
          }
          action={
            canCreate ? (
              <Link href="/orders/new" className="btn btn-primary">
                + Nuevo pedido
              </Link>
            ) : undefined
          }
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
                  <th>Creado</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="font-medium">
                      <Link href={`/orders/${o.id}`} className="hover:underline">
                        {o.order_number}
                      </Link>
                    </td>
                    <td>{o.customer_name ?? "—"}</td>
                    <td className="text-text-soft">{o.seller_name ?? "—"}</td>
                    <td className="text-right font-medium">{formatMoney(o.grand_total)}</td>
                    <td className="text-text-soft">{formatRelative(o.created_at)}</td>
                    <td>
                      <StatusBadge kind="order" status={o.status} />
                    </td>
                    <td className="text-right">
                      <Link href={`/orders/${o.id}`} className="btn btn-secondary btn-sm">
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mobile-only grid gap-2">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="card card-pad block">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium text-text">{o.order_number}</span>
                    <span className="font-semibold whitespace-nowrap">
                      {formatMoney(o.grand_total)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-text-soft">{o.customer_name ?? "—"}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <StatusBadge kind="order" status={o.status} />
                    <span className="text-xs text-text-muted">
                      {o.seller_name ? `${o.seller_name} · ` : ""}
                      {formatRelative(o.created_at)}
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
