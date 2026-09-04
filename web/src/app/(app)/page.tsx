import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { getSellerDashboard, getWarehouseDashboard } from "@/lib/actions/dashboard";
import { getReportsData } from "@/lib/actions/reports";
import { DashboardPanel } from "./dashboard-panel";
import { WarehousePanel } from "./warehouse-panel";
import { StatTile } from "@/components/ui";
import { formatMoney } from "@/lib/ui/format";

// La home es distinta por rol (doc 11 §2): vendedora ve su día, bodega ve su
// cola, supervisor/admin ven el estado del negocio. El layout de (app) ya
// garantizó que hay perfil activo, así que aquí solo se decide qué panel va.
export default async function HomePage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  if (profile.role === "SELLER") {
    const data = await getSellerDashboard();
    return data ? <DashboardPanel data={data} /> : null;
  }

  if (profile.role === "WAREHOUSE") {
    const data = await getWarehouseDashboard();
    return data ? <WarehousePanel data={data} /> : null;
  }

  // Supervisor/admin (doc 11 §48): detectar cuellos de botella, no llenar de
  // gráficas. El detalle completo sigue viviendo en /reports.
  const [ops, reports] = await Promise.all([
    getWarehouseDashboard(),
    getReportsData("month"),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text">Hola, {profile.name} 👋</h1>
        <p className="mt-1 text-sm text-text-soft">Estado del negocio este mes.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          value={formatMoney(reports?.sales?.totalSales ?? 0)}
          label="ventas del mes"
          href="/reports?range=month"
        />
        <StatTile
          value={reports?.sales?.ordersCount ?? 0}
          label="pedidos facturados"
          href="/reports?range=month"
        />
        <StatTile
          value={reports?.newCustomersCount ?? 0}
          label="clientes nuevos"
          href="/customers"
        />
        <StatTile
          value={reports?.atRiskCount ?? 0}
          label="clientes en riesgo"
          href="/reports?range=month"
          tone={(reports?.atRiskCount ?? 0) > 0 ? "warning" : undefined}
        />
      </div>

      <h2 className="mt-8 mb-3 text-base font-semibold text-text">Operación ahora mismo</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          value={ops?.pendingReview ?? 0}
          label="pendientes de revisión"
          href="/orders/review"
          tone={(ops?.pendingReview ?? 0) > 0 ? "warning" : undefined}
        />
        <StatTile
          value={ops?.approvedForInvoice ?? 0}
          label="listos para facturar"
          href="/orders"
        />
        <StatTile
          value={ops?.returned ?? 0}
          label="devueltos a vendedora"
          href="/orders"
          tone={(ops?.returned ?? 0) > 0 ? "danger" : undefined}
        />
        <StatTile
          value={reports?.operations?.invoiceErrorsInRange ?? 0}
          label="errores de facturación"
          href="/orders"
          tone={(reports?.operations?.invoiceErrorsInRange ?? 0) > 0 ? "danger" : undefined}
        />
      </div>

      <div className="mt-6">
        <Link href="/reports?range=month" className="btn btn-secondary btn-block-mobile">
          Ver reportes completos
        </Link>
      </div>
    </div>
  );
}
