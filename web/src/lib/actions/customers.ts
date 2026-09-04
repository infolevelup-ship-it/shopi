"use server";

import { createClient } from "@/lib/supabase/server";
import { syncCustomerToGhlAction } from "@/lib/actions/ghl";

function normalizeDocument(raw: string) {
  return raw.replace(/\D/g, "");
}

export type CustomerSearchResult = {
  id: string;
  customer_type: string;
  document_type: string;
  document_number: string;
  legal_name: string | null;
  first_name: string | null;
  last_name: string | null;
  commercial_name: string | null;
  phone: string | null;
  status: string;
  responsible_user_id: string | null;
  responsible_name: string | null;
};

export async function searchCustomers(query: string): Promise<CustomerSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const supabase = await createClient();
  const like = `%${q}%`;

  const { data, error } = await supabase
    .from("customers")
    .select(
      "id, customer_type, document_type, document_number, legal_name, first_name, last_name, commercial_name, phone, status, responsible_user_id, responsible:users!customers_responsible_user_id_fkey(name)",
    )
    .is("merged_into_customer_id", null)
    .or(
      `document_number.ilike.${like},legal_name.ilike.${like},commercial_name.ilike.${like},first_name.ilike.${like},last_name.ilike.${like},phone.ilike.${like}`,
    )
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    throw new Error(`No se pudo buscar clientes: ${error.message}`);
  }

  return (data ?? []).map((c) => ({
    id: c.id,
    customer_type: c.customer_type,
    document_type: c.document_type,
    document_number: c.document_number,
    legal_name: c.legal_name,
    first_name: c.first_name,
    last_name: c.last_name,
    commercial_name: c.commercial_name,
    phone: c.phone,
    status: c.status,
    responsible_user_id: c.responsible_user_id,
    // Supabase infiere el join como array incluso siendo 1:1 por FK simple
    responsible_name: Array.isArray(c.responsible)
      ? (c.responsible[0]?.name ?? null)
      : ((c.responsible as { name: string } | null)?.name ?? null),
  }));
}

// Para llegar a "crear pedido" desde la ficha del cliente con el cliente ya
// puesto (doc 11 §49/§83: no hacerla buscar de nuevo lo que ya tenía en
// pantalla).
export async function getCustomerForPicker(id: string): Promise<CustomerSearchResult | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select(
      "id, customer_type, document_type, document_number, legal_name, first_name, last_name, commercial_name, phone, status, responsible_user_id, responsible:users!customers_responsible_user_id_fkey(name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    customer_type: data.customer_type,
    document_type: data.document_type,
    document_number: data.document_number,
    legal_name: data.legal_name,
    first_name: data.first_name,
    last_name: data.last_name,
    commercial_name: data.commercial_name,
    phone: data.phone,
    status: data.status,
    responsible_user_id: data.responsible_user_id,
    responsible_name: Array.isArray(data.responsible)
      ? (data.responsible[0]?.name ?? null)
      : ((data.responsible as { name: string } | null)?.name ?? null),
  };
}

export type CustomerListRow = CustomerSearchResult & {
  lastOrderAt: string | null;
  averageTicket: number | null;
  isAtRisk: boolean;
  daysSinceLastOrder: number | null;
};

// doc 11 §23: la pantalla de clientes es una lista real con contexto
// comercial (última compra, ticket, riesgo), no una caja de búsqueda vacía
// que no muestra nada hasta que alguien escribe. Sin término de búsqueda
// devuelve los más recientes.
export async function listCustomers(query: string): Promise<CustomerListRow[]> {
  const base = query.trim() ? await searchCustomers(query) : await recentCustomers();
  if (base.length === 0) return [];

  const supabase = await createClient();
  const { data: metrics } = await supabase
    .from("customer_metrics")
    .select("customer_id, last_order_at, average_ticket, is_at_risk, days_since_last_order")
    .in(
      "customer_id",
      base.map((c) => c.id),
    );

  const byId = new Map((metrics ?? []).map((m) => [m.customer_id, m]));

  return base.map((c) => {
    const m = byId.get(c.id);
    return {
      ...c,
      lastOrderAt: m?.last_order_at ?? null,
      averageTicket: m?.average_ticket != null ? Number(m.average_ticket) : null,
      isAtRisk: m?.is_at_risk ?? false,
      daysSinceLastOrder: m?.days_since_last_order != null ? Number(m.days_since_last_order) : null,
    };
  });
}

async function recentCustomers(): Promise<CustomerSearchResult[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select(
      "id, customer_type, document_type, document_number, legal_name, first_name, last_name, commercial_name, phone, status, responsible_user_id, responsible:users!customers_responsible_user_id_fkey(name)",
    )
    .is("merged_into_customer_id", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(`No se pudieron cargar clientes: ${error.message}`);

  return (data ?? []).map((c) => ({
    id: c.id,
    customer_type: c.customer_type,
    document_type: c.document_type,
    document_number: c.document_number,
    legal_name: c.legal_name,
    first_name: c.first_name,
    last_name: c.last_name,
    commercial_name: c.commercial_name,
    phone: c.phone,
    status: c.status,
    responsible_user_id: c.responsible_user_id,
    responsible_name: Array.isArray(c.responsible)
      ? (c.responsible[0]?.name ?? null)
      : ((c.responsible as { name: string } | null)?.name ?? null),
  }));
}

export type DuplicateCheckResult = {
  exactMatch: { id: string; display_name: string } | null;
  phoneMatches: { id: string; display_name: string; phone: string }[];
};

// Doc 01 §7: antes de crear, buscar por documento normalizado (bloqueo real)
// y por teléfono (aviso, no bloquea) — nunca crear a ciegas.
export async function checkDuplicateCustomer(
  documentType: string,
  documentNumber: string,
  phone: string | null,
): Promise<DuplicateCheckResult> {
  const supabase = await createClient();
  const normalized = normalizeDocument(documentNumber);

  const { data: exact, error: exactError } = await supabase
    .from("customers")
    .select("id, legal_name, first_name, last_name, commercial_name")
    .eq("document_type", documentType)
    .eq("document_number_normalized", normalized)
    .is("merged_into_customer_id", null)
    .maybeSingle();

  if (exactError) {
    throw new Error(`No se pudo validar duplicados: ${exactError.message}`);
  }

  const displayName = (c: {
    legal_name: string | null;
    first_name: string | null;
    last_name: string | null;
    commercial_name: string | null;
  }) => c.commercial_name ?? c.legal_name ?? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();

  let phoneMatches: DuplicateCheckResult["phoneMatches"] = [];
  if (phone && phone.trim()) {
    const { data: byPhone, error: phoneError } = await supabase
      .from("customers")
      .select("id, legal_name, first_name, last_name, commercial_name, phone")
      .eq("phone", phone.trim())
      .is("merged_into_customer_id", null)
      .limit(5);

    if (phoneError) {
      throw new Error(`No se pudo validar duplicados por teléfono: ${phoneError.message}`);
    }
    phoneMatches = (byPhone ?? []).map((c) => ({
      id: c.id,
      display_name: displayName(c),
      phone: c.phone ?? "",
    }));
  }

  return {
    exactMatch: exact ? { id: exact.id, display_name: displayName(exact) } : null,
    phoneMatches,
  };
}

export type CreateCustomerInput = {
  customerType: "natural" | "juridica";
  documentType: string;
  documentNumber: string;
  legalName?: string;
  firstName?: string;
  lastName?: string;
  commercialName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
};

export type CreateCustomerResult =
  | { ok: true; customerId: string }
  | { ok: false; error: string; existingCustomerId?: string };

export async function createCustomerAction(
  input: CreateCustomerInput,
): Promise<CreateCustomerResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_customer", {
    p_customer_type: input.customerType,
    p_document_type: input.documentType,
    p_document_number: input.documentNumber,
    p_legal_name: input.legalName || undefined,
    p_first_name: input.firstName || undefined,
    p_last_name: input.lastName || undefined,
    p_commercial_name: input.commercialName || undefined,
    p_email: input.email || undefined,
    p_phone: input.phone || undefined,
    p_address: input.address || undefined,
    p_city: input.city || undefined,
  });

  if (error) {
    // 23505 = unique_violation → el índice customers_document_uniq atrapó un
    // duplicado que el chequeo previo (checkDuplicateCustomer) no vio, p.ej.
    // por una carrera entre dos vendedoras creando al mismo tiempo.
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("document_type", input.documentType)
        .eq("document_number_normalized", input.documentNumber.replace(/\D/g, ""))
        .maybeSingle();
      return {
        ok: false,
        error: "Ya existe un cliente con ese documento.",
        existingCustomerId: existing?.id,
      };
    }
    return { ok: false, error: error.message };
  }

  // doc 07 §3/§9: best-effort — un fallo aquí nunca invalida al cliente
  // que ya se creó en WOW, solo queda registrado para reintentar.
  await syncCustomerToGhlAction(data!.id);

  return { ok: true, customerId: data!.id };
}
