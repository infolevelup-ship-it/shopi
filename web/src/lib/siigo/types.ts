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
};

export type SiigoCustomerListResponse = {
  results: SiigoCustomer[];
  pagination?: { page: number; page_size: number; total_results: number };
};

// Payload de creación — mismo shape que SiigoCustomer sin `id`/`active`.
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
