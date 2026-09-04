import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCompanyProfile } from "@/lib/actions/settings";
import { PrintToolbar, PrintHint } from "@/components/print";
import { customerDisplayName, formatDateTimeLong, formatMoney } from "@/lib/ui/format";
import { PAYMENT_METHOD_LABEL, statusMeta } from "@/lib/ui/status";
import { PAYMENT_DETAILS, PRICE_LISTS, SALE_ORIGINS, labelOf } from "@/lib/ui/fiscal";

export const metadata: Metadata = { title: "Recibo de pedido" };

function Line({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <span className="text-[#667085]">{label}:</span>
      <span>{value}</span>
    </div>
  );
}

export default async function PrintOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: order }, company] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, status, channel, price_list, payment_method, payment_method_detail, sale_origin, notes, created_at, submitted_at, subtotal_gross, discount_total, subtotal_net, tax_total, retention_percent, retention_total, grand_total, customer:customers(legal_name, first_name, last_name, commercial_name, document_type, document_number, check_digit, email, phone, address, city, department), seller:users!orders_seller_id_fkey(name)",
      )
      .eq("id", id)
      .maybeSingle(),
    getCompanyProfile(),
  ]);

  if (!order) notFound();

  const { data: items } = await supabase
    .from("order_items")
    .select(
      "id, product_code_snapshot, product_name_snapshot, quantity, unit_price, discount_value, tax_percent, line_total",
    )
    .eq("order_id", id)
    .order("created_at", { ascending: true });

  const customer = Array.isArray(order.customer) ? order.customer[0] : order.customer;
  const seller = Array.isArray(order.seller) ? order.seller[0] : order.seller;
  const units = (items ?? []).reduce((sum, i) => sum + Number(i.quantity), 0);

  return (
    <div className="print-sheet">
      <PrintToolbar backHref={`/orders/${order.id}`} backLabel="Volver al pedido" />

      <article className="print-doc">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-[#e4e7ec] pb-4">
          <div className="text-sm leading-6">
            <p className="text-lg font-semibold">{company.name}</p>
            <Line label="NIT" value={company.document} />
            <Line label="Dirección" value={company.address} />
            <Line label="Ciudad" value={company.city} />
            <Line label="Teléfono" value={company.phone} />
            <Line label="Correo" value={company.email} />
          </div>
          <div className="text-right text-sm leading-6">
            <p className="text-xs tracking-wide text-[#667085] uppercase">Recibo de pedido</p>
            <p className="text-xl font-semibold">{order.order_number}</p>
            <p className="text-[#667085]">{formatDateTimeLong(order.created_at)}</p>
            <p className="text-[#667085]">{statusMeta("order", order.status).label}</p>
          </div>
        </header>

        {/* doc 11 §41: imprimir no tiene efecto fiscal, y la hoja tiene que
            decirlo — si no, un recibo impreso puede confundirse con la factura. */}
        <p className="mb-6 rounded-lg border border-[#fec84b] bg-[#fffaeb] px-3 py-2 text-xs text-[#b54708]">
          <strong>Este documento no es una factura</strong> y no tiene efecto fiscal. Es el
          soporte interno del pedido para la verificación física en bodega. La factura electrónica
          la emite Siigo por separado.
        </p>

        <section className="mb-6 grid gap-4 text-sm leading-6 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold tracking-wide text-[#667085] uppercase">
              Cliente
            </p>
            <p className="font-medium">
              {customer ? customerDisplayName(customer) : "(sin cliente)"}
            </p>
            {customer && (
              <>
                <Line
                  label={customer.document_type ?? "Documento"}
                  value={
                    customer.document_number
                      ? `${customer.document_number}${customer.check_digit ? `-${customer.check_digit}` : ""}`
                      : null
                  }
                />
                <Line label="Teléfono" value={customer.phone} />
                <Line label="Correo" value={customer.email} />
                <Line label="Dirección" value={customer.address} />
                <Line
                  label="Ciudad"
                  value={
                    customer.city
                      ? `${customer.city}${customer.department ? `, ${customer.department}` : ""}`
                      : null
                  }
                />
              </>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold tracking-wide text-[#667085] uppercase">
              Condiciones
            </p>
            <Line label="Vendedora" value={seller?.name} />
            <Line
              label="Forma de pago"
              value={
                order.payment_method
                  ? (PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method)
                  : null
              }
            />
            <Line label="Medio de pago" value={labelOf(PAYMENT_DETAILS, order.payment_method_detail)} />
            <Line
              label="Lista de precio"
              value={
                order.price_list
                  ? (PRICE_LISTS.find((p) => p.value === order.price_list)?.label ??
                    order.price_list)
                  : null
              }
            />
            <Line label="Tipo de venta" value={order.channel} />
            <Line label="Origen" value={labelOf(SALE_ORIGINS, order.sale_origin)} />
          </div>
        </section>

        <table className="print-table mb-4">
          <thead>
            <tr>
              <th>Código</th>
              <th>Producto</th>
              <th className="text-right">Cant.</th>
              <th className="text-right">Precio</th>
              <th className="text-right">Desc.</th>
              <th className="text-right">IVA</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((i) => (
              <tr key={i.id}>
                <td className="whitespace-nowrap">{i.product_code_snapshot}</td>
                <td>{i.product_name_snapshot}</td>
                <td className="text-right">{i.quantity}</td>
                <td className="text-right whitespace-nowrap">{formatMoney(i.unit_price)}</td>
                <td className="text-right whitespace-nowrap">
                  {Number(i.discount_value) > 0 ? `-${formatMoney(i.discount_value)}` : "—"}
                </td>
                <td className="text-right">{i.tax_percent != null ? `${i.tax_percent}%` : "—"}</td>
                <td className="text-right font-medium whitespace-nowrap">
                  {formatMoney(i.line_total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="print-keep mb-8 flex flex-col gap-4 sm:flex-row sm:justify-between">
          <p className="text-xs text-[#667085]">
            {(items ?? []).length} producto(s) · {units} unidad(es)
          </p>
          <dl className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-[#667085]">Subtotal</dt>
              <dd>{formatMoney(order.subtotal_gross)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#667085]">Descuento</dt>
              <dd>-{formatMoney(order.discount_total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#667085]">Neto</dt>
              <dd>{formatMoney(order.subtotal_net)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#667085]">IVA</dt>
              <dd>{formatMoney(order.tax_total)}</dd>
            </div>
            {Number(order.retention_total) > 0 && (
              <div className="flex justify-between">
                <dt className="text-[#667085]">
                  Retención{order.retention_percent ? ` (${order.retention_percent}%)` : ""}
                </dt>
                <dd>-{formatMoney(order.retention_total)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-[#17202a] pt-1 text-base font-semibold">
              <dt>Total</dt>
              <dd>{formatMoney(order.grand_total)}</dd>
            </div>
          </dl>
        </div>

        {order.notes && (
          <p className="mb-8 border-t border-[#e4e7ec] pt-3 text-sm text-[#667085]">
            <span className="font-medium text-[#17202a]">Notas:</span> {order.notes}
          </p>
        )}

        {/* doc 01 §17: el proceso físico se conserva — la hoja se firma en la
            verificación en bodega y en la entrega. */}
        <div className="print-keep grid gap-8 pt-12 sm:grid-cols-2">
          <p className="print-signature">Revisado por (bodega)</p>
          <p className="print-signature">Recibido por (cliente)</p>
        </div>
      </article>

      <PrintHint />
    </div>
  );
}
