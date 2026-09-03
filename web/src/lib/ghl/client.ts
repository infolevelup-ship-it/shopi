import "server-only";
import type {
  GhlContact,
  GhlContactUpsertPayload,
  GhlContactUpsertResponse,
  GhlCustomField,
  GhlOpportunity,
  GhlOpportunityCreatePayload,
  GhlOpportunityCreateResponse,
} from "./types";

// Capa de integración única con GHL (doc 07 §2/§7: "WOW -> Backend -> GHL
// API", "centralizar mapping, no repartir IDs de custom field por cada
// componente"). Server-only — GHL_PRIVATE_TOKEN nunca al navegador.
//
// No probado contra la API real: esta sesión no tiene salida de red hacia
// services.leadconnectorhq.com (mismo bloqueo de política de organización
// que api.siigo.com, confirmado con curl). A diferencia de Siigo, aquí SÍ
// hay `fieldKey` reales de la cuenta (vienen del workflow legado de
// Make/GHL, docs/WORKFLOW_recibir_pedido_B2B_mapeos.md) — pero nunca se
// confirmó que la API v2 los acepte en el formato `{key, field_value}`
// usado aquí, ni los ids de pipeline/stage. Ver docs/PENDIENTES.md § Fase 9.

const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";

export class GhlApiError extends Error {
  status: number;
  body: string;
  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "GhlApiError";
    this.status = status;
    this.body = body;
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

// Se llama en línea al crear cliente/pedido (best-effort, doc 07 §9) — un
// timeout evita que un GHL lento cuelgue esa respuesta indefinidamente.
async function ghlFetch(path: string, init: RequestInit = {}, timeoutMs = 15_000): Promise<Response> {
  const token = process.env.GHL_PRIVATE_TOKEN;
  if (!token) {
    throw new Error("Falta GHL_PRIVATE_TOKEN en las variables de entorno");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${GHL_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Version: GHL_API_VERSION,
        ...init.headers,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

// doc 07 §3: "upsert GHL contact" — usa el endpoint nativo de upsert de la
// v2 (crea o actualiza por email/teléfono), en vez de buscar-y-crear a
// mano como Siigo (que no confirmó tener upsert nativo).
export async function upsertGhlContact(payload: GhlContactUpsertPayload): Promise<GhlContact> {
  const res = await ghlFetch("/contacts/upsert", { method: "POST", body: JSON.stringify(payload) });
  if (!res.ok) {
    throw new GhlApiError("Error creando/actualizando contacto en GHL", res.status, await safeText(res));
  }
  const data = (await res.json()) as GhlContactUpsertResponse;
  return data.contact;
}

export async function createGhlOpportunity(payload: GhlOpportunityCreatePayload): Promise<GhlOpportunity> {
  const res = await ghlFetch("/opportunities/", { method: "POST", body: JSON.stringify(payload) });
  if (!res.ok) {
    throw new GhlApiError("Error creando oportunidad en GHL", res.status, await safeText(res));
  }
  const data = (await res.json()) as GhlOpportunityCreateResponse;
  return data.opportunity;
}

// Mismo catálogo público DIAN que usa Siigo (web/src/lib/siigo/client.ts)
// — se duplica aquí a propósito, no se importa entre módulos de
// integración: cada uno debe poder cambiar sin arrastrar al otro.
const DOCUMENT_TYPE_TO_DIAN_CODE: Record<string, string> = {
  NIT: "31",
  CC: "13",
  CE: "22",
  PAS: "41",
  TI: "12",
};

export type WowCustomerForGhl = {
  customer_type: string;
  document_type: string;
  document_number: string;
  legal_name: string | null;
  first_name: string | null;
  last_name: string | null;
  commercial_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state_code: string | null;
  city_code: string | null;
  fiscal_responsibility: string | null;
  purchase_type: string | null;
  customer_type_classification: string | null;
  channel: string | null;
  siigo_customer_id: string | null;
};

function customerDisplayName(c: WowCustomerForGhl): string {
  return (
    c.commercial_name ??
    c.legal_name ??
    `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()
  );
}

function addCustomField(fields: GhlCustomField[], key: string, value: string | null | undefined) {
  if (value) fields.push({ key, field_value: value });
}

// fieldKeys reales, confirmados por el workflow "WOW - Recibir Pedido B2B"
// que ya los usaba (docs/WORKFLOW_recibir_pedido_B2B_mapeos.md) — incluye
// los acentos rotos tal cual GHL los resuelve (`tipo_de_identificacin`,
// sin la "ó"; `nmero_de_identificacin`, sin la primera "ú"). No inventados.
// `contacto_nombre`/`contacto_apellido`/`contacto_email` (persona de
// contacto secundaria en la empresa) se omiten: WOW no distingue esa
// persona del cliente mismo, no hay dato que mandar ahí.
export function buildGhlContactPayload(
  locationId: string,
  sellerName: string | null,
  c: WowCustomerForGhl,
): GhlContactUpsertPayload {
  const customFields: GhlCustomField[] = [];
  addCustomField(customFields, "tipo_de_identificacin", DOCUMENT_TYPE_TO_DIAN_CODE[c.document_type] ?? c.document_type);
  addCustomField(customFields, "nmero_de_identificacin", c.document_number);
  addCustomField(customFields, "razn_social", customerDisplayName(c));
  addCustomField(customFields, "tipo_persona", c.customer_type);
  addCustomField(customFields, "responsabilidad_fiscal", c.fiscal_responsibility);
  addCustomField(customFields, "cliente_direccion", c.address);
  addCustomField(customFields, "cliente_ciudad", c.city);
  addCustomField(customFields, "cliente_state_code", c.state_code);
  addCustomField(customFields, "cliente_city_code", c.city_code);
  addCustomField(customFields, "tipo_de_compra", c.purchase_type);
  addCustomField(customFields, "tipo_de_cliente", c.customer_type_classification);
  addCustomField(customFields, "canal", c.channel);
  addCustomField(customFields, "vendedora", sellerName);
  addCustomField(customFields, "id_cliente_siigo", c.siigo_customer_id);

  return {
    locationId,
    firstName: customerDisplayName(c),
    companyName: c.customer_type === "juridica" ? customerDisplayName(c) : undefined,
    email: c.email ?? undefined,
    phone: c.phone ?? undefined,
    address1: c.address ?? undefined,
    customFields,
  };
}

export type WowOrderForGhl = {
  orderNumber: string;
  notes: string | null;
  paymentMethod: string | null;
  grandTotal: number;
  subtotalGross: number;
  subtotalNet: number;
  taxTotal: number;
  discountTotal: number;
  itemsSummary: string; // p.ej. "2x OLA-4, 1x OLA-3"
};

export type GhlOpportunityContext = {
  locationId: string;
  pipelineId: string;
  pipelineStageId: string;
  contactId: string;
  sellerGhlUserId?: string;
  sellerName?: string | null;
};

// fieldKeys reales de la oportunidad, misma fuente que arriba. `lista_de_precio`
// y `cliente_nuevo` se omiten: WOW no tiene ese dato en el pedido hoy.
export function buildGhlOpportunityPayload(
  ctx: GhlOpportunityContext,
  customer: WowCustomerForGhl,
  order: WowOrderForGhl,
): GhlOpportunityCreatePayload {
  const customFields: GhlCustomField[] = [];
  addCustomField(customFields, "productos_del_pedido", order.itemsSummary);
  addCustomField(customFields, "notas_del_pedido", order.notes);
  addCustomField(customFields, "forma_pago", order.paymentMethod);
  addCustomField(customFields, "vendedora_nombre", ctx.sellerName);
  addCustomField(customFields, "nit_cliente", customer.document_number);
  addCustomField(customFields, "razn_social", customerDisplayName(customer));
  addCustomField(customFields, "nombre_comercial", customer.commercial_name);
  addCustomField(customFields, "ciudad", customer.city);
  addCustomField(customFields, "direccin", customer.address);
  addCustomField(customFields, "email_facturacin", customer.email);
  addCustomField(customFields, "telfono", customer.phone);
  addCustomField(customFields, "canal", customer.channel);
  addCustomField(customFields, "tipo_de_compra", customer.purchase_type);
  addCustomField(customFields, "tipo_de_cliente", customer.customer_type_classification);
  addCustomField(customFields, "total_pedido", String(order.grandTotal));
  addCustomField(customFields, "subtotal_bruto", String(order.subtotalGross));
  addCustomField(customFields, "subtotal_neto", String(order.subtotalNet));
  addCustomField(customFields, "iva", String(order.taxTotal));
  addCustomField(customFields, "descuentos", String(order.discountTotal));
  addCustomField(customFields, "estado_facturacin", "Pendiente");

  return {
    locationId: ctx.locationId,
    pipelineId: ctx.pipelineId,
    pipelineStageId: ctx.pipelineStageId,
    name: `${order.orderNumber} — ${customerDisplayName(customer)}`,
    status: "open",
    contactId: ctx.contactId,
    monetaryValue: order.grandTotal,
    assignedTo: ctx.sellerGhlUserId,
    customFields,
  };
}
