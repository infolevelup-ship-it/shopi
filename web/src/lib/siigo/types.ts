// Formas de los objetos que devuelve/recibe la API de Siigo v1. Los campos
// marcados como "validado" vienen de doc 06 §6/§7/§10/§19/§22 (datos reales
// de la cuenta de WOW). El resto sigue la referencia pública de Siigo pero
// no se ha probado contra la cuenta real todavía — ver
// docs/PENDIENTES.md § Fase 7.

export type SiigoAuthResponse = {
  access_token: string;
  expires_in: number; // segundos
  token_type?: string;
};

export type SiigoWarehouseStock = {
  id: number;
  name: string;
  quantity: number;
};

// Validado (doc 06 §10): el stock viene incluido en el objeto de producto,
// no en un endpoint aparte — available_quantity (total) + warehouses
// (desglose por bodega).
export type SiigoProduct = {
  id: string;
  code: string;
  name: string;
  active?: boolean;
  available_quantity?: number;
  warehouses?: SiigoWarehouseStock[];
  taxes?: { id: number; name: string; type: string; percentage: number }[];
  unit?: { code?: string; name?: string };
  unit_label?: string;
  /** Siigo agrupa por moneda y dentro trae las listas de precio con nombre. */
  prices?: {
    currency_code?: string;
    price_list?: { position?: number; name?: string; value?: number }[];
  }[];
};

export type SiigoProductListResponse = {
  pagination?: { page?: number; page_size?: number; total_results?: number };
  results?: SiigoProduct[];
};

export type SiigoFiscalResponsibility = { code: string; name?: string };

// Validado (doc 06 §6/§7): person_type, name como arreglo (1 elemento para
// Company, 2 para Person — nombres/apellidos por separado, sin adivinar
// dónde cortar), fiscal_responsibilities, vat_responsible.
export type SiigoCustomer = {
  id: string;
  person_type: "Person" | "Company";
  id_type?: { code: string };
  identification: string;
  check_digit?: string;
  name: string[];
  commercial_name?: string;
  active?: boolean;
  vat_responsible?: boolean;
  fiscal_responsibilities?: SiigoFiscalResponsibility[];
  address?: {
    address?: string;
    city?: {
      country_code?: string;
      state_code?: string;
      state_name?: string;
      city_code?: string;
      city_name?: string;
    };
    postal_code?: string;
  };
  phones?: { indicative?: string; number?: string; extension?: string }[];
  contacts?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: { indicative?: string; number?: string; extension?: string };
  }[];
};

export type SiigoCustomerListResponse = {
  results: SiigoCustomer[];
  pagination?: { page: number; page_size: number; total_results: number };
};

// Payload y respuesta de factura. A diferencia de SiigoCustomer, NINGUNA
// parte de este shape se validó contra la cuenta real (doc 06 §12/§19 dan
// reglas, no un ejemplo de payload/respuesta real) — sigue la referencia
// pública de la API de Siigo. Ver docs/PENDIENTES.md § Fase 7-8.
export type SiigoInvoiceItem = {
  code: string;
  description?: string;
  quantity: number;
  price: number;
  discount?: number;
  taxes?: { id: number }[];
};

export type SiigoInvoicePayment = {
  id: number;
  value: number;
  due_date?: string;
};

export type SiigoInvoiceCreatePayload = {
  document: { id: number };
  date: string; // YYYY-MM-DD
  customer: { id: string };
  cost_center?: number;
  seller?: number;
  observations?: string;
  items: SiigoInvoiceItem[];
  payments: SiigoInvoicePayment[];
  retentions?: { id: number }[];
};

export type SiigoInvoice = {
  id: string;
  document?: { id: number };
  number?: number;
  name?: string; // p.ej. "FV-4-36756" (doc 06 §19)
  date?: string;
  customer?: { id: string; identification?: string };
  total?: number;
  stamp?: { status?: string };
  mail?: { status?: string };
};

export type SiigoInvoiceListResponse = {
  results: SiigoInvoice[];
  pagination?: { page: number; page_size: number; total_results: number };
};

// Payload de creación — mismo shape que SiigoCustomer sin `id`/`active`.
/** Actualizar acepta el mismo cuerpo que crear (PUT /v1/customers/{id}). */
export type SiigoCustomerUpdatePayload = SiigoCustomerCreatePayload;

export type SiigoCustomerCreatePayload = {
  person_type: "Person" | "Company";
  id_type: { code: string };
  identification: string;
  check_digit?: string;
  name: string[];
  commercial_name?: string;
  branch_office?: number;
  vat_responsible?: boolean;
  fiscal_responsibilities?: SiigoFiscalResponsibility[];
  address?: {
    address?: string;
    city?: { country_code: string; state_code?: string; city_code?: string };
  };
  phones?: { indicative?: string; number: string }[];
};
