"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { INTEGRATION_KEYS, parseIntegrationSettings } from "@/lib/integrations/settings";
import { getCurrentProfile } from "@/lib/auth";
import type { Json } from "@/lib/supabase/database.types";
import {
  buildSiigoInvoicePayload,
  createSiigoInvoice,
  getSiigoInvoice,
  listSiigoInvoices,
  SiigoApiError,
  SiigoUncertainError,
  type SiigoInvoiceOrderItemInput,
} from "@/lib/siigo/client";

// Fase 7-8 (doc 01 §18, doc 06 §12-19, doc 10 §10-11). NADA de la llamada a
// Siigo en sí se probó contra la cuenta real (esta sesión no tiene salida
// de red hacia api.siigo.com — ver docs/PENDIENTES.md § Fase 7-8). Lo que
// SÍ se construyó con cuidado y es independiente de esa limitación: la
// máquina de estados (reclamar el pedido, nunca dos facturaciones a la
// vez), la idempotencia por operación, y que un timeout nunca se confunde
// con "no se facturó" (doc 06 §17).

const DEFAULT_COST_CENTER = 86; // doc 06 §22: comportamiento real actual de la cuenta, "PUBLICO"

class InvoiceValidationError extends Error {}

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

async function readAppSettings(serviceClient: ServiceClient, keys: string[]) {
  const { data } = await serviceClient.from("app_settings").select("key, value").in("key", keys);
  const map = new Map<string, unknown>();
  for (const row of data ?? []) map.set(row.key as string, row.value);
  return map;
}

function normalizePercentKey(value: number | string | null): string {
  return String(Number(value ?? 0));
}

async function revertToApproved(serviceClient: ServiceClient, orderId: string) {
  await serviceClient
    .from("orders")
    .update({ status: "APPROVED_FOR_INVOICE" })
    .eq("id", orderId)
    .eq("status", "INVOICING");
}

async function writeAudit(
  serviceClient: ServiceClient,
  userId: string,
  action: string,
  orderId: string,
  context: Record<string, unknown>,
) {
  await serviceClient.from("audit_logs").insert({
    user_id: userId,
    action,
    entity_type: "order",
    entity_id: orderId,
    context: context as unknown as Json,
  });
}

export type InvoiceActionResult =
  | { ok: true; status: "ISSUED"; siigoInvoiceId: string }
  | { ok: true; status: "UNCERTAIN"; message: string }
  | { ok: false; error: string };

// doc 01 §18: "Solo el rol autorizado de bodega/despacho puede iniciar la
// facturación." doc 05 §6 marca Supervisor como "según política" sin
// definir cuál — queda fuera por defecto hasta que se decida.
export async function invoiceOrderAction(orderId: string): Promise<InvoiceActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || !["WAREHOUSE", "ADMIN"].includes(profile.role)) {
    return { ok: false, error: "Solo bodega o administrador puede facturar (doc 01 §18)" };
  }

  const supabase = await createClient();
  const serviceClient = createServiceRoleClient();

  // El corte de emergencia se comprueba ANTES de reclamar el pedido: si se
  // comprobara después, el pedido quedaría marcado como INVOICING sin que
  // nadie lo esté facturando, y habría que rescatarlo a mano.
  const cortes = parseIntegrationSettings(
    await readAppSettings(serviceClient, INTEGRATION_KEYS),
  );
  if (!cortes.siigoEnabled) {
    return {
      ok: false,
      error: "La integración con Siigo está desconectada. Se enciende en Configuración.",
    };
  }

  // Reclamar atómicamente: solo avanza si el pedido sigue APPROVED_FOR_INVOICE.
  // Esto es lo que evita doble clic / dos personas facturando a la vez
  // (doc 06 §20 los lista como pruebas obligatorias) — un UPDATE con WHERE
  // de estado es atómico a nivel de fila en Postgres.
  const { data: claimed } = await serviceClient
    .from("orders")
    .update({ status: "INVOICING", invoicing_started_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "APPROVED_FOR_INVOICE")
    .select("id, order_number, customer_id, seller_id, grand_total, retention_percent, payment_method, payment_method_detail")
    .maybeSingle();

  if (!claimed) {
    return {
      ok: false,
      error:
        "Este pedido no está en 'aprobado para facturar' — ya se está facturando, ya se facturó, o cambió de estado.",
    };
  }

  try {
    // Validación final (doc 01 §18) — todo esto pasa ANTES de tocar
    // invoice_operations: si algo falta, no hubo ningún intento real, no
    // hace falta dejar rastro de una llamada que nunca salió.
    const { data: customer } = await supabase
      .from("customers")
      .select("siigo_customer_id")
      .eq("id", claimed.customer_id)
      .maybeSingle();
    if (!customer?.siigo_customer_id) {
      throw new InvoiceValidationError(
        "El cliente no está sincronizado con Siigo — sincronízalo desde su ficha primero.",
      );
    }

    const { data: items } = await supabase
      .from("order_items")
      .select("product_code_snapshot, product_name_snapshot, quantity, unit_price, discount_value, tax_percent, siigo_product_id")
      .eq("order_id", orderId);

    if (!items || items.length === 0) {
      throw new InvoiceValidationError("El pedido no tiene líneas");
    }

    const settings = await readAppSettings(serviceClient, [
      "siigo_cost_center",
      "siigo_payment_types",
      "siigo_tax_ids",
      "siigo_seller_map",
      ...INTEGRATION_KEYS,
    ]);
    const integraciones = parseIntegrationSettings(settings);
    const costCenter = (settings.get("siigo_cost_center") as number | undefined) ?? DEFAULT_COST_CENTER;
    const paymentTypes = (settings.get("siigo_payment_types") as Record<string, number> | undefined) ?? {};
    const taxIds = (settings.get("siigo_tax_ids") as Record<string, number> | undefined) ?? {};
    const sellerMap = (settings.get("siigo_seller_map") as Record<string, number> | undefined) ?? {};

    // Siigo no separa "a cuántos días se paga" de "por dónde entró la plata":
    // sus tipos de pago SON el medio (Efectivo, Bancolombia, Bold) más un
    // "Crédito" genérico, y el plazo va aparte en la fecha de vencimiento.
    // Nosotros sí lo guardamos en dos campos, así que en las ventas de contado
    // manda el medio concreto — si no, todas saldrían como efectivo en los
    // informes de Siigo aunque hayan entrado por transferencia.
    const paymentKey =
      claimed.payment_method === "contado" &&
      claimed.payment_method_detail &&
      paymentTypes[claimed.payment_method_detail as string] != null
        ? (claimed.payment_method_detail as string)
        : (claimed.payment_method as string | null);

    const paymentTypeId = paymentKey ? paymentTypes[paymentKey] : undefined;
    if (!paymentTypeId) {
      throw new InvoiceValidationError(
        `Falta configurar el id de Siigo para la forma de pago "${paymentKey}" en app_settings.siigo_payment_types`,
      );
    }

    // "credito_30" -> 30 días. El plazo viaja como fecha de vencimiento del
    // pago, que es como Siigo lo espera; sin esto una factura a 30 días se
    // emitiría con vencimiento el mismo día.
    const creditDays = Number(/^credito_(\d+)$/.exec(claimed.payment_method ?? "")?.[1] ?? 0);

    const itemInputs: SiigoInvoiceOrderItemInput[] = [];
    const missingProducts: string[] = [];
    const missingTaxIds = new Set<string>();

    for (const item of items) {
      if (!item.siigo_product_id) {
        missingProducts.push(item.product_code_snapshot);
        continue;
      }
      const percentKey = normalizePercentKey(item.tax_percent);
      const taxId = taxIds[percentKey];
      if (!taxId) {
        missingTaxIds.add(percentKey);
        continue;
      }
      itemInputs.push({
        code: item.product_code_snapshot,
        name: item.product_name_snapshot,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unit_price),
        discountValue: Number(item.discount_value),
        siigoTaxId: taxId,
      });
    }

    if (missingProducts.length > 0) {
      throw new InvoiceValidationError(
        `Productos sin siigo_product_id (sincronízalos primero): ${missingProducts.join(", ")}`,
      );
    }
    if (missingTaxIds.size > 0) {
      throw new InvoiceValidationError(
        `Falta configurar el id de Siigo para IVA ${[...missingTaxIds].join("%, ")}% en app_settings.siigo_tax_ids`,
      );
    }

    const payload = buildSiigoInvoicePayload({
      orderNumber: claimed.order_number as string,
      grandTotal: Number(claimed.grand_total),
      retentionPercent: Number(claimed.retention_percent),
      siigoCustomerId: customer.siigo_customer_id,
      costCenter,
      documentTypeId: integraciones.invoiceDocumentId,
      paymentTypeId,
      creditDays: creditDays > 0 ? creditDays : undefined,
      sellerSiigoId: sellerMap[claimed.seller_id as string],
      items: itemInputs,
    });

    // A partir de aquí sí hay un intento real — cuenta para idempotencia.
    const idempotencyKey = `WOW-ORDER-${claimed.order_number}`;
    const { count: priorAttempts } = await serviceClient
      .from("invoice_operations")
      .select("id", { count: "exact", head: true })
      .eq("order_id", orderId);

    const startedAt = new Date().toISOString();
    await serviceClient.from("invoice_operations").insert({
      order_id: orderId,
      idempotency_key: idempotencyKey,
      status: "PROCESSING",
      attempt_count: (priorAttempts ?? 0) + 1,
      request_started_at: startedAt,
      last_attempt_at: startedAt,
    });

    await writeAudit(serviceClient, profile.id, "START_INVOICE", orderId, { idempotencyKey, payload });

    try {
      const invoice = await createSiigoInvoice(payload);

      await serviceClient
        .from("invoice_operations")
        .update({ status: "ISSUED", siigo_invoice_id: invoice.id, response_received_at: new Date().toISOString() })
        .eq("order_id", orderId)
        .eq("idempotency_key", idempotencyKey)
        .eq("status", "PROCESSING");

      await serviceClient.from("invoices").insert({
        order_id: orderId,
        customer_id: claimed.customer_id,
        siigo_invoice_id: invoice.id,
        invoice_number: invoice.name ?? (invoice.number ? String(invoice.number) : null),
        invoice_status: "ISSUED",
        siigo_status: invoice.stamp?.status ?? null,
        total: invoice.total ?? claimed.grand_total,
        invoice_date: invoice.date ?? startedAt,
        issued_by: profile.id,
        response_reference: invoice,
      });

      await serviceClient
        .from("orders")
        .update({ status: "INVOICED", invoiced_by: profile.id, invoiced_at: new Date().toISOString() })
        .eq("id", orderId)
        .eq("status", "INVOICING");

      await serviceClient.from("customer_activities").insert({
        customer_id: claimed.customer_id,
        user_id: profile.id,
        activity_type: "INVOICE_CREATED",
        description: `Pedido ${claimed.order_number} facturado (${invoice.name ?? invoice.id})`,
        reference_type: "order",
        reference_id: orderId,
      });
      await writeAudit(serviceClient, profile.id, "INVOICE_SUCCESS", orderId, { siigoInvoiceId: invoice.id });

      return { ok: true, status: "ISSUED", siigoInvoiceId: invoice.id };
    } catch (err) {
      if (err instanceof SiigoUncertainError) {
        // doc 06 §17: nunca revertir a APPROVED_FOR_INVOICE aquí — eso
        // dejaría facturar de nuevo un pedido que quizás YA se facturó.
        // El pedido queda "atascado" en INVOICING a propósito, hasta que
        // alguien reconcilie (ver resolveUncertainInvoiceAction abajo).
        await serviceClient
          .from("invoice_operations")
          .update({ status: "UNCERTAIN", error_message: err.message, response_received_at: new Date().toISOString() })
          .eq("order_id", orderId)
          .eq("idempotency_key", idempotencyKey)
          .eq("status", "PROCESSING");
        await writeAudit(serviceClient, profile.id, "INVOICE_UNCERTAIN", orderId, { message: err.message });

        return {
          ok: true,
          status: "UNCERTAIN",
          message:
            "No se pudo confirmar si la factura se creó en Siigo (timeout/red). El pedido queda bloqueado para facturar de nuevo hasta reconciliar — ver el panel de reconciliación.",
        };
      }

      const isRetryable = err instanceof SiigoApiError && (err.status === 429 || err.status >= 500);
      const message = err instanceof Error ? err.message : "Error desconocido facturando";
      const httpStatus = err instanceof SiigoApiError ? err.status : null;
      const body = err instanceof SiigoApiError ? err.body : null;

      await serviceClient
        .from("invoice_operations")
        .update({
          status: isRetryable ? "ERROR_RETRYABLE" : "ERROR_FINAL",
          error_code: httpStatus ? String(httpStatus) : null,
          error_message: body ? `${message}: ${body}` : message,
          response_received_at: new Date().toISOString(),
        })
        .eq("order_id", orderId)
        .eq("idempotency_key", idempotencyKey)
        .eq("status", "PROCESSING");

      await revertToApproved(serviceClient, orderId);
      await writeAudit(serviceClient, profile.id, "INVOICE_ERROR", orderId, { message, httpStatus });

      return { ok: false, error: message };
    }
  } catch (err) {
    // Falló la validación previa a llamar a Siigo — nunca se intentó nada,
    // solo hay que devolver el pedido a como estaba.
    await revertToApproved(serviceClient, orderId);
    const message = err instanceof Error ? err.message : "Error desconocido preparando la factura";
    return { ok: false, error: message };
  }
}

export type InvoiceCandidate = { siigoInvoiceId: string; name: string | null; total: number | null; date: string | null };

// doc 06 §18: reconciliación. Búsqueda por cliente + ventana de fecha
// alrededor del intento incierto — heurística, no una búsqueda exacta por
// referencia (Siigo no confirmó exponer eso). El resultado se le muestra a
// un ADMIN para que confirme, nunca se asocia solo (mismo principio que el
// conflicto de clientes duplicados en Fase 7).
export async function searchSiigoInvoiceCandidatesAction(
  orderId: string,
): Promise<{ ok: true; candidates: InvoiceCandidate[] } | { ok: false; error: string }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "ADMIN") {
    return { ok: false, error: "Solo un administrador puede reconciliar facturación" };
  }

  const serviceClient = createServiceRoleClient();
  const { data: order } = await serviceClient
    .from("orders")
    .select("customer_id, status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.status !== "INVOICING") {
    return { ok: false, error: "Este pedido no tiene una facturación incierta pendiente" };
  }

  const { data: operation } = await serviceClient
    .from("invoice_operations")
    .select("request_started_at")
    .eq("order_id", orderId)
    .eq("status", "UNCERTAIN")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!operation) {
    return { ok: false, error: "No hay una operación incierta registrada para este pedido" };
  }

  const { data: customer } = await serviceClient
    .from("customers")
    .select("siigo_customer_id")
    .eq("id", order.customer_id)
    .maybeSingle();
  if (!customer?.siigo_customer_id) {
    return { ok: false, error: "El cliente no tiene siigo_customer_id" };
  }

  const started = new Date(operation.request_started_at);
  const windowStart = new Date(started.getTime() - 60 * 60 * 1000).toISOString().slice(0, 10);
  const windowEnd = new Date(started.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);

  try {
    const results = await listSiigoInvoices({
      customerId: customer.siigo_customer_id,
      createdStart: windowStart,
      createdEnd: windowEnd,
    });
    return {
      ok: true,
      candidates: results.map((inv) => ({
        siigoInvoiceId: inv.id,
        name: inv.name ?? null,
        total: inv.total ?? null,
        date: inv.date ?? null,
      })),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error buscando en Siigo" };
  }
}

export type ReconcileResult = { ok: true } | { ok: false; error: string };

// Resuelve una operación UNCERTAIN a mano, con un humano confirmando —
// nunca automático (doc 06 §18).
export async function resolveUncertainInvoiceAction(
  orderId: string,
  resolution: "confirmed_issued" | "confirmed_not_issued",
  siigoInvoiceId?: string,
): Promise<ReconcileResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "ADMIN") {
    return { ok: false, error: "Solo un administrador puede reconciliar facturación" };
  }

  const serviceClient = createServiceRoleClient();
  const { data: order } = await serviceClient
    .from("orders")
    .select("id, order_number, customer_id, grand_total, status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.status !== "INVOICING") {
    return { ok: false, error: "Este pedido no tiene una facturación incierta pendiente" };
  }

  const { data: operation } = await serviceClient
    .from("invoice_operations")
    .select("id, idempotency_key")
    .eq("order_id", orderId)
    .eq("status", "UNCERTAIN")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!operation) {
    return { ok: false, error: "No hay una operación incierta registrada para este pedido" };
  }

  if (resolution === "confirmed_not_issued") {
    await serviceClient
      .from("invoice_operations")
      .update({
        status: "ERROR_FINAL",
        error_message: "Reconciliado a mano: no se encontró la factura en Siigo, se permite reintentar",
        response_received_at: new Date().toISOString(),
      })
      .eq("id", operation.id);
    await revertToApproved(serviceClient, orderId);
    await writeAudit(serviceClient, profile.id, "INVOICE_RECONCILED", orderId, { resolution });
    return { ok: true };
  }

  if (!siigoInvoiceId) {
    return { ok: false, error: "Falta el id de la factura en Siigo para confirmar que sí se emitió" };
  }

  try {
    const invoice = await getSiigoInvoice(siigoInvoiceId);
    if (!invoice) {
      return { ok: false, error: "Ese id de factura no existe en Siigo" };
    }

    await serviceClient
      .from("invoice_operations")
      .update({ status: "ISSUED", siigo_invoice_id: invoice.id, response_received_at: new Date().toISOString() })
      .eq("id", operation.id);

    await serviceClient.from("invoices").insert({
      order_id: orderId,
      customer_id: order.customer_id,
      siigo_invoice_id: invoice.id,
      invoice_number: invoice.name ?? (invoice.number ? String(invoice.number) : null),
      invoice_status: "ISSUED",
      siigo_status: invoice.stamp?.status ?? null,
      total: invoice.total ?? order.grand_total,
      invoice_date: invoice.date ?? new Date().toISOString(),
      issued_by: profile.id,
      response_reference: invoice,
    });

    await serviceClient
      .from("orders")
      .update({ status: "INVOICED", invoiced_by: profile.id, invoiced_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("status", "INVOICING");

    await writeAudit(serviceClient, profile.id, "INVOICE_RECONCILED", orderId, { resolution, siigoInvoiceId });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error confirmando la factura en Siigo" };
  }
}
