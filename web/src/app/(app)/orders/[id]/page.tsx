import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { OrderActions } from "./order-actions";
import { OrderReviewPanel } from "./order-review-panel";
import { OrderStockSyncButton } from "./order-stock-sync-button";
import { InvoicePanel } from "./invoice-panel";
import { GhlSyncStatus } from "./ghl-sync-status";
import { FiscalCard } from "./fiscal-card";
import { Callout, PageHeader, StatusBadge } from "@/components/ui";
import { customerDisplayName, formatMoney } from "@/lib/ui/format";
import { PAYMENT_METHOD_LABEL, statusMeta } from "@/lib/ui/status";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // doc 11 §64: bodega necesita la ficha fiscal del cliente sin salir del
  // pedido — por eso el select trae también los campos de facturación.
  const ORDER_SELECT =
    "id, order_number, status, payment_method, retention_percent, subtotal_gross, discount_total, subtotal_net, tax_total, retention_total, grand_total, notes, created_at, submitted_at, cancelled_at, cancellation_reason, return_reason, seller_id, ghl_sync_status, ghl_sync_error, customer:customers(id, legal_name, first_name, last_name, commercial_name, document_type, document_number, email, phone, address, city, fiscal_responsibility, siigo_customer_id), seller:users!orders_seller_id_fkey(name)";

  const [{ data: initialOrder }, profile] = await Promise.all([
    supabase.from("orders").select(ORDER_SELECT).eq("id", id).maybeSingle(),
    getCurrentProfile(),
  ]);

  if (!initialOrder) {
    notFound();
  }

  // Abrir el pedido como bodega/supervisor/admin inicia la revisión (doc 01
  // §16: "al abrir el pedido" aparece el checklist) — SUBMITTED/PENDING_REVIEW
  // -> IN_REVIEW, idempotente si ya estaba en revisión. Si falla (carrera con
  // otra persona de bodega, o ya cambió de estado) se ignora: el resto de la
  // página igual se renderiza con el estado que sí exista.
  const isReviewer =
    !!profile &&
    (profile.role === "WAREHOUSE" || profile.role === "SUPERVISOR" || profile.role === "ADMIN");
  let order = initialOrder;
  if (isReviewer && (order.status === "SUBMITTED" || order.status === "PENDING_REVIEW")) {
    const { data: reviewed } = await supabase.rpc("start_order_review", { p_order_id: id });
    if (reviewed) {
      const { data: refreshed } = await supabase
        .from("orders")
        .select(ORDER_SELECT)
        .eq("id", id)
        .maybeSingle();
      if (refreshed) order = refreshed;
    }
  }

  const { data: items } = await supabase
    .from("order_items")
    .select(
      "id, product_name_snapshot, product_code_snapshot, quantity, unit_price, discount_value, tax_percent, line_total, product:products(stock_cache)",
    )
    .eq("order_id", id)
    .order("created_at", { ascending: true });

  const customer = Array.isArray(order.customer) ? order.customer[0] : order.customer;
  const seller = Array.isArray(order.seller) ? order.seller[0] : order.seller;

  const canAct =
    !!profile &&
    (profile.id === order.seller_id || profile.role === "SUPERVISOR" || profile.role === "ADMIN");
  const canReview = isReviewer && order.status === "IN_REVIEW";
  // doc 01 §18 / doc 05 §6: solo bodega o admin factura — supervisor queda
  // fuera por defecto (doc 05 §6 lo marca "según política" sin definirla).
  const canInvoice = !!profile && (profile.role === "WAREHOUSE" || profile.role === "ADMIN");
  const isAdmin = profile?.role === "ADMIN";

  let isUncertain = false;
  let uncertainMessage: string | null = null;
  let invoiceInfo: {
    invoiceNumber: string | null;
    invoiceDate: string | null;
    total: number | null;
  } | null = null;

  if (order.status === "INVOICING" && isReviewer) {
    const { data: operation } = await supabase
      .from("invoice_operations")
      .select("status, error_message")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (operation?.status === "UNCERTAIN") {
      isUncertain = true;
      uncertainMessage = operation.error_message;
    }
  } else if (order.status === "INVOICED" && isReviewer) {
    const { data: invoice } = await supabase
      .from("invoices")
      .select("invoice_number, invoice_date, total")
      .eq("order_id", order.id)
      .maybeSingle();
    if (invoice) {
      invoiceInfo = {
        invoiceNumber: invoice.invoice_number,
        invoiceDate: invoice.invoice_date,
        total: invoice.total,
      };
    }
  }

  const meta = statusMeta("order", order.status);
  const anyStockMissing = (items ?? []).some((i) => {
    const p = Array.isArray(i.product) ? i.product[0] : i.product;
    return p?.stock_cache == null;
  });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        back={{ href: "/orders", label: "Pedidos" }}
        title={order.order_number}
        subtitle={
          <>
            {customer ? (
              <Link href={`/customers/${customer.id}`} className="hover:underline">
                {customerDisplayName(customer)}
              </Link>
            ) : (
              "(sin cliente)"
            )}
            {seller?.name ? ` · Vendedora: ${seller.name}` : ""}
          </>
        }
        actions={<StatusBadge kind="order" status={order.status} />}
      />

      {/* doc 11 §95: cada estado dice qué significa y de quién es la pelota */}
      <p className="mb-5 text-sm text-text-soft">
        {meta.meaning}
        {meta.owner && meta.owner !== "—" ? ` · Responsable ahora: ${meta.owner}` : ""}
      </p>

      <div className="grid gap-5">
        {order.status === "CANCELLED" && order.cancellation_reason && (
          <Callout tone="danger" title="Pedido cancelado">
            {order.cancellation_reason}
          </Callout>
        )}

        {order.status === "RETURNED_TO_SELLER" && order.return_reason && (
          <Callout tone="warning" title="Devuelto para corrección">
            {order.return_reason}
          </Callout>
        )}

        {/* ------------------------------------------------------ productos */}
        <section className="card card-pad">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Productos</h2>
            {isReviewer && (
              // doc 11 §40: el inventario es el dato; actualizarlo es una
              // acción secundaria, no el elemento principal de la pantalla.
              <OrderStockSyncButton orderId={order.id} />
            )}
          </div>

          {isReviewer && anyStockMissing && (
            <div className="mb-4">
              <Callout tone="warning" title="Inventario sin datos">
                Algunos productos no están sincronizados con Siigo todavía, así que no hay
                inventario que mostrar para ellos. Verifica físicamente antes de aprobar.
              </Callout>
            </div>
          )}

          <div className="desktop-only -mx-2">
            <table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="text-right">Cant.</th>
                  <th className="text-right">Precio</th>
                  {isReviewer && <th className="text-right">Inventario</th>}
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(items ?? []).map((item) => {
                  const product = Array.isArray(item.product) ? item.product[0] : item.product;
                  const stock = product?.stock_cache ?? null;
                  const short = stock !== null && stock < Number(item.quantity);
                  return (
                    <tr key={item.id}>
                      <td>
                        <span className="font-medium">{item.product_name_snapshot}</span>
                        <div className="text-xs text-text-soft">{item.product_code_snapshot}</div>
                      </td>
                      <td className="text-right">{item.quantity}</td>
                      <td className="text-right">{formatMoney(item.unit_price)}</td>
                      {isReviewer && (
                        <td
                          className={`text-right ${short ? "font-semibold text-danger" : "text-text-soft"}`}
                        >
                          {stock === null ? "sin datos" : short ? `solo ${stock}` : stock}
                        </td>
                      )}
                      <td className="text-right font-medium">{formatMoney(item.line_total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* doc 11 §34: en móvil el producto es una tarjeta, nunca una tabla */}
          <ul className="mobile-only grid gap-2">
            {(items ?? []).map((item) => {
              const product = Array.isArray(item.product) ? item.product[0] : item.product;
              const stock = product?.stock_cache ?? null;
              const short = stock !== null && stock < Number(item.quantity);
              return (
                <li key={item.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium">{item.product_name_snapshot}</span>
                    <span className="font-semibold whitespace-nowrap">
                      {formatMoney(item.line_total)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-soft">{item.product_code_snapshot}</p>
                  <p className="mt-1 text-sm text-text-soft">
                    {item.quantity} × {formatMoney(item.unit_price)}
                  </p>
                  {isReviewer && (
                    <p className={`mt-1 text-sm ${short ? "font-medium text-danger" : "text-text-soft"}`}>
                      Inventario: {stock === null ? "sin datos" : short ? `solo ${stock}` : stock}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          {/* --------------------------------------------------- totales */}
          <dl className="mt-4 space-y-1 border-t border-line pt-4 text-sm">
            <Row label="Subtotal" value={formatMoney(order.subtotal_gross)} />
            <Row label="Descuento" value={`-${formatMoney(order.discount_total)}`} />
            <Row label="IVA" value={formatMoney(order.tax_total)} />
            {order.retention_total > 0 && (
              <Row
                label={`Retención${order.retention_percent ? ` (${order.retention_percent}%)` : ""}`}
                value={`-${formatMoney(order.retention_total)}`}
              />
            )}
            <div className="flex items-center justify-between border-t border-line pt-2 text-base font-semibold">
              <dt>Total a pagar</dt>
              <dd>{formatMoney(order.grand_total)}</dd>
            </div>
          </dl>

          {order.payment_method && (
            <p className="mt-3 text-sm text-text-soft">
              Forma de pago:{" "}
              <span className="text-text">
                {PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method}
              </span>
            </p>
          )}

          {order.notes && (
            <p className="mt-3 border-t border-line pt-3 text-sm text-text-soft">{order.notes}</p>
          )}
        </section>

        {/* doc 11 §64: ficha fiscal visible para quien revisa/factura */}
        {isReviewer && customer && <FiscalCard customer={customer} />}

        {canReview && <OrderReviewPanel orderId={order.id} />}

        {(order.status === "APPROVED_FOR_INVOICE" ||
          order.status === "INVOICING" ||
          order.status === "INVOICED") &&
          isReviewer && (
            <InvoicePanel
              orderId={order.id}
              orderNumber={order.order_number}
              customerName={customerDisplayName(customer ?? null)}
              grandTotal={Number(order.grand_total)}
              status={order.status}
              canInvoice={canInvoice}
              isAdmin={isAdmin}
              isUncertain={isUncertain}
              uncertainMessage={uncertainMessage}
              invoice={invoiceInfo}
            />
          )}

        {canAct && <OrderActions orderId={order.id} status={order.status} />}

        {isAdmin && (
          <GhlSyncStatus
            orderId={order.id}
            status={order.ghl_sync_status}
            error={order.ghl_sync_error}
          />
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-text-soft">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
