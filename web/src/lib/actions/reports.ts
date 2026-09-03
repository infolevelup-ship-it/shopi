"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

// Fase 11 (doc 10 §14, doc 01 §32/§52-53). Alcance: lo que cada rol
// realmente necesita (doc 05) — vendedora ve lo suyo, bodega ve operación,
// supervisor/admin ven todo. No se construyeron todas las ~30 métricas que
// doc 01 §32/§53 enumeran (p. ej. "diferencias de inventario detectadas" no
// tiene ninguna fuente de datos todavía — no hay conteos físicos en el
// sistema); lo que sí se construyó sale de timestamps y datos reales, nunca
// de un número inventado (doc 01 §33: "deben salir de timestamps reales,
// no de cálculos manuales").

export type ReportRange = "today" | "month";

function rangeStart(range: ReportRange): Date {
  const d = new Date();
  if (range === "today") {
    d.setHours(0, 0, 0, 0);
  } else {
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

function avgHours(pairs: { from: string | null; to: string | null }[]): number | null {
  const diffs = pairs
    .filter((p) => p.from && p.to)
    .map((p) => (new Date(p.to!).getTime() - new Date(p.from!).getTime()) / 3_600_000);
  if (diffs.length === 0) return null;
  return diffs.reduce((s, d) => s + d, 0) / diffs.length;
}

export type SalesTotals = { totalSales: number; ordersCount: number; averageTicket: number };
export type FunnelReport = {
  quotesCreated: number;
  quotesWon: number;
  quotesLost: number;
  lostValue: number;
  lostReasons: { reason: string; count: number }[];
};
export type OperationsReport = {
  pendingReviewNow: number;
  returnedInRange: number;
  invoiceErrorsInRange: number;
  avgHoursToReview: number | null;
  avgHoursToInvoice: number | null;
};
export type BreakdownRow = { name: string; total: number };
export type LowStockProduct = { name: string; code: string; stock: number | null };

export type ReportsData = {
  role: string;
  range: ReportRange;
  sales: SalesTotals | null;
  newCustomersCount: number | null;
  funnel: FunnelReport | null;
  operations: OperationsReport | null;
  bySeller: BreakdownRow[] | null;
  byCustomer: BreakdownRow[] | null;
  byProduct: BreakdownRow[] | null;
  atRiskCount: number | null;
  lowStockProducts: LowStockProduct[] | null;
};

export async function getReportsData(range: ReportRange): Promise<ReportsData | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const startIso = rangeStart(range).toISOString();
  const isSeller = profile.role === "SELLER";
  const isWarehouse = profile.role === "WAREHOUSE";
  const isSupervisorOrAdmin = profile.role === "SUPERVISOR" || profile.role === "ADMIN";

  let sales: SalesTotals | null = null;
  let newCustomersCount: number | null = null;
  let funnel: FunnelReport | null = null;
  let bySeller: BreakdownRow[] | null = null;
  let byCustomer: BreakdownRow[] | null = null;
  let byProduct: BreakdownRow[] | null = null;
  let atRiskCount: number | null = null;

  // Ventas + embudo comercial: la vendedora ve lo suyo; supervisor/admin ven
  // todo (doc 05). Bodega no ve cifras de venta — no es su rol (doc 05 §3).
  if (isSeller || isSupervisorOrAdmin) {
    let invoicedQuery = supabase
      .from("orders")
      .select("id, grand_total, seller_id, customer_id, seller:users!orders_seller_id_fkey(name), customer:customers(commercial_name, legal_name, first_name, last_name)")
      .eq("status", "INVOICED")
      .gte("invoiced_at", startIso);
    if (isSeller) invoicedQuery = invoicedQuery.eq("seller_id", profile.id);
    const { data: invoicedOrders } = await invoicedQuery;

    const totalSales = (invoicedOrders ?? []).reduce((s, o) => s + Number(o.grand_total), 0);
    const ordersCount = (invoicedOrders ?? []).length;
    sales = { totalSales, ordersCount, averageTicket: ordersCount > 0 ? totalSales / ordersCount : 0 };

    if (isSupervisorOrAdmin) {
      const sellerTotals = new Map<string, number>();
      const customerTotals = new Map<string, number>();
      for (const o of invoicedOrders ?? []) {
        const seller = Array.isArray(o.seller) ? o.seller[0] : o.seller;
        const customer = Array.isArray(o.customer) ? o.customer[0] : o.customer;
        const sellerName = seller?.name ?? "(sin vendedora)";
        const customerName = customer
          ? (customer.commercial_name ?? customer.legal_name ?? (`${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() || "(sin nombre)"))
          : "(sin cliente)";
        sellerTotals.set(sellerName, (sellerTotals.get(sellerName) ?? 0) + Number(o.grand_total));
        customerTotals.set(customerName, (customerTotals.get(customerName) ?? 0) + Number(o.grand_total));
      }
      bySeller = [...sellerTotals.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
      byCustomer = [...customerTotals.entries()]
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      // Se filtra por los ids de pedidos ya facturados en el rango (arriba)
      // en vez de un embed filtrado (order_items -> orders) — más simple y
      // sin depender de sintaxis de embeds que no se ha probado.
      const invoicedOrderIds = (invoicedOrders ?? []).map((o) => o.id);
      const productTotals = new Map<string, number>();
      if (invoicedOrderIds.length > 0) {
        const { data: items } = await supabase
          .from("order_items")
          .select("product_name_snapshot, line_total")
          .in("order_id", invoicedOrderIds);
        for (const i of items ?? []) {
          productTotals.set(i.product_name_snapshot, (productTotals.get(i.product_name_snapshot) ?? 0) + Number(i.line_total));
        }
      }
      byProduct = [...productTotals.entries()]
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
    }

    let newCustomersQuery = supabase.from("customers").select("id", { count: "exact", head: true }).gte("created_at", startIso);
    if (isSeller) newCustomersQuery = newCustomersQuery.eq("responsible_user_id", profile.id);
    const { count: newCount } = await newCustomersQuery;
    newCustomersCount = newCount ?? 0;

    let createdQuery = supabase.from("quotes").select("id", { count: "exact", head: true }).gte("created_at", startIso);
    let wonQuery = supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .in("status", ["ACCEPTED", "CONVERTED"])
      .gte("accepted_at", startIso);
    let lostQuery = supabase.from("quotes").select("grand_total, lost_reason").eq("status", "LOST").gte("lost_at", startIso);
    if (isSeller) {
      createdQuery = createdQuery.eq("seller_id", profile.id);
      wonQuery = wonQuery.eq("seller_id", profile.id);
      lostQuery = lostQuery.eq("seller_id", profile.id);
    }
    const [{ count: quotesCreated }, { count: quotesWon }, { data: lostQuotes }] = await Promise.all([
      createdQuery,
      wonQuery,
      lostQuery,
    ]);

    const lostValue = (lostQuotes ?? []).reduce((s, q) => s + Number(q.grand_total), 0);
    const lostReasonCounts = new Map<string, number>();
    for (const q of lostQuotes ?? []) {
      const reason = q.lost_reason ?? "(sin motivo)";
      lostReasonCounts.set(reason, (lostReasonCounts.get(reason) ?? 0) + 1);
    }
    funnel = {
      quotesCreated: quotesCreated ?? 0,
      quotesWon: quotesWon ?? 0,
      quotesLost: (lostQuotes ?? []).length,
      lostValue,
      lostReasons: [...lostReasonCounts.entries()].map(([reason, count]) => ({ reason, count })),
    };
  }

  if (isSupervisorOrAdmin) {
    const { count: risk } = await supabase.from("customer_metrics").select("customer_id", { count: "exact", head: true }).eq("is_at_risk", true);
    atRiskCount = risk ?? 0;
  }

  let operations: OperationsReport | null = null;
  let lowStockProducts: LowStockProduct[] | null = null;

  // Operación: bodega y supervisor/admin (doc 05 §3/§4) — doc 01 §33, los
  // tiempos salen de los timestamps reales de `orders`, nunca calculados a mano.
  if (isWarehouse || isSupervisorOrAdmin) {
    const [
      { count: pendingReviewNow },
      { count: returnedInRange },
      { count: invoiceErrorsInRange },
      { data: reviewTimes },
      { data: invoiceTimes },
      { data: products },
    ] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["SUBMITTED", "PENDING_REVIEW", "IN_REVIEW"]),
      supabase.from("order_status_history").select("id", { count: "exact", head: true }).eq("to_status", "RETURNED_TO_SELLER").gte("created_at", startIso),
      supabase.from("invoice_operations").select("id", { count: "exact", head: true }).in("status", ["ERROR_FINAL", "ERROR_RETRYABLE", "UNCERTAIN"]).gte("created_at", startIso),
      supabase.from("orders").select("submitted_at, review_started_at").not("review_started_at", "is", null).gte("review_started_at", startIso),
      supabase.from("orders").select("approved_at, invoiced_at").not("approved_at", "is", null).gte("invoiced_at", startIso),
      supabase.from("products").select("name, code, stock_cache").eq("active", true).order("stock_cache", { ascending: true, nullsFirst: false }).limit(10),
    ]);

    operations = {
      pendingReviewNow: pendingReviewNow ?? 0,
      returnedInRange: returnedInRange ?? 0,
      invoiceErrorsInRange: invoiceErrorsInRange ?? 0,
      avgHoursToReview: avgHours((reviewTimes ?? []).map((o) => ({ from: o.submitted_at, to: o.review_started_at }))),
      avgHoursToInvoice: avgHours((invoiceTimes ?? []).map((o) => ({ from: o.approved_at, to: o.invoiced_at }))),
    };
    lowStockProducts = (products ?? [])
      .filter((p) => p.stock_cache !== null)
      .map((p) => ({ name: p.name, code: p.code, stock: p.stock_cache }));
  }

  return {
    role: profile.role,
    range,
    sales,
    newCustomersCount,
    funnel,
    operations,
    bySeller,
    byCustomer,
    byProduct,
    atRiskCount,
    lowStockProducts,
  };
}
