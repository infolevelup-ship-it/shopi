import Link from "next/link";
import type { SellerDashboard } from "@/lib/actions/dashboard";

function formatMoney(value: number) {
  return value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

const KIND_ICON: Record<string, string> = {
  AT_RISK: "🔴",
  OPEN_QUOTE: "📄",
  RETURNED_ORDER: "⚠️",
};

// Fase 10 (doc 01 §30): "¿qué tengo que hacer hoy?" — el panel diario de la
// vendedora. "Prioridades" es una lista de categorías explicables, no un
// puntaje compuesto (doc 01 §58: la fórmula exacta se define después de
// datos reales, y nunca debe ser una caja negra).
export function DashboardPanel({ data }: { data: SellerDashboard }) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-neutral-900">Buenos días, {data.sellerName} 👋</h1>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link href="/customers" className="rounded-lg border border-neutral-200 bg-white p-4 hover:bg-neutral-50">
          <p className="text-2xl font-semibold text-neutral-900">{data.overdueFollowUpsCount}</p>
          <p className="text-xs text-neutral-500">seguimientos vencidos</p>
        </Link>
        <Link href="/customers" className="rounded-lg border border-neutral-200 bg-white p-4 hover:bg-neutral-50">
          <p className="text-2xl font-semibold text-neutral-900">{data.upcomingPurchasesCount}</p>
          <p className="text-xs text-neutral-500">clientes próximos a comprar</p>
        </Link>
        <Link href="/quotes" className="rounded-lg border border-neutral-200 bg-white p-4 hover:bg-neutral-50">
          <p className="text-2xl font-semibold text-neutral-900">{data.openQuotesCount}</p>
          <p className="text-xs text-neutral-500">cotizaciones abiertas</p>
        </Link>
        <Link href="/orders" className="rounded-lg border border-neutral-200 bg-white p-4 hover:bg-neutral-50">
          <p className="text-2xl font-semibold text-neutral-900">{data.pendingOrdersCount}</p>
          <p className="text-xs text-neutral-500">pedidos pendientes</p>
        </Link>
      </div>

      <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
        <p className="text-xs text-neutral-500">Ventas del mes</p>
        <p className="text-xl font-semibold text-neutral-900">{formatMoney(data.salesThisMonth)}</p>
      </div>

      {data.priorities.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">Prioridades</h2>
          <ol className="space-y-2">
            {data.priorities.map((p, i) => (
              <li key={i}>
                <Link
                  href={p.link}
                  className="flex items-start gap-2 rounded-lg border border-neutral-200 bg-white p-3 text-sm hover:bg-neutral-50"
                >
                  <span>{KIND_ICON[p.kind] ?? "•"}</span>
                  <span>
                    <span className="font-medium text-neutral-900">{p.customerName}</span>
                    <span className="block text-xs text-neutral-500">{p.reason}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
