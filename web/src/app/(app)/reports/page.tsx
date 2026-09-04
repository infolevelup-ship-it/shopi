import Link from "next/link";
import { redirect } from "next/navigation";
import { getReportsData, type ReportRange } from "@/lib/actions/reports";
import { formatMoney } from "@/lib/ui/format";
import { PageHeader, Section, StatTile } from "@/components/ui";

function RankList({ rows }: { rows: { name: string; total: number }[] }) {
  return (
    <div className="card card-pad grid gap-2 text-sm">
      {rows.map((r) => (
        <div key={r.name} className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-text-soft">{r.name}</span>
          <span className="font-medium whitespace-nowrap">{formatMoney(r.total)}</span>
        </div>
      ))}
    </div>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rawRange } = await searchParams;
  const range: ReportRange = rawRange === "month" ? "month" : "today";

  const data = await getReportsData(range);
  if (!data) redirect("/login");

  return (
    <div>
      <PageHeader
        title="Reportes"
        subtitle={range === "today" ? "Movimiento de hoy" : "Acumulado del mes"}
        actions={
          <div className="flex gap-2">
            <Link
              href="/reports?range=today"
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                range === "today"
                  ? "border-primary bg-primary text-white"
                  : "border-line-strong bg-surface text-text-soft"
              }`}
            >
              Hoy
            </Link>
            <Link
              href="/reports?range=month"
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                range === "month"
                  ? "border-primary bg-primary text-white"
                  : "border-line-strong bg-surface text-text-soft"
              }`}
            >
              Este mes
            </Link>
          </div>
        }
      />

      {data.sales && (
        <Section title="Ventas">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile value={formatMoney(data.sales.totalSales)} label="total vendido" />
            <StatTile value={data.sales.ordersCount} label="pedidos facturados" />
            <StatTile value={formatMoney(data.sales.averageTicket)} label="ticket promedio" />
            {data.newCustomersCount !== null && (
              <StatTile value={data.newCustomersCount} label="clientes nuevos" />
            )}
          </div>
        </Section>
      )}

      {data.funnel && (
        <Section title="Cotizaciones">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile value={data.funnel.quotesCreated} label="creadas" />
            <StatTile value={data.funnel.quotesWon} label="ganadas" tone="success" />
            <StatTile value={data.funnel.quotesLost} label="perdidas" />
            <StatTile value={formatMoney(data.funnel.lostValue)} label="valor perdido" />
          </div>
          {data.funnel.lostReasons.length > 0 && (
            <div className="card card-pad mt-3 grid gap-1 text-sm">
              <p className="mb-1 text-xs font-medium text-text-soft">Motivos de pérdida</p>
              {data.funnel.lostReasons.map((r) => (
                <div key={r.reason} className="flex justify-between gap-3">
                  <span className="text-text-soft">{r.reason}</span>
                  <span className="font-medium">{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {data.operations && (
        <Section title="Operación">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              value={data.operations.pendingReviewNow}
              label="pendientes de revisión (ahora)"
              href="/orders/review"
              tone={data.operations.pendingReviewNow > 0 ? "warning" : undefined}
            />
            <StatTile value={data.operations.returnedInRange} label="devueltos a vendedora" />
            <StatTile
              value={data.operations.invoiceErrorsInRange}
              label="errores de facturación"
              tone={data.operations.invoiceErrorsInRange > 0 ? "danger" : undefined}
            />
            <StatTile
              value={
                data.operations.avgHoursToReview !== null
                  ? `${data.operations.avgHoursToReview.toFixed(1)} h`
                  : "—"
              }
              label="tiempo prom. a revisión"
            />
            <StatTile
              value={
                data.operations.avgHoursToInvoice !== null
                  ? `${data.operations.avgHoursToInvoice.toFixed(1)} h`
                  : "—"
              }
              label="tiempo prom. a facturar"
            />
            {data.atRiskCount !== null && (
              <StatTile
                value={data.atRiskCount}
                label="clientes en riesgo"
                tone={data.atRiskCount > 0 ? "warning" : undefined}
              />
            )}
          </div>
        </Section>
      )}

      {(data.bySeller?.length || data.byCustomer?.length || data.byProduct?.length) && (
        <div className="grid gap-5 lg:grid-cols-3">
          {data.bySeller && data.bySeller.length > 0 && (
            <Section title="Ventas por vendedora">
              <RankList rows={data.bySeller} />
            </Section>
          )}
          {data.byCustomer && data.byCustomer.length > 0 && (
            <Section title="Top clientes">
              <RankList rows={data.byCustomer} />
            </Section>
          )}
          {data.byProduct && data.byProduct.length > 0 && (
            <Section title="Top productos">
              <RankList rows={data.byProduct} />
            </Section>
          )}
        </div>
      )}

      {data.lowStockProducts && data.lowStockProducts.length > 0 && (
        <Section title="Inventario más bajo">
          <div className="card card-pad grid gap-2 text-sm">
            {data.lowStockProducts.map((p) => (
              <div key={p.code} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">
                  {p.name} <span className="text-xs text-text-muted">{p.code}</span>
                </span>
                <span
                  className={`font-medium ${(p.stock ?? 0) <= 10 ? "text-warning" : "text-text"}`}
                >
                  {p.stock}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-text-muted">
            Los productos sin sincronizar con Siigo no tienen dato de inventario, así que no
            aparecen en esta lista.
          </p>
        </Section>
      )}
    </div>
  );
}
