import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { OrderActions } from "./order-actions";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  SUBMITTED: "Enviado",
  PENDING_REVIEW: "Pendiente de revisión",
  IN_REVIEW: "En revisión",
  RETURNED_TO_SELLER: "Devuelto a vendedora",
  APPROVED_FOR_INVOICE: "Aprobado para facturar",
  INVOICING: "Facturando",
  INVOICED: "Facturado",
  READY_FOR_DISPATCH: "Listo para despacho",
  DISPATCHED: "Despachado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  BLOCKED: "Bloqueado",
};

const PAYMENT_LABEL: Record<string, string> = {
  contado: "Contado",
  credito_15: "Crédito 15 días",
  credito_30: "Crédito 30 días",
  credito_45: "Crédito 45 días",
  credito_60: "Crédito 60 días",
  contra_entrega: "Contra entrega",
};

function formatMoney(value: number) {
  return value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

function customerDisplayName(c: {
  legal_name: string | null;
  first_name: string | null;
  last_name: string | null;
  commercial_name: string | null;
} | null) {
  if (!c) return "(sin cliente)";
  return (
    c.commercial_name ??
    c.legal_name ??
    (`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "(sin nombre)")
  );
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: order }, profile] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, status, payment_method, subtotal_gross, discount_total, subtotal_net, tax_total, retention_total, grand_total, notes, created_at, submitted_at, cancelled_at, cancellation_reason, seller_id, customer:customers(legal_name, first_name, last_name, commercial_name), seller:users!orders_seller_id_fkey(name)",
      )
      .eq("id", id)
      .maybeSingle(),
    getCurrentProfile(),
  ]);

  if (!order) {
    notFound();
  }

  const { data: items } = await supabase
    .from("order_items")
    .select("id, product_name_snapshot, product_code_snapshot, quantity, unit_price, discount_value, tax_percent, line_total")
    .eq("order_id", id)
    .order("created_at", { ascending: true });

  const customer = Array.isArray(order.customer) ? order.customer[0] : order.customer;
  const seller = Array.isArray(order.seller) ? order.seller[0] : order.seller;

  const canAct =
    !!profile &&
    (profile.id === order.seller_id || profile.role === "SUPERVISOR" || profile.role === "ADMIN");

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/orders" className="text-sm text-neutral-500 hover:underline">
        ← Pedidos
      </Link>

      <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">{order.order_number}</h1>
            <p className="text-sm text-neutral-500">{customerDisplayName(customer ?? null)}</p>
            <p className="text-xs text-neutral-400">Vendedora: {seller?.name ?? "—"}</p>
          </div>
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
            {STATUS_LABEL[order.status] ?? order.status}
          </span>
        </div>

        {order.status === "CANCELLED" && order.cancellation_reason && (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">
            Cancelado: {order.cancellation_reason}
          </p>
        )}

        {order.payment_method && (
          <p className="mt-2 text-xs text-neutral-500">
            Forma de pago: {PAYMENT_LABEL[order.payment_method] ?? order.payment_method}
          </p>
        )}

        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
              <th className="pb-2">Producto</th>
              <th className="pb-2 text-right">Cant.</th>
              <th className="pb-2 text-right">Precio</th>
              <th className="pb-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((item) => (
              <tr key={item.id} className="border-b border-neutral-100">
                <td className="py-2">
                  {item.product_name_snapshot}
                  <span className="ml-1 text-xs text-neutral-400">{item.product_code_snapshot}</span>
                </td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">{formatMoney(item.unit_price)}</td>
                <td className="py-2 text-right">{formatMoney(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 space-y-1 border-t border-neutral-200 pt-3 text-sm">
          <div className="flex justify-end gap-4">
            <span className="text-neutral-500">Subtotal</span>
            <span className="w-28 text-right">{formatMoney(order.subtotal_gross)}</span>
          </div>
          <div className="flex justify-end gap-4">
            <span className="text-neutral-500">Descuento</span>
            <span className="w-28 text-right">-{formatMoney(order.discount_total)}</span>
          </div>
          <div className="flex justify-end gap-4">
            <span className="text-neutral-500">IVA</span>
            <span className="w-28 text-right">{formatMoney(order.tax_total)}</span>
          </div>
          {order.retention_total > 0 && (
            <div className="flex justify-end gap-4">
              <span className="text-neutral-500">Retención</span>
              <span className="w-28 text-right">-{formatMoney(order.retention_total)}</span>
            </div>
          )}
          <div className="flex justify-end gap-4 text-base font-semibold text-neutral-900">
            <span>Total a pagar</span>
            <span className="w-28 text-right">{formatMoney(order.grand_total)}</span>
          </div>
        </div>

        {order.notes && (
          <p className="mt-4 border-t border-neutral-200 pt-3 text-sm text-neutral-600">
            {order.notes}
          </p>
        )}
      </div>

      {canAct && (
        <div className="mt-6">
          <OrderActions orderId={order.id} status={order.status} />
        </div>
      )}
    </main>
  );
}
