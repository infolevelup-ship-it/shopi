import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProductsByIds } from "@/lib/actions/products";
import { QuoteForm, type QuoteFormLine } from "@/components/quote-form";
import type { PriceList } from "@/lib/ui/fiscal";
import { precioDeLista } from "@/lib/ui/precios";

// Solo mientras la cotización siga siendo negociable. Una ya convertida es el
// respaldo de un pedido que existe; la base también lo impide, esto es para no
// llegar a un formulario que va a fallar al guardar.
const EDITABLES = ["DRAFT", "SENT", "FOLLOW_UP", "ACCEPTED"];

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select(
      "id, quote_number, status, price_list, payment_method, retention_percent, valid_until, notes, customer:customers(id, customer_type, document_type, document_number, legal_name, first_name, last_name, commercial_name, phone, status, responsible_user_id)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!quote) notFound();
  if (!EDITABLES.includes(quote.status)) redirect(`/quotes/${id}`);

  const { data: items } = await supabase
    .from("quote_items")
    .select(
      "product_id, product_code_snapshot, product_name_snapshot, quantity, unit_price, discount_percent",
    )
    .eq("quote_id", id)
    .order("created_at", { ascending: true });

  // `quote_items` guarda el precio con el que se cotizó, no las tres listas;
  // se traen los productos para poder re-tarifar al cambiar de lista.
  const productIds = (items ?? []).map((i) => i.product_id).filter((v): v is string => !!v);
  const products = await getProductsByIds([...new Set(productIds)]);
  const byId = new Map(products.map((p) => [p.id, p]));

  const priceList = (quote.price_list as PriceList | null) ?? "salon";

  const lines: QuoteFormLine[] = (items ?? [])
    .filter((i) => i.product_id)
    .map((i) => {
      const p = byId.get(i.product_id!);
      return {
        productId: i.product_id!,
        name: i.product_name_snapshot ?? p?.name ?? "",
        code: i.product_code_snapshot ?? p?.code ?? "",
        prices: {
          publico: p?.price_public ?? null,
          profesional: p?.price_professional ?? null,
          salon: p?.price_salon ?? null,
        },
        quantity: Number(i.quantity),
        // El precio que se va a guardar es el del catálogo de hoy, así que es
        // el que se muestra: si apareciera el cotizado, la vendedora vería un
        // total y se guardaría otro.
        unitPrice: p ? (precioDeLista(p, priceList) ?? Number(i.unit_price)) : Number(i.unit_price),
        discountPercent: Number(i.discount_percent ?? 0),
      };
    });

  const customer = Array.isArray(quote.customer) ? quote.customer[0] : quote.customer;

  return (
    <QuoteForm
      mode="edit"
      quoteId={quote.id}
      quoteNumber={quote.quote_number}
      initial={{
        customer: customer ? { ...customer, responsible_name: null } : null,
        lines,
        priceList,
        paymentMethod: quote.payment_method ?? "contado",
        retentionPercent: Number(quote.retention_percent ?? 0),
        validUntil: quote.valid_until ?? "",
        notes: quote.notes ?? "",
      }}
    />
  );
}
