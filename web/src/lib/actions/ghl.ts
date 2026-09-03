"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  buildGhlContactPayload,
  buildGhlOpportunityPayload,
  createGhlOpportunity,
  upsertGhlContact,
  type WowCustomerForGhl,
  type WowOrderForGhl,
} from "@/lib/ghl/client";

// Fase 9 (doc 10 §12, doc 07). Igual que Siigo: esta sesión no tiene
// salida de red hacia services.leadconnectorhq.com (mismo bloqueo de
// política de organización), así que nada de esto se probó en vivo. A
// diferencia de Siigo, el riesgo si algo sale mal es bajo — GHL es CRM y
// comunicación, doc 07 §17: "WOW controla el negocio" — nunca fiscal, así
// que se sincroniza automáticamente y en silencio (best-effort) en vez de
// requerir un botón manual como con Siigo.

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

async function readAppSetting<T>(serviceClient: ServiceClient, key: string): Promise<T | null> {
  const { data } = await serviceClient.from("app_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value as T) ?? null;
}

export type GhlSyncResult = { ok: true; ghlId: string } | { ok: false; error: string };

// doc 07 §3: "Al crear/actualizar cliente -> upsert GHL contact -> guardar
// ghl_contact_id." Se llama automáticamente desde createCustomerAction
// (best-effort — si falla, el cliente en WOW queda creado igual, doc 07
// §9) y también sirve como retry manual.
export async function syncCustomerToGhlAction(customerId: string): Promise<GhlSyncResult> {
  const supabase = await createClient();
  const serviceClient = createServiceRoleClient();

  const { data: customer } = await supabase
    .from("customers")
    .select(
      "id, customer_type, document_type, document_number, legal_name, first_name, last_name, commercial_name, email, phone, address, city, state_code, city_code, fiscal_responsibility, purchase_type, customer_type_classification, channel, siigo_customer_id, responsible_user_id",
    )
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) {
    return { ok: false, error: "Cliente no encontrado" };
  }

  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) {
    return { ok: false, error: "Falta GHL_LOCATION_ID en las variables de entorno" };
  }

  let sellerName: string | null = null;
  if (customer.responsible_user_id) {
    const { data: seller } = await serviceClient
      .from("users")
      .select("name")
      .eq("id", customer.responsible_user_id)
      .maybeSingle();
    sellerName = seller?.name ?? null;
  }

  const payload = buildGhlContactPayload(locationId, sellerName, customer as WowCustomerForGhl);

  try {
    const contact = await upsertGhlContact(payload);
    await serviceClient
      .from("customers")
      .update({
        ghl_contact_id: contact.id,
        ghl_sync_status: "SYNCED",
        ghl_last_synced_at: new Date().toISOString(),
        ghl_sync_error: null,
      })
      .eq("id", customerId);
    return { ok: true, ghlId: contact.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido sincronizando con GHL";
    await serviceClient
      .from("customers")
      .update({ ghl_sync_status: "ERROR", ghl_sync_error: message, ghl_last_synced_at: new Date().toISOString() })
      .eq("id", customerId);
    return { ok: false, error: message };
  }
}

// doc 07 §4: "Al crear pedido -> create GHL opportunity -> guardar
// ghl_opportunity_id." Requiere que el cliente ya tenga ghl_contact_id —
// si no, lo sincroniza primero (mismo encadenamiento que Siigo con
// siigo_customer_id antes de facturar).
export async function syncOrderToGhlAction(orderId: string): Promise<GhlSyncResult> {
  const supabase = await createClient();
  const serviceClient = createServiceRoleClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_number, notes, payment_method, grand_total, subtotal_gross, subtotal_net, tax_total, discount_total, customer_id, seller_id",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order) {
    return { ok: false, error: "Pedido no encontrado" };
  }

  const { data: customer } = await supabase
    .from("customers")
    .select(
      "id, customer_type, document_type, document_number, legal_name, first_name, last_name, commercial_name, email, phone, address, city, state_code, city_code, fiscal_responsibility, purchase_type, customer_type_classification, channel, siigo_customer_id, ghl_contact_id",
    )
    .eq("id", order.customer_id)
    .maybeSingle();
  if (!customer) {
    return { ok: false, error: "Cliente no encontrado" };
  }

  let contactId = customer.ghl_contact_id;
  if (!contactId) {
    const contactSync = await syncCustomerToGhlAction(order.customer_id);
    if (!contactSync.ok) {
      return { ok: false, error: `No se pudo sincronizar el cliente en GHL primero: ${contactSync.error}` };
    }
    contactId = contactSync.ghlId;
  }

  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) {
    return { ok: false, error: "Falta GHL_LOCATION_ID en las variables de entorno" };
  }

  const pipelineId = await readAppSetting<string>(serviceClient, "ghl_pipeline_id");
  const pipelineStageId = await readAppSetting<string>(serviceClient, "ghl_pipeline_stage_id");
  if (!pipelineId || !pipelineStageId) {
    return {
      ok: false,
      error: "Falta configurar ghl_pipeline_id / ghl_pipeline_stage_id en app_settings",
    };
  }

  const { data: items } = await supabase
    .from("order_items")
    .select("product_code_snapshot, quantity")
    .eq("order_id", orderId);
  const itemsSummary = (items ?? []).map((i) => `${i.quantity}x ${i.product_code_snapshot}`).join(", ");

  let sellerName: string | null = null;
  let sellerGhlUserId: string | undefined;
  if (order.seller_id) {
    const { data: seller } = await serviceClient
      .from("users")
      .select("name, ghl_user_id")
      .eq("id", order.seller_id)
      .maybeSingle();
    sellerName = seller?.name ?? null;
    sellerGhlUserId = seller?.ghl_user_id ?? undefined;
  }

  const orderInput: WowOrderForGhl = {
    orderNumber: order.order_number,
    notes: order.notes,
    paymentMethod: order.payment_method,
    grandTotal: Number(order.grand_total),
    subtotalGross: Number(order.subtotal_gross),
    subtotalNet: Number(order.subtotal_net),
    taxTotal: Number(order.tax_total),
    discountTotal: Number(order.discount_total),
    itemsSummary,
  };

  const payload = buildGhlOpportunityPayload(
    { locationId, pipelineId, pipelineStageId, contactId, sellerGhlUserId, sellerName },
    customer as WowCustomerForGhl,
    orderInput,
  );

  try {
    const opportunity = await createGhlOpportunity(payload);
    await serviceClient
      .from("orders")
      .update({
        ghl_opportunity_id: opportunity.id,
        ghl_sync_status: "SYNCED",
        ghl_last_synced_at: new Date().toISOString(),
        ghl_sync_error: null,
      })
      .eq("id", orderId);
    return { ok: true, ghlId: opportunity.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido sincronizando con GHL";
    await serviceClient
      .from("orders")
      .update({ ghl_sync_status: "ERROR", ghl_sync_error: message, ghl_last_synced_at: new Date().toISOString() })
      .eq("id", orderId);
    return { ok: false, error: message };
  }
}
