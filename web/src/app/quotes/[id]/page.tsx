import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { QuoteActions } from "./quote-actions";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  FOLLOW_UP: "En seguimiento",
  ACCEPTED: "Aceptada",
  CONVERTED: "Convertida",
  LOST: "Perdida",
  EXPIRED: "Expirada",
  CANCELLED: "Cancelada",
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
        "id, quote_number, status, subtotal, discount_total, tax_total, grand_total, notes, created_at, sent_at, accepted_at, lost_at, lost_reason, seller_id, customer:customers(legal_name, first_name, last_name, commercial_name), seller:users!quotes_seller_id_fkey(name)",
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
    .select("id, product_name_snapshot, product_code_snapshot, quantity, unit_price, discount_value, tax_percent, line_total")
    .eq("quote_id", id)
    .order("created_at", { ascending: true });

  const customer = Array.isArray(quote.customer) ? quote.customer[0] : quote.customer;
  const seller = Array.isArray(quote.seller) ? quote.seller[0] : quote.seller;

  const canAct =
    !!profile &&
    (profile.id === quote.seller_id || profile.role === "SUPERVISOR" || profile.role === "ADMIN");

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/quotes" className="text-sm text-neutral-500 hover:underline">
        ← Cotizaciones
      </Link>

      <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">{quote.quote_number}</h1>
            <p className="text-sm text-neutral-500">{customerDisplayName(customer ?? null)}</p>
            <p className="text-xs text-neutral-400">Vendedora: {seller?.name ?? "—"}</p>
          </div>
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
            {STATUS_LABEL[quote.status] ?? quote.status}
          </span>
        </div>

        {quote.status === "LOST" && quote.lost_reason && (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">
            Perdida: {quote.lost_reason}
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
            <span className="w-28 text-right">{formatMoney(quote.subtotal)}</span>
          </div>
          <div className="flex justify-end gap-4">
            <span className="text-neutral-500">Descuento</span>
            <span className="w-28 text-right">-{formatMoney(quote.discount_total)}</span>
          </div>
          <div className="flex justify-end gap-4">
            <span className="text-neutral-500">IVA</span>
            <span className="w-28 text-right">{formatMoney(quote.tax_total)}</span>
          </div>
          <div className="flex justify-end gap-4 text-base font-semibold text-neutral-900">
            <span>Total</span>
            <span className="w-28 text-right">{formatMoney(quote.grand_total)}</span>
          </div>
        </div>

        {quote.notes && (
          <p className="mt-4 border-t border-neutral-200 pt-3 text-sm text-neutral-600">
            {quote.notes}
          </p>
        )}
      </div>

      {canAct && (
        <div className="mt-6">
          <QuoteActions quoteId={quote.id} status={quote.status} />
        </div>
      )}
    </main>
  );
}
