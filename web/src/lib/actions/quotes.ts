"use server";

import { createClient } from "@/lib/supabase/server";

export type QuoteSearchResult = {
  id: string;
  quote_number: string;
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

export async function searchQuotes(query: string): Promise<QuoteSearchResult[]> {
  const supabase = await createClient();
  let request = supabase
    .from("quotes")
    .select(
      "id, quote_number, status, grand_total, created_at, customer:customers(legal_name, first_name, last_name, commercial_name), seller:users!quotes_seller_id_fkey(name)",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const q = query.trim();
  if (q) {
    request = request.ilike("quote_number", `%${q}%`);
  }

  const { data, error } = await request;
  if (error) {
    throw new Error(`No se pudo buscar cotizaciones: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
    const seller = Array.isArray(row.seller) ? row.seller[0] : row.seller;
    return {
      id: row.id,
      quote_number: row.quote_number,
      status: row.status,
      grand_total: row.grand_total,
      created_at: row.created_at,
      customer_name: customerDisplayName(customer ?? null),
      seller_name: seller?.name ?? null,
    };
  });
}

export type QuoteItemInput = {
  productId: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
};

export type CreateQuoteResult =
  | { ok: true; quoteId: string }
  | { ok: false; error: string };

export async function createQuoteAction(
  customerId: string,
  items: QuoteItemInput[],
  notes?: string,
): Promise<CreateQuoteResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_quote", {
    p_customer_id: customerId,
    p_items: items.map((i) => ({
      product_id: i.productId,
      quantity: i.quantity,
      unit_price: i.unitPrice,
      discount_percent: i.discountPercent ?? 0,
    })),
    p_notes: notes || undefined,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, quoteId: data!.id };
}

export type QuoteActionResult = { ok: true } | { ok: false; error: string };

export async function sendQuoteAction(quoteId: string): Promise<QuoteActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_quote", { p_quote_id: quoteId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function acceptQuoteAction(quoteId: string): Promise<QuoteActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_quote_accepted", { p_quote_id: quoteId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function loseQuoteAction(
  quoteId: string,
  reason: string,
): Promise<QuoteActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_quote_lost", {
    p_quote_id: quoteId,
    p_reason: reason,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
