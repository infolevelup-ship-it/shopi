import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCompanyProfile } from "@/lib/actions/settings";
import { PrintToolbar, PrintHint } from "@/components/print";
import { customerDisplayName, formatDate, formatMoney } from "@/lib/ui/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/ui/status";
import { PRICE_LISTS } from "@/lib/ui/fiscal";

export const metadata: Metadata = { title: "Cotización" };

function Line({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <span className="text-[#667085]">{label}:</span>
      <span>{value}</span>
    </div>
  );
}

export default async function PrintQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: quote }, company] = await Promise.all([
    supabase
      .from("quotes")
      .select(
        "id, quote_number, status, price_list, payment_method, retention_percent, retention_total, valid_until, subtotal, discount_total, tax_total, grand_total, notes, created_at, customer:customers(legal_name, first_name, last_name, commercial_name, document_type, document_number, check_digit, email, phone, address, city, department), seller:users!quotes_seller_id_fkey(name)",
      )
      .eq("id", id)
      .maybeSingle(),
    getCompanyProfile(),
  ]);

  if (!quote) notFound();

  const { data: items } = await supabase
    .from("quote_items")
    .select(
      "id, product_code_snapshot, product_name_snapshot, quantity, unit_price, discount_value, tax_percent, line_total",
    )
    .eq("quote_id", id)
    .order("created_at", { ascending: true });

  const customer = Array.isArray(quote.customer) ? quote.customer[0] : quote.customer;
  const seller = Array.isArray(quote.seller) ? quote.seller[0] : quote.seller;

  return (
    <div className="print-sheet">
      <PrintToolbar backHref={`/quotes/${quote.id}`} backLabel="Volver a la cotización" />

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
            <p className="text-xs tracking-wide text-[#667085] uppercase">Cotización</p>
            <p className="text-xl font-semibold">{quote.quote_number}</p>
            <p className="text-[#667085]">{formatDate(quote.created_at)}</p>
          </div>
        </header>

        {/* Lo primero que pregunta un cliente al recibir una cotización es
            hasta cuándo le sirve. */}
        <p className="mb-6 rounded-lg border border-[#e4e7ec] bg-[#f9fafb] px-3 py-2 text-sm">
          {quote.valid_until ? (
            <>
              Precios válidos hasta el{" "}
              <strong>{formatDate(quote.valid_until)}</strong>. Esta cotización no es una factura
              y no genera obligación de compra.
            </>
          ) : (
            <>
              Esta cotización no es una factura y no genera obligación de compra. Los precios
              pueden cambiar sin previo aviso.
            </>
          )}
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
            <Line label="Asesora" value={seller?.name} />
            <Line
              label="Forma de pago"
              value={
                quote.payment_method
                  ? (PAYMENT_METHOD_LABEL[quote.payment_method] ?? quote.payment_method)
                  : null
              }
            />
            <Line
              label="Lista de precio"
              value={
                quote.price_list
                  ? (PRICE_LISTS.find((p) => p.value === quote.price_list)?.label ??
                    quote.price_list)
                  : null
              }
            />
            <Line label="Válida hasta" value={formatDate(quote.valid_until)} />
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

        <div className="print-keep mb-8 flex justify-end">
          <dl className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-[#667085]">Subtotal</dt>
              <dd>{formatMoney(quote.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#667085]">Descuento</dt>
              <dd>-{formatMoney(quote.discount_total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#667085]">IVA</dt>
              <dd>{formatMoney(quote.tax_total)}</dd>
            </div>
            {Number(quote.retention_total) > 0 && (
              <div className="flex justify-between">
                <dt className="text-[#667085]">
                  Retención{quote.retention_percent ? ` (${quote.retention_percent}%)` : ""}
                </dt>
                <dd>-{formatMoney(quote.retention_total)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-[#17202a] pt-1 text-base font-semibold">
              <dt>Total</dt>
              <dd>{formatMoney(quote.grand_total)}</dd>
            </div>
          </dl>
        </div>

        {quote.notes && (
          <p className="border-t border-[#e4e7ec] pt-3 text-sm text-[#667085]">
            <span className="font-medium text-[#17202a]">Notas:</span> {quote.notes}
          </p>
        )}
      </article>

      <PrintHint />
    </div>
  );
}
