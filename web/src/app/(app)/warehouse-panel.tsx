import Link from "next/link";
import type { WarehouseDashboard } from "@/lib/actions/dashboard";
import { formatRelative } from "@/lib/ui/format";
import { StatTile } from "@/components/ui";

// doc 11 §36: la pantalla de bodega empieza por los conteos de la cola, y
// enseguida el acceso a la cola misma. La pregunta que responde es "¿qué
// pedido debo procesar ahora?".
export function WarehousePanel({ data }: { data: WarehouseDashboard }) {
  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text">Hola, {data.userName} 👋</h1>
          <p className="mt-1 text-sm text-text-soft">
            {data.pendingReview + data.inReview === 0
              ? "No hay pedidos esperando revisión."
              : `Hay ${data.pendingReview + data.inReview} pedido(s) esperando revisión` +
                (data.oldestPendingAt
                  ? `. El más antiguo llegó ${formatRelative(data.oldestPendingAt)}.`
                  : ".")}
          </p>
        </div>
        <Link href="/orders/review" className="btn btn-primary btn-block-mobile">
          Ir a la cola de bodega
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile
          value={data.pendingReview}
          label="pendientes de revisión"
          href="/orders/review"
          tone={data.pendingReview > 0 ? "warning" : undefined}
        />
        <StatTile value={data.inReview} label="en revisión ahora" href="/orders/review" />
        <StatTile
          value={data.approvedForInvoice}
          label="listos para facturar"
          href="/orders"
          tone={data.approvedForInvoice > 0 ? "success" : undefined}
        />
        <StatTile
          value={data.invoicing}
          label="facturando"
          href="/orders"
          tone={data.invoicing > 0 ? "warning" : undefined}
        />
        <StatTile value={data.invoiced} label="facturados" href="/orders" />
        <StatTile
          value={data.returned}
          label="devueltos a vendedora"
          href="/orders"
          tone={data.returned > 0 ? "danger" : undefined}
        />
      </div>
    </div>
  );
}
