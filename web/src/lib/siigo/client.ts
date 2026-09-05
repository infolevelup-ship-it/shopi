import "server-only";
import type {
  SiigoCustomer,
  SiigoCustomerCreatePayload,
  SiigoCustomerListResponse,
  SiigoInvoice,
  SiigoInvoiceCreatePayload,
  SiigoInvoiceListResponse,
  SiigoProduct,
} from "./types";

// Capa de integración única con Siigo (doc 06 §2 y §21: "WOW UI -> WOW
// Backend -> Siigo Adapter -> Siigo API", nunca URLs/tokens/reglas fiscales
// repartidos por las pantallas). Todo lo de este archivo es server-only —
// SIIGO_ACCESS_KEY nunca debe llegar al navegador (doc 05 §9).
//
// No probado contra la API real: esta sesión no tiene salida de red hacia
// api.siigo.com (bloqueado por política de organización). Construido según
// doc 06 y la referencia pública de Siigo — falta la primera prueba real
// antes de confiar en esto en producción. Ver docs/PENDIENTES.md § Fase 7.

const SIIGO_BASE_URL = "https://api.siigo.com";

export class SiigoApiError extends Error {
  status: number;
  body: string;
  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "SiigoApiError";
    this.status = status;
    this.body = body;
  }
}

// Cualquier falla que no sea una respuesta HTTP limpia con código de
// estado (abort por timeout, conexión perdida, DNS) — doc 06 §17: "timeout
// ≠ factura inexistente". No sabemos si Siigo alcanzó a procesar la
// solicitud antes de perderse la respuesta, así que nunca se puede tratar
// como "seguro que falló" ni como "seguro que funcionó" — el llamador debe
// marcar la operación como UNCERTAIN y bloquear un nuevo intento hasta
// reconciliar (doc 06 §18).
export class SiigoUncertainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiigoUncertainError";
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

// Cache de token en memoria del proceso — doc 06 §3: "cachearse mientras
// sea válido". No sobrevive un cold start de la función serverless, pero
// eso solo cuesta una llamada extra a /auth, no es un problema de fondo.
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getSiigoToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }

  const username = process.env.SIIGO_USERNAME;
  const accessKey = process.env.SIIGO_ACCESS_KEY;
  if (!username || !accessKey) {
    throw new Error("Faltan SIIGO_USERNAME / SIIGO_ACCESS_KEY en las variables de entorno");
  }

  const res = await fetch(`${SIIGO_BASE_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, access_key: accessKey }),
  });

  if (!res.ok) {
    throw new SiigoApiError("No se pudo autenticar contra Siigo", res.status, await safeText(res));
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

async function siigoFetch(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const partnerId = process.env.SIIGO_PARTNER_ID;
  if (!partnerId) {
    throw new Error("Falta SIIGO_PARTNER_ID en las variables de entorno");
  }
  const token = await getSiigoToken();

  const res = await fetch(`${SIIGO_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "Partner-Id": partnerId,
      ...init.headers,
    },
  });

  // Token vencido/inválido a mitad de camino: un solo reintento con token
  // fresco, no un loop (doc 06 §16: 4xx de autenticación es su propia
  // categoría de error, no algo para reintentar indefinidamente).
  if (res.status === 401 && !retried) {
    cachedToken = null;
    return siigoFetch(path, init, true);
  }

  return res;
}

// Validado (doc 06 §4): buscar principalmente por `identification`. Si hay
// más de un resultado, es un conflicto de duplicados — no crear nada,
// dejarlo para que un humano decida (doc 06 §4: "no crear un tercero
// automáticamente").
export async function findSiigoCustomersByIdentification(identification: string): Promise<SiigoCustomer[]> {
  const res = await siigoFetch(`/v1/customers?identification=${encodeURIComponent(identification)}`);
  if (!res.ok) {
    throw new SiigoApiError("Error buscando cliente en Siigo", res.status, await safeText(res));
  }
  const data = (await res.json()) as SiigoCustomerListResponse;
  return data.results ?? [];
}

export async function createSiigoCustomer(payload: SiigoCustomerCreatePayload): Promise<SiigoCustomer> {
  const res = await siigoFetch("/v1/customers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new SiigoApiError("Error creando cliente en Siigo", res.status, await safeText(res));
  }
  return (await res.json()) as SiigoCustomer;
}

// Validado (doc 06 §10): un solo GET trae available_quantity + warehouses,
// no hace falta un endpoint de inventario aparte.
export async function getSiigoProduct(siigoProductId: string): Promise<SiigoProduct | null> {
  const res = await siigoFetch(`/v1/products/${encodeURIComponent(siigoProductId)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new SiigoApiError("Error consultando producto en Siigo", res.status, await safeText(res));
  }
  return (await res.json()) as SiigoProduct;
}

// Catálogo público DIAN/Siigo de tipos de identificación (igual para
// cualquier cuenta, no específico de WOW — a diferencia de la retención o
// el centro de costo, que sí son datos propios de la cuenta y por eso
// quedaron fuera de esta fase, doc 06 §14/§22). Cubre los `document_type`
// que WOW realmente usa (customers/new/page.tsx: NIT, CC, CE, PAS, TI).
const DOCUMENT_TYPE_TO_SIIGO_ID_TYPE: Record<string, string> = {
  NIT: "31",
  CC: "13",
  CE: "22",
  PAS: "41",
  TI: "12",
};

export type WowCustomerForSiigo = {
  customer_type: string;
  document_type: string;
  document_number: string;
  check_digit: string | null;
  legal_name: string | null;
  first_name: string | null;
  last_name: string | null;
  commercial_name: string | null;
  phone: string | null;
  address: string | null;
  state_code: string | null;
  city_code: string | null;
  fiscal_responsibility: string | null;
  /** Siigo acepta varias; `fiscal_responsibility` es solo la primera. */
  fiscal_responsibilities: string[] | null;
  vat_responsible: boolean | null;
};

// Construye el payload de creación a partir de la fila de `customers` en
// WOW. doc 06 §7: Siigo no separa nada, se manda `name` como arreglo tal
// cual — nunca cortar por el primer espacio.
export function buildSiigoCustomerPayload(customer: WowCustomerForSiigo): SiigoCustomerCreatePayload {
  const idType = DOCUMENT_TYPE_TO_SIIGO_ID_TYPE[customer.document_type];
  if (!idType) {
    throw new Error(`Tipo de documento "${customer.document_type}" sin mapeo a Siigo id_type`);
  }

  const isCompany = customer.customer_type === "juridica";
  const name = isCompany
    ? [customer.legal_name ?? ""]
    : [customer.first_name ?? "", customer.last_name ?? ""];

  const payload: SiigoCustomerCreatePayload = {
    person_type: isCompany ? "Company" : "Person",
    id_type: { code: idType },
    identification: customer.document_number,
    name,
    branch_office: 0,
  };

  if (customer.check_digit) payload.check_digit = customer.check_digit;
  if (customer.commercial_name) payload.commercial_name = customer.commercial_name;
  if (customer.vat_responsible !== null) payload.vat_responsible = customer.vat_responsible;
  // Se mandan todas las que tenga marcadas; la columna singular queda solo
  // como respaldo para filas anteriores a la migración 0021.
  const responsibilities =
    customer.fiscal_responsibilities?.length
      ? customer.fiscal_responsibilities
      : customer.fiscal_responsibility
        ? [customer.fiscal_responsibility]
        : [];
  if (responsibilities.length > 0) {
    payload.fiscal_responsibilities = responsibilities.map((code) => ({ code }));
  }
  if (customer.address || customer.state_code || customer.city_code) {
    payload.address = {
      address: customer.address ?? undefined,
      city: {
        country_code: "Co",
        state_code: customer.state_code ?? undefined,
        city_code: customer.city_code ?? undefined,
      },
    };
  }
  if (customer.phone) {
    payload.phones = [{ indicative: "57", number: customer.phone }];
  }

  return payload;
}

// ============================================================================
// Facturación (Fase 7-8, doc 01 §18, doc 06 §12-19). NADA de lo que sigue se
// probó contra la cuenta real — a diferencia de customer/product arriba, el
// doc 06 da reglas para facturar pero ningún payload/respuesta real de
// ejemplo. Construido con la máxima fidelidad posible al doc 06 y a la
// referencia pública de Siigo, pero es la pieza de todo el proyecto que
// menos se puede dar por buena sin la primera prueba real. Ver
// docs/PENDIENTES.md § Fase 7-8 para el detalle exacto de qué falta probar.

// Validado (doc 06 §19): único tipo de documento electrónico vigente en la
// cuenta — no hay que elegir en tiempo de ejecución.
export const SIIGO_INVOICE_DOCUMENT_TYPE_ID = 34963;

// Validado (doc 06 §14): catálogo real de Retefuente de la cuenta de WOW.
// 10% deliberadamente NO está — no se encontró en el catálogo real, y el
// formulario de pedidos ya la excluye del selector desde la Fase 5. Si un
// pedido trae un % sin mapeo aquí, facturar debe fallar alto y claro, nunca
// inventar un id.
const SIIGO_RETENTION_ID_BY_PERCENT: Record<string, number> = {
  "1": 2970,
  "2": 2969,
  "2.5": 2956,
  "3.5": 2967,
  "4": 2955,
  "6": 2954,
  "7": 2968,
  "11": 18453,
};

export function getSiigoRetentionId(retentionPercent: number): number | null {
  if (!retentionPercent) return null;
  const id = SIIGO_RETENTION_ID_BY_PERCENT[String(retentionPercent)];
  if (!id) {
    throw new Error(
      `Retención ${retentionPercent}% no tiene id de Siigo confirmado (doc 06 §14) — no se puede facturar este pedido`,
    );
  }
  return id;
}

export type SiigoInvoiceOrderItemInput = {
  code: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discountValue: number;
  siigoTaxId: number | null; // null = sin IVA en esta línea, se omite `taxes`
};

export type SiigoInvoiceOrderInput = {
  orderNumber: string;
  grandTotal: number;
  retentionPercent: number;
  siigoCustomerId: string;
  costCenter: number;
  /** Tipo de documento a emitir. Configurable para poder probar contra uno no electrónico. */
  documentTypeId: number;
  paymentTypeId: number;
  /** Plazo en días de una venta a crédito; se traduce a la fecha de vencimiento del pago. */
  creditDays?: number;
  sellerSiigoId?: number;
  items: SiigoInvoiceOrderItemInput[];
};

// Ensambla el payload a partir de valores YA resueltos (ids de Siigo para
// impuesto/forma de pago/centro de costo ya buscados por el llamador —
// esta función no toca la base de datos, solo arma el JSON, para poder
// probarla sola sin red ni Supabase, igual que buildSiigoCustomerPayload).
function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function buildSiigoInvoicePayload(input: SiigoInvoiceOrderInput): SiigoInvoiceCreatePayload {
  const retentionId = getSiigoRetentionId(input.retentionPercent);

  const payload: SiigoInvoiceCreatePayload = {
    document: { id: input.documentTypeId },
    date: new Date().toISOString().slice(0, 10),
    customer: { id: input.siigoCustomerId },
    cost_center: input.costCenter,
    observations: `Pedido WOW ${input.orderNumber}`,
    items: input.items.map((item) => ({
      code: item.code,
      description: item.name,
      quantity: item.quantity,
      price: item.unitPrice,
      discount: item.discountValue || undefined,
      taxes: item.siigoTaxId ? [{ id: item.siigoTaxId }] : undefined,
    })),
    payments: [
      {
        id: input.paymentTypeId,
        value: input.grandTotal,
        ...(input.creditDays
          ? { due_date: addDays(new Date(), input.creditDays).toISOString().slice(0, 10) }
          : {}),
      },
    ],
  };

  if (input.sellerSiigoId) payload.seller = input.sellerSiigoId;
  if (retentionId) payload.retentions = [{ id: retentionId }];

  return payload;
}

// doc 06 §17: timeout ≠ factura inexistente. Cualquier fallo que no sea una
// respuesta HTTP limpia (abort por `timeoutMs`, conexión perdida) se
// reporta como SiigoUncertainError — nunca como "seguro que no se creó".
export async function createSiigoInvoice(
  payload: SiigoInvoiceCreatePayload,
  timeoutMs = 25_000,
): Promise<SiigoInvoice> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await siigoFetch("/v1/invoices", {
      method: "POST",
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    throw new SiigoUncertainError(
      err instanceof Error ? err.message : "Fallo de red incierto creando la factura en Siigo",
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new SiigoApiError("Error creando factura en Siigo", res.status, await safeText(res));
  }
  return (await res.json()) as SiigoInvoice;
}

export async function getSiigoInvoice(siigoInvoiceId: string): Promise<SiigoInvoice | null> {
  const res = await siigoFetch(`/v1/invoices/${encodeURIComponent(siigoInvoiceId)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new SiigoApiError("Error consultando factura en Siigo", res.status, await safeText(res));
  }
  return (await res.json()) as SiigoInvoice;
}

// Para reconciliación (doc 06 §18): buscar por cliente + ventana de fecha
// alrededor del intento incierto. Heurística, no una búsqueda exacta por
// referencia — Siigo no confirmó (doc 06) que exponga un campo de
// referencia externa buscable. El resultado se muestra a un humano
// (ADMIN) para confirmar, nunca se asocia solo.
export async function listSiigoInvoices(params: {
  customerId?: string;
  createdStart?: string;
  createdEnd?: string;
}): Promise<SiigoInvoice[]> {
  const query = new URLSearchParams();
  if (params.customerId) query.set("customer_id", params.customerId);
  if (params.createdStart) query.set("created_start", params.createdStart);
  if (params.createdEnd) query.set("created_end", params.createdEnd);

  const res = await siigoFetch(`/v1/invoices?${query.toString()}`);
  if (!res.ok) {
    throw new SiigoApiError("Error listando facturas en Siigo", res.status, await safeText(res));
  }
  const data = (await res.json()) as SiigoInvoiceListResponse;
  return data.results ?? [];
}
