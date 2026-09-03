import "server-only";
import type {
  SiigoCustomer,
  SiigoCustomerCreatePayload,
  SiigoCustomerListResponse,
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
  if (customer.fiscal_responsibility) {
    payload.fiscal_responsibilities = [{ code: customer.fiscal_responsibility }];
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
