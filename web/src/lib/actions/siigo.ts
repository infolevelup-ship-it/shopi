"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getCurrentProfile } from "@/lib/auth";
import {
  findSiigoCustomersByIdentification,
  createSiigoCustomer,
  getSiigoProduct,
  buildSiigoCustomerPayload,
  SiigoApiError,
} from "@/lib/siigo/client";

// Fase 7 (doc 10 §10, "lectura" + "create customer" — facturar queda
// deliberadamente fuera de esta pasada, doc 01 §18). `customers.siigo_customer_id`
// y `products.stock_cache` no tienen política de UPDATE (mismo diseño que
// orders/quotes) — se escriben con el cliente service_role, nunca desde
// RLS, con el rol revalidado a mano aquí (doc 01 §48: ocultar un botón no
// es seguridad).

export type CustomerSyncResult =
  | { ok: true; outcome: "already_linked" | "matched" | "created"; siigoCustomerId: string }
  | { ok: true; outcome: "conflict"; matches: number }
  | { ok: false; error: string };

// doc 06 §5: WOW busca -> Siigo busca -> si existe: asociar -> si no: crear
// -> guardar ID externo. doc 06 §4: si hay más de un resultado, es un
// conflicto — no crear nada, un humano decide.
export async function syncCustomerToSiigoAction(customerId: string): Promise<CustomerSyncResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "ADMIN") {
    return { ok: false, error: "Solo un administrador puede sincronizar con Siigo (doc 05 §5)" };
  }

  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select(
      "id, customer_type, document_type, document_number, document_number_normalized, check_digit, legal_name, first_name, last_name, commercial_name, phone, address, state_code, city_code, fiscal_responsibility, vat_responsible, siigo_customer_id",
    )
    .eq("id", customerId)
    .maybeSingle();

  if (!customer) {
    return { ok: false, error: "Cliente no encontrado" };
  }
  if (customer.siigo_customer_id) {
    return { ok: true, outcome: "already_linked", siigoCustomerId: customer.siigo_customer_id };
  }

  const serviceClient = createServiceRoleClient();
  const startedAt = new Date().toISOString();

  try {
    const matches = await findSiigoCustomersByIdentification(customer.document_number_normalized);

    if (matches.length > 1) {
      await serviceClient.from("integration_logs").insert({
        system: "SIIGO",
        operation: "CUSTOMER_LOOKUP",
        entity_type: "customer",
        entity_id: customer.id,
        status: "CONFLICT",
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      });
      return { ok: true, outcome: "conflict", matches: matches.length };
    }

    let siigoId: string;
    let outcome: "matched" | "created";

    if (matches.length === 1) {
      siigoId = matches[0].id;
      outcome = "matched";
    } else {
      const payload = buildSiigoCustomerPayload(customer);
      const created = await createSiigoCustomer(payload);
      siigoId = created.id;
      outcome = "created";
    }

    await serviceClient.from("customers").update({ siigo_customer_id: siigoId }).eq("id", customer.id);
    await serviceClient.from("integration_logs").insert({
      system: "SIIGO",
      operation: outcome === "created" ? "CUSTOMER_CREATE" : "CUSTOMER_LOOKUP",
      entity_type: "customer",
      entity_id: customer.id,
      external_id: siigoId,
      status: "SUCCESS",
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });

    return { ok: true, outcome, siigoCustomerId: siigoId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    const httpStatus = err instanceof SiigoApiError ? err.status : null;
    await serviceClient.from("integration_logs").insert({
      system: "SIIGO",
      operation: "CUSTOMER_SYNC",
      entity_type: "customer",
      entity_id: customer.id,
      status: "ERROR",
      http_status: httpStatus,
      error_message: message,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });
    return { ok: false, error: message };
  }
}

export type StockSyncResult = { ok: true; updated: number; skipped: number } | { ok: false; error: string };

// doc 06 §10: el stock crítico viene de Siigo; antes de aprobar un pedido
// bodega debe poder refrescarlo. Sincroniza el stock de todos los
// productos de un pedido de una vez — este es el único punto de la UI
// donde hoy se necesita (checklist "Inventario disponible", Fase 6).
export async function syncOrderProductStockAction(orderId: string): Promise<StockSyncResult> {
  const profile = await getCurrentProfile();
  if (!profile || !["WAREHOUSE", "SUPERVISOR", "ADMIN"].includes(profile.role)) {
    return { ok: false, error: "Solo bodega/supervisor/admin puede actualizar stock" };
  }

  const supabase = await createClient();
  const { data: items } = await supabase
    .from("order_items")
    .select("product:products(id, siigo_product_id)")
    .eq("order_id", orderId);

  const products = (items ?? [])
    .map((i) => (Array.isArray(i.product) ? i.product[0] : i.product))
    .filter((p): p is { id: string; siigo_product_id: string | null } => !!p);

  if (products.length === 0) {
    return { ok: false, error: "El pedido no tiene productos para sincronizar" };
  }

  const serviceClient = createServiceRoleClient();
  let updated = 0;
  let skipped = 0;

  for (const product of products) {
    if (!product.siigo_product_id) {
      skipped++;
      continue;
    }
    const startedAt = new Date().toISOString();
    try {
      const siigoProduct = await getSiigoProduct(product.siigo_product_id);
      if (!siigoProduct) {
        skipped++;
        continue;
      }
      await serviceClient
        .from("products")
        .update({
          stock_cache: siigoProduct.available_quantity ?? null,
          stock_updated_at: new Date().toISOString(),
        })
        .eq("id", product.id);
      await serviceClient.from("integration_logs").insert({
        system: "SIIGO",
        operation: "STOCK_SYNC",
        entity_type: "product",
        entity_id: product.id,
        external_id: product.siigo_product_id,
        status: "SUCCESS",
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      });
      updated++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      const httpStatus = err instanceof SiigoApiError ? err.status : null;
      await serviceClient.from("integration_logs").insert({
        system: "SIIGO",
        operation: "STOCK_SYNC",
        entity_type: "product",
        entity_id: product.id,
        external_id: product.siigo_product_id,
        status: "ERROR",
        http_status: httpStatus,
        error_message: message,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      });
      skipped++;
    }
  }

  if (updated === 0) {
    return { ok: false, error: `No se pudo actualizar stock (${skipped} sin siigo_product_id o con error)` };
  }
  return { ok: true, updated, skipped };
}
