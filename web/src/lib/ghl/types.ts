// Formas de los objetos de la API v2 de GoHighLevel (LeadConnector). A
// diferencia de Siigo, aquí SÍ hay datos reales de la cuenta de WOW — las
// llaves de custom field (`fieldKey`) vienen del workflow legado de Make/GHL
// (docs/WORKFLOW_recibir_pedido_B2B_mapeos.md), confirmadas porque ya las
// usa la automatización actual. Lo que NO está confirmado son los ids de
// pipeline/stage/dueño — esos son específicos de la cuenta y no aparecen en
// ningún doc, van por app_settings (ver web/src/lib/ghl/client.ts).

export type GhlCustomField = { key: string; field_value: string };

export type GhlContactUpsertPayload = {
  locationId: string;
  firstName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address1?: string;
  customFields?: GhlCustomField[];
};

export type GhlContact = {
  id: string;
  locationId?: string;
  firstName?: string;
  email?: string;
};

export type GhlContactUpsertResponse = {
  contact: GhlContact;
  new?: boolean;
};

export type GhlOpportunityCreatePayload = {
  locationId: string;
  pipelineId: string;
  pipelineStageId: string;
  name: string;
  status: "open" | "won" | "lost" | "abandoned";
  contactId: string;
  monetaryValue?: number;
  assignedTo?: string;
  customFields?: GhlCustomField[];
};

export type GhlOpportunity = {
  id: string;
  name?: string;
  pipelineId?: string;
  pipelineStageId?: string;
  status?: string;
};

export type GhlOpportunityCreateResponse = {
  opportunity: GhlOpportunity;
};
