import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { QuoteActions } from "./quote-actions";
import { Callout, PageHeader, StatusBadge } from "@/components/ui";
import { customerDisplayName, formatDate, formatMoney } from "@/lib/ui/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/ui/status";
import { PRICE_LISTS } from "@/lib/ui/fiscal";

function Condition({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3 sm:justify-start">
      <dt className="text-text-soft">{label}:</dt>
      <dd className="text-text">{value}</dd>
    </div>
  );
}

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: quote }, profile] = await Promise.all([
    supabase
      .from("quotes")
      .select(
        "id, quote_number, status, price_list, payment_method, retention_percent, retention_total, valid_until, subtotal, discount_total, tax_total, grand_total, notes, created_at, sent_at, accepted_at, lost_at, lost_reason, seller_id, customer:customers(id, legal_name, first_name, last_name, commercial_name), seller:users!quotes_seller_id_fkey(name)",
      )
      .eq("id", id)
      .maybeSingle(),
    getCurrentProfile(),
  ]);

  if (!quote) {
    notFound();
  }

  const { data: items } = await supabase
    .from("quote_items")
    .select(
      "id, product_name_snapshot, product_code_snapshot, quantity, unit_price, discount_value, tax_percent, line_total",
    )
    .eq("quote_id", id)
    .order("created_at", { ascending: true });

  const customer = Array.isArray(quote.customer) ? quote.customer[0] : quote.customer;
  const seller = Array.isArray(quote.seller) ? quote.seller[0] : quote.seller;

  const canAct =
    !!profile &&
    (profile.id === quote.seller_id || profile.role === "SUPERVISOR" || profile.role === "ADMIN");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={{ href: "/quotes", label: "Cotizaciones" }}
        title={quote.quote_number}
        subtitle={
          <>
            {customer ? (
              <Link href={`/customers/${customer.id}`} className="hover:underline">
                {customerDisplayName(customer)}
              </Link>
            ) : (
              "(sin cliente)"
            )}
            {seller?.name ? ` · Vendedora: ${seller.name}` : ""} · Creada{" "}
            {formatDate(quote.created_at)}
          </>
        }
        actions={<StatusBadge kind="quote" status={quote.status} />}
      />

      <div className="grid gap-5">
        {quote.status === "LOST" && quote.lost_reason && (
          <Callout tone="danger" title="Cotización perdida">
            {quote.lost_reason}
          </Callout>
        )}

        <section className="card card-pad">
          <h2 className="mb-3 text-base font-semibold">Productos</h2>

          <div className="desktop-only -mx-2">
            <table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="text-right">Cant.</th>
                  <th className="text-right">Precio</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(items ?? []).map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="font-medium">{item.product_name_snapshot}</span>
                      <div className="text-xs text-text-soft">{item.product_code_snapshot}</div>
                    </td>
                    <td className="text-right">{item.quantity}</td>
                    <td className="text-right">{formatMoney(item.unit_price)}</td>
                    <td className="text-right font-medium">{formatMoney(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mobile-only grid gap-2">
            {(items ?? []).map((item) => (
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
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-1 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-soft">Subtotal</dt>
              <dd>{formatMoney(quote.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-soft">Descuento</dt>
              <dd>-{formatMoney(quote.discount_total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-soft">IVA</dt>
              <dd>{formatMoney(quote.tax_total)}</dd>
            </div>
            {quote.retention_total > 0 && (
              <div className="flex justify-between">
                <dt className="text-text-soft">
                  Retención{quote.retention_percent ? ` (${quote.retention_percent}%)` : ""}
                </dt>
                <dd>-{formatMoney(quote.retention_total)}</dd>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-line pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd>{formatMoney(quote.grand_total)}</dd>
            </div>
          </dl>

          {/* Lo que la vendedora le prometió al cliente: si la cotización se
              convierte en pedido, esto es lo que debe respetarse. */}
          <dl className="mt-3 grid gap-1 border-t border-line pt-3 text-sm sm:grid-cols-2">
            {quote.payment_method && (
              <Condition
                label="Forma de pago"
                value={PAYMENT_METHOD_LABEL[quote.payment_method] ?? quote.payment_method}
              />
            )}
            {quote.price_list && (
              <Condition
                label="Lista de precio"
                value={
                  PRICE_LISTS.find((p) => p.value === quote.price_list)?.label ?? quote.price_list
                }
              />
            )}
            {quote.valid_until && (
              <Condition label="Válida hasta" value={formatDate(quote.valid_until)} />
            )}
          </dl>

          {quote.notes && (
            <p className="mt-3 border-t border-line pt-3 text-sm text-text-soft">{quote.notes}</p>
          )}
        </section>

        {canAct && <QuoteActions quoteId={quote.id} status={quote.status} />}
      </div>
    </div>
  );
}
