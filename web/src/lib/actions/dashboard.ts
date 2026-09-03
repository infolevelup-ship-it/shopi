"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

// Fase 10 (doc 01 §30, doc 10 §13): "¿qué tengo que hacer hoy?" — el panel
// diario de la vendedora. Las "Prioridades" son categorías explicables, no
// un puntaje compuesto — doc 01 §58 es explícito: la fórmula de prioridad
// "se definirá después de observar datos reales" y "nunca debe ser una caja
// negra sin explicación". Cada ítem dice por qué está ahí.

type CustomerRow = {
  id: string;
  commercial_name: string | null;
  legal_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

function displayName(c: CustomerRow): string {
  return (
    c.commercial_name ??
    c.legal_name ??
    (`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "(sin nombre)")
  );
}

function formatMoney(value: number) {
  return value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

export type PriorityItem = {
  kind: "AT_RISK" | "OPEN_QUOTE" | "RETURNED_ORDER";
  customerName: string;
  reason: string;
  link: string;
};

export type SellerDashboard = {
  sellerName: string;
  overdueFollowUpsCount: number;
  upcomingPurchasesCount: number;
  openQuotesCount: number;
  pendingOrdersCount: number;
  salesThisMonth: number;
  priorities: PriorityItem[];
};

export async function getSellerDashboard(): Promise<SellerDashboard | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const sellerId = profile.id;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const nowIso = new Date().toISOString();
  const in7Days = new Date();
  in7Days.setDate(in7Days.getDate() + 7);

  const [
    { count: overdueFollowUpsCount },
    { data: myCustomers },
    { count: openQuotesCount },
    { data: topQuotes },
    { count: pendingOrdersCount },
    { data: returnedOrders },
    { data: salesRows },
  ] = await Promise.all([
    supabase
      .from("follow_ups")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", sellerId)
      .eq("status", "PENDING")
      .lt("scheduled_at", nowIso),
    supabase
      .from("customers")
      .select("id, commercial_name, legal_name, first_name, last_name")
      .eq("responsible_user_id", sellerId),
    supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", sellerId)
      .eq("status", "SENT"),
    supabase
      .from("quotes")
      .select("id, grand_total, customer:customers(commercial_name, legal_name, first_name, last_name)")
      .eq("seller_id", sellerId)
      .eq("status", "SENT")
      .order("grand_total", { ascending: false })
      .limit(5),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", sellerId)
      .in("status", ["DRAFT", "SUBMITTED", "RETURNED_TO_SELLER"]),
    supabase
      .from("orders")
      .select("id, order_number, customer:customers(commercial_name, legal_name, first_name, last_name)")
      .eq("seller_id", sellerId)
      .eq("status", "RETURNED_TO_SELLER"),
    supabase
      .from("orders")
      .select("grand_total")
      .eq("seller_id", sellerId)
      .eq("status", "INVOICED")
      .gte("invoiced_at", startOfMonth.toISOString()),
  ]);

  const salesThisMonth = (salesRows ?? []).reduce((sum, r) => sum + Number(r.grand_total), 0);

  const customerIds = (myCustomers ?? []).map((c) => c.id);
  let metrics: {
    customer_id: string | null;
    is_at_risk: boolean | null;
    days_since_last_order: number | null;
    avg_days_between_orders: number | null;
    estimated_next_purchase_at: string | null;
  }[] = [];
  if (customerIds.length > 0) {
    const { data } = await supabase
      .from("customer_metrics")
      .select("customer_id, is_at_risk, days_since_last_order, avg_days_between_orders, estimated_next_purchase_at")
      .in("customer_id", customerIds);
    metrics = data ?? [];
  }

  const customerById = new Map((myCustomers ?? []).map((c) => [c.id, c]));

  const atRisk = metrics
    .filter((m) => m.is_at_risk)
    .sort((a, b) => (b.days_since_last_order ?? 0) - (a.days_since_last_order ?? 0));

  const upcomingPurchasesCount = metrics.filter(
    (m) => !m.is_at_risk && m.estimated_next_purchase_at && new Date(m.estimated_next_purchase_at) <= in7Days,
  ).length;

  const priorities: PriorityItem[] = [];

  for (const m of atRisk.slice(0, 5)) {
    if (!m.customer_id) continue;
    const c = customerById.get(m.customer_id);
    if (!c) continue;
    priorities.push({
      kind: "AT_RISK",
      customerName: displayName(c),
      reason: `Fuera de ciclo hace ${m.days_since_last_order} días (compra cada ~${Math.round(m.avg_days_between_orders ?? 0)} días)`,
      link: `/customers/${m.customer_id}`,
    });
  }

  for (const q of topQuotes ?? []) {
    const c = Array.isArray(q.customer) ? q.customer[0] : q.customer;
    if (!c) continue;
    priorities.push({
      kind: "OPEN_QUOTE",
      customerName: displayName(c),
      reason: `Cotización enviada por ${formatMoney(q.grand_total)} sin respuesta`,
      link: `/quotes/${q.id}`,
    });
  }

  for (const o of returnedOrders ?? []) {
    const c = Array.isArray(o.customer) ? o.customer[0] : o.customer;
    priorities.push({
      kind: "RETURNED_ORDER",
      customerName: c ? displayName(c) : "",
      reason: `Pedido ${o.order_number} devuelto — necesita corrección`,
      link: `/orders/${o.id}`,
    });
  }

  return {
    sellerName: profile.name,
    overdueFollowUpsCount: overdueFollowUpsCount ?? 0,
    upcomingPurchasesCount,
    openQuotesCount: openQuotesCount ?? 0,
    pendingOrdersCount: pendingOrdersCount ?? 0,
    salesThisMonth,
    priorities,
  };
}
