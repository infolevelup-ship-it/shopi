import Link from "next/link";
import { redirect } from "next/navigation";
import { getReportsData, type ReportRange } from "@/lib/actions/reports";

function formatMoney(value: number) {
  return value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="text-2xl font-semibold text-neutral-900">{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
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
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← Inicio
      </Link>

      <div className="mt-1 mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-900">Reportes</h1>
        <div className="flex gap-2 text-sm">
          <Link
            href="/reports?range=today"
            className={`rounded-md px-3 py-1.5 ${range === "today" ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-700"}`}
          >
            Hoy
          </Link>
          <Link
            href="/reports?range=month"
            className={`rounded-md px-3 py-1.5 ${range === "month" ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-700"}`}
          >
            Este mes
          </Link>
        </div>
      </div>

      {data.sales && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">Ventas</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total vendido" value={formatMoney(data.sales.totalSales)} />
            <Stat label="Pedidos facturados" value={data.sales.ordersCount} />
            <Stat label="Ticket promedio" value={formatMoney(data.sales.averageTicket)} />
            {data.newCustomersCount !== null && <Stat label="Clientes nuevos" value={data.newCustomersCount} />}
          </div>
        </section>
      )}

      {data.funnel && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">Cotizaciones</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Creadas" value={data.funnel.quotesCreated} />
            <Stat label="Ganadas" value={data.funnel.quotesWon} />
            <Stat label="Perdidas" value={data.funnel.quotesLost} />
            <Stat label="Valor perdido" value={formatMoney(data.funnel.lostValue)} />
          </div>
          {data.funnel.lostReasons.length > 0 && (
            <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-3 text-sm">
              <p className="mb-1 text-xs font-medium text-neutral-500">Motivos de pérdida</p>
              {data.funnel.lostReasons.map((r) => (
                <div key={r.reason} className="flex justify-between text-neutral-700">
                  <span>{r.reason}</span>
                  <span>{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {data.operations && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">Operación</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Pendientes de revisión (ahora)" value={data.operations.pendingReviewNow} />
            <Stat label="Devueltos" value={data.operations.returnedInRange} />
            <Stat label="Errores de facturación" value={data.operations.invoiceErrorsInRange} />
            <Stat
              label="Tiempo prom. a revisión"
              value={data.operations.avgHoursToReview !== null ? `${data.operations.avgHoursToReview.toFixed(1)} h` : "—"}
            />
            <Stat
              label="Tiempo prom. a facturar"
              value={data.operations.avgHoursToInvoice !== null ? `${data.operations.avgHoursToInvoice.toFixed(1)} h` : "—"}
            />
          </div>
        </section>
      )}

      {data.atRiskCount !== null && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">Comercial</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Clientes en riesgo" value={data.atRiskCount} />
          </div>
        </section>
      )}

      {(data.bySeller || data.byCustomer || data.byProduct) && (
        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          {data.bySeller && data.bySeller.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-neutral-700">Ventas por vendedora</h2>
              <div className="space-y-1 rounded-lg border border-neutral-200 bg-white p-3 text-sm">
                {data.bySeller.map((r) => (
                  <div key={r.name} className="flex justify-between">
                    <span className="text-neutral-700">{r.name}</span>
                    <span className="text-neutral-900">{formatMoney(r.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.byCustomer && data.byCustomer.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-neutral-700">Top clientes</h2>
              <div className="space-y-1 rounded-lg border border-neutral-200 bg-white p-3 text-sm">
                {data.byCustomer.map((r) => (
                  <div key={r.name} className="flex justify-between">
                    <span className="text-neutral-700">{r.name}</span>
                    <span className="text-neutral-900">{formatMoney(r.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.byProduct && data.byProduct.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-neutral-700">Top productos</h2>
              <div className="space-y-1 rounded-lg border border-neutral-200 bg-white p-3 text-sm">
                {data.byProduct.map((r) => (
                  <div key={r.name} className="flex justify-between">
                    <span className="text-neutral-700">{r.name}</span>
                    <span className="text-neutral-900">{formatMoney(r.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {data.lowStockProducts && data.lowStockProducts.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">Stock más bajo</h2>
          <p className="mb-2 text-xs text-neutral-400">
            Sin sincronizar con Siigo todavía = sin dato de stock, no aparece aquí.
          </p>
          <div className="space-y-1 rounded-lg border border-neutral-200 bg-white p-3 text-sm">
            {data.lowStockProducts.map((p) => (
              <div key={p.code} className="flex justify-between">
                <span className="text-neutral-700">
                  {p.name} <span className="text-xs text-neutral-400">{p.code}</span>
                </span>
                <span className="text-neutral-900">{p.stock}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
