import Link from "next/link";
import type { SellerDashboard } from "@/lib/actions/dashboard";
import { formatMoney } from "@/lib/ui/format";
import { StatTile } from "@/components/ui";

const KIND_META: Record<string, { icon: string; label: string }> = {
  AT_RISK: { icon: "🔴", label: "Cliente fuera de ciclo" },
  OPEN_QUOTE: { icon: "📄", label: "Cotización sin respuesta" },
  RETURNED_ORDER: { icon: "⚠️", label: "Pedido devuelto" },
};

// Fase 10 (doc 01 §30) + doc 11 §19: el panel diario responde "¿qué tengo que
// hacer hoy?" y termina en una lista de tareas, no en otra fila de gráficas.
// "Prioridades" son categorías explicables, nunca un puntaje compuesto
// (doc 01 §58 / doc 11 §67: cada ítem dice por qué está ahí).
export function DashboardPanel({ data }: { data: SellerDashboard }) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text">Hola, {data.sellerName} 👋</h1>
        <p className="mt-1 text-sm text-text-soft">Esto es lo que tienes hoy.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          value={data.overdueFollowUpsCount}
          label="seguimientos vencidos"
          href="/customers"
          tone={data.overdueFollowUpsCount > 0 ? "danger" : undefined}
        />
        <StatTile
          value={data.upcomingPurchasesCount}
          label="clientes próximos a comprar"
          href="/customers"
        />
        <StatTile value={data.openQuotesCount} label="cotizaciones abiertas" href="/quotes" />
        <StatTile value={data.pendingOrdersCount} label="pedidos pendientes" href="/orders" />
      </div>

      <div className="card card-pad mt-3">
        <p className="text-xs text-text-soft">Ventas del mes</p>
        <p className="text-2xl font-semibold text-text">{formatMoney(data.salesThisMonth)}</p>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold text-text">Prioridades de hoy</h2>

        {data.priorities.length === 0 ? (
          <div className="card card-pad text-sm text-text-soft">
            Nada urgente por ahora. Cuando un cliente se salga de su ciclo de compra, una
            cotización quede sin respuesta o te devuelvan un pedido, aparecerá aquí.
          </div>
        ) : (
          <ol className="grid gap-2">
            {data.priorities.map((p, i) => {
              const meta = KIND_META[p.kind] ?? { icon: "•", label: "" };
              return (
                <li key={i}>
                  <Link
                    href={p.link}
                    className="card card-pad flex items-start gap-3 transition hover:bg-surface-soft"
                  >
                    <span aria-hidden className="text-lg leading-none">
                      {meta.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-text">{p.customerName}</span>
                      <span className="mt-0.5 block text-sm text-text-soft">{p.reason}</span>
                      <span className="mt-1 block text-xs text-text-muted">{meta.label}</span>
                    </span>
                    <span aria-hidden className="text-text-muted">
                      ›
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
