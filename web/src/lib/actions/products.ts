"use server";

import { createClient } from "@/lib/supabase/server";

export type ProductSearchResult = {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  active: boolean;
  price_public: number | null;
  price_professional: number | null;
  price_salon: number | null;
  stock_cache: number | null;
  siigo_product_id: string | null;
};

export async function searchProducts(query: string): Promise<ProductSearchResult[]> {
  const supabase = await createClient();
  const q = query.trim();

  let request = supabase
    .from("products")
    .select("id, code, name, brand, active, price_public, price_professional, price_salon, stock_cache, siigo_product_id")
    .order("name", { ascending: true })
    .limit(50);

  if (q) {
    const like = `%${q}%`;
    request = request.or(`code.ilike.${like},name.ilike.${like},brand.ilike.${like}`);
  }

  const { data, error } = await request;
  if (error) {
    throw new Error(`No se pudo buscar productos: ${error.message}`);
  }
  return data ?? [];
}

// Para editar un pedido hace falta re-tarifar sus líneas, y `order_items`
// solo guarda el precio con el que se vendió, no las tres listas. Se traen los
// productos por id para poder cambiar de lista sin perder esa capacidad.
export async function getProductsByIds(ids: string[]): Promise<ProductSearchResult[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, code, name, brand, active, price_public, price_professional, price_salon, stock_cache, siigo_product_id",
    )
    .in("id", ids);

  if (error) throw new Error(`No se pudieron cargar los productos: ${error.message}`);
  return data ?? [];
}

export type CreateProductInput = {
  code: string;
  name: string;
  brand?: string;
  description?: string;
  taxPercent?: number;
  pricePublic?: number;
  priceProfessional?: number;
  priceSalon?: number;
  stockCache?: number;
};

export type CreateProductResult =
  | { ok: true; productId: string }
  | { ok: false; error: string };

export async function createProductAction(
  input: CreateProductInput,
): Promise<CreateProductResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .insert({
      code: input.code,
      name: input.name,
      brand: input.brand || null,
      description: input.description || null,
      tax_percent: input.taxPercent ?? null,
      price_public: input.pricePublic ?? null,
      price_professional: input.priceProfessional ?? null,
      price_salon: input.priceSalon ?? null,
      stock_cache: input.stockCache ?? null,
    })
    .select("id")
    .single();

  if (error) {
    // 42501 = insufficient_privilege: la política products_insert exige
    // ADMIN — el botón ya está oculto para otros roles, pero el backend es
    // el que de verdad lo impide (doc 01 §48).
    if (error.code === "42501") {
      return { ok: false, error: "Solo un administrador puede crear productos." };
    }
    if (error.code === "23505") {
      return { ok: false, error: `Ya existe un producto con el código "${input.code}".` };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true, productId: data.id };
}
