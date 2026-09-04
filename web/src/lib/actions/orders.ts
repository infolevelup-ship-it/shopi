"use server";

import { createClient } from "@/lib/supabase/server";
import { syncOrderToGhlAction } from "@/lib/actions/ghl";
import type { Database } from "@/lib/supabase/database.types";

type OrderStatus = Database["public"]["Enums"]["order_status"];

export type OrderSearchResult = {
  id: string;
  order_number: string;
  status: string;
  grand_total: number;
  created_at: string;
  customer_name: string | null;
  seller_name: string | null;
};

function customerDisplayName(c: {
  legal_name: string | null;
  first_name: string | null;
  last_name: string | null;
  commercial_name: string | null;
} | null) {
  if (!c) return null;
  return (
    c.commercial_name ??
    c.legal_name ??
    (`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || null)
  );
}

export async function searchOrders(
  query: string,
  statuses?: OrderStatus[],
): Promise<OrderSearchResult[]> {
  const supabase = await createClient();
  let request = supabase
    .from("orders")
    .select(
      "id, order_number, status, grand_total, created_at, customer:customers(legal_name, first_name, last_name, commercial_name), seller:users!orders_seller_id_fkey(name)",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const q = query.trim();
  if (q) {
    request = request.ilike("order_number", `%${q}%`);
  }
  if (statuses && statuses.length > 0) {
    request = request.in("status", statuses);
  }

  const { data, error } = await request;
  if (error) {
    throw new Error(`No se pudo buscar pedidos: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
    const seller = Array.isArray(row.seller) ? row.seller[0] : row.seller;
    return {
      id: row.id,
      order_number: row.order_number,
      status: row.status,
      grand_total: row.grand_total,
      created_at: row.created_at,
      customer_name: customerDisplayName(customer ?? null),
      seller_name: seller?.name ?? null,
    };
  });
}

export type OrderItemInput = {
  productId: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
};

export type CreateOrderResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

export async function createOrderAction(
  customerId: string,
  items: OrderItemInput[],
  paymentMethod: string,
  retentionPercent: number,
  notes?: string,
): Promise<CreateOrderResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_order", {
    p_customer_id: customerId,
    p_items: items.map((i) => ({
      product_id: i.productId,
      quantity: i.quantity,
      unit_price: i.unitPrice,
      discount_percent: i.discountPercent ?? 0,
    })),
    p_payment_method: paymentMethod || undefined,
    p_retention_percent: retentionPercent,
    p_notes: notes || undefined,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  // doc 07 §4/§9: best-effort — un fallo aquí nunca invalida el pedido
  // que ya se creó en WOW, solo queda registrado para reintentar.
  await syncOrderToGhlAction(data!.id);

  return { ok: true, orderId: data!.id };
}

export type ReviewQueueItem = {
  id: string;
  order_number: string;
  status: string;
  grand_total: number;
  submitted_at: string | null;
  customer_name: string | null;
  seller_name: string | null;
};

// Cola de bodega (doc 08 §13): pedidos SUBMITTED/PENDING_REVIEW/IN_REVIEW,
// más antiguos primero. RLS (orders_select) ya limita esto a
// WAREHOUSE/SUPERVISOR/ADMIN viendo todos los pedidos; una vendedora que
// llegue aquí solo vería los propios en esos estados.
export async function searchReviewQueue(): Promise<ReviewQueueItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, grand_total, submitted_at, customer:customers(legal_name, first_name, last_name, commercial_name), seller:users!orders_seller_id_fkey(name)",
    )
    .in("status", ["SUBMITTED", "PENDING_REVIEW", "IN_REVIEW"])
    .order("submitted_at", { ascending: true });

  if (error) {
    throw new Error(`No se pudo cargar la cola de revisión: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
    const seller = Array.isArray(row.seller) ? row.seller[0] : row.seller;
    return {
      id: row.id,
      order_number: row.order_number,
      status: row.status,
      grand_total: row.grand_total,
      submitted_at: row.submitted_at,
      customer_name: customerDisplayName(customer ?? null),
      seller_name: seller?.name ?? null,
    };
  });
}

export type ChecklistState = {
  customerOk: boolean;
  productsOk: boolean;
  quantitiesOk: boolean;
  pricesOk: boolean;
  inventoryOk: boolean;
  paymentOk: boolean;
  receiptsOk: boolean;
  fiscalDataOk: boolean;
  printedReceipt: boolean;
};

export type OrderActionResult = { ok: true } | { ok: false; error: string };

export async function startOrderReviewAction(orderId: string): Promise<OrderActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_order_review", { p_order_id: orderId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function approveOrderAction(
  orderId: string,
  checklist: ChecklistState,
  notes?: string,
): Promise<OrderActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_order_for_invoice", {
    p_order_id: orderId,
    p_customer_ok: checklist.customerOk,
    p_products_ok: checklist.productsOk,
    p_quantities_ok: checklist.quantitiesOk,
    p_prices_ok: checklist.pricesOk,
    p_inventory_ok: checklist.inventoryOk,
    p_payment_ok: checklist.paymentOk,
    p_receipts_ok: checklist.receiptsOk,
    p_fiscal_data_ok: checklist.fiscalDataOk,
    p_printed_receipt: checklist.printedReceipt,
    p_notes: notes || undefined,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function returnOrderAction(
  orderId: string,
  reason: string,
  checklist: ChecklistState,
): Promise<OrderActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("return_order_to_seller", {
    p_order_id: orderId,
    p_reason: reason,
    p_customer_ok: checklist.customerOk,
    p_products_ok: checklist.productsOk,
    p_quantities_ok: checklist.quantitiesOk,
    p_prices_ok: checklist.pricesOk,
    p_inventory_ok: checklist.inventoryOk,
    p_payment_ok: checklist.paymentOk,
    p_receipts_ok: checklist.receiptsOk,
    p_fiscal_data_ok: checklist.fiscalDataOk,
    p_printed_receipt: checklist.printedReceipt,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function submitOrderAction(orderId: string): Promise<OrderActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_order", { p_order_id: orderId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function cancelOrderAction(
  orderId: string,
  reason: string,
): Promise<OrderActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_order", {
    p_order_id: orderId,
    p_reason: reason,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
