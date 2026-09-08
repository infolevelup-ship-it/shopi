// Interruptores de la integración, compartidos por el panel de administración
// y por las acciones que hablan con Siigo. Viven en `app_settings` y no en
// variables de entorno porque una variable exige redespliegue: en una urgencia
// eso son minutos en los que se siguen mandando documentos.

/** Factura electrónica de venta: la real, la que llega a la DIAN. */
export const SIIGO_DOC_ELECTRONIC = 34963;
/** Documento de ingreso: NO es electrónico, no llega a la DIAN. Solo pruebas. */
export const SIIGO_DOC_TEST = 37934;

export const INTEGRATION_KEYS = [
  "siigo_integration_enabled",
  "siigo_stock_sync_enabled",
  "siigo_invoice_document_id",
  "ghl_integration_enabled",
  "ghl_pipeline_id",
  "ghl_pipeline_stage_id",
  "ghl_pipeline_id_b2b_nuevo",
  "ghl_pipeline_stage_id_b2b_nuevo",
  "ghl_pipeline_id_b2c",
  "ghl_pipeline_stage_id_b2c",
];

// Los tres embudos que existen en la cuenta de GHL. El canal del pedido decide
// entre B2B y B2C; dentro de B2B decide si el cliente ya había comprado.
export const GHL_EMBUDOS = ["B2B_ANTIGUO", "B2B_NUEVO", "B2C"] as const;
export type GhlEmbudo = (typeof GHL_EMBUDOS)[number];

export const GHL_EMBUDO_LABEL: Record<GhlEmbudo, string> = {
  B2B_ANTIGUO: "B2B · cliente que ya había comprado",
  B2B_NUEVO: "B2B · cliente nuevo",
  B2C: "B2C · consumidor final",
};

/** El sufijo con el que cada embudo se guarda en `app_settings`. */
export function sufijoEmbudo(embudo: GhlEmbudo): string {
  if (embudo === "B2B_NUEVO") return "_b2b_nuevo";
  if (embudo === "B2C") return "_b2c";
  return "";
}

export type IntegrationSettings = {
  /** Corte general: con esto en falso, nada sale hacia Siigo. */
  siigoEnabled: boolean;
  /** Actualización de inventarios desde Siigo. Depende del corte general. */
  stockSyncEnabled: boolean;
  /** Tipo de documento con el que se factura. */
  invoiceDocumentId: number;
  /** ¿Estamos emitiendo contra un documento que no llega a la DIAN? */
  isTestDocument: boolean;

  /** Corte general de GHL: con esto en falso, no se crea nada allá. */
  ghlEnabled: boolean;
  /**
   * Embudo de B2B para clientes que ya habían comprado. Es además el de
   * respaldo: si un embudo más específico no está configurado, se usa este
   * antes que dejar el pedido sin oportunidad.
   */
  ghlPipelineId: string | null;
  ghlPipelineStageId: string | null;
  /** B2B, primera compra del cliente. */
  ghlPipelineIdB2bNuevo: string | null;
  ghlPipelineStageIdB2bNuevo: string | null;
  /** Consumidor final (doc GUIA_B2C). */
  ghlPipelineIdB2c: string | null;
  ghlPipelineStageIdB2c: string | null;
};

function texto(raw: Map<string, unknown>, clave: string): string | null {
  const v = raw.get(clave);
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

export function parseIntegrationSettings(raw: Map<string, unknown>): IntegrationSettings {
  // Arranca DESCONECTADO a propósito. Si la clave no existe todavía, lo seguro
  // es no mandar nada: conectarse debe ser un acto deliberado.
  const siigoEnabled = raw.get("siigo_integration_enabled") === true;
  const stock = raw.get("siigo_stock_sync_enabled");
  const doc = raw.get("siigo_invoice_document_id");

  // El documento por defecto es el REAL. Si faltara la clave, es preferible
  // que una prueba salga como factura de verdad — visible, y se anula — a que
  // una venta real salga como documento no electrónico, que no llega a la DIAN
  // y nadie se entera hasta la declaración.
  const invoiceDocumentId = typeof doc === "number" ? doc : SIIGO_DOC_ELECTRONIC;

  return {
    siigoEnabled,
    stockSyncEnabled: stock === undefined ? true : stock === true,
    invoiceDocumentId,
    isTestDocument: invoiceDocumentId !== SIIGO_DOC_ELECTRONIC,

    // Misma regla que Siigo: si la clave no existe, desconectado. Conectarse
    // es un acto deliberado, no el estado por defecto.
    ghlEnabled: raw.get("ghl_integration_enabled") === true,
    ghlPipelineId: texto(raw, "ghl_pipeline_id"),
    ghlPipelineStageId: texto(raw, "ghl_pipeline_stage_id"),
    ghlPipelineIdB2bNuevo: texto(raw, "ghl_pipeline_id_b2b_nuevo"),
    ghlPipelineStageIdB2bNuevo: texto(raw, "ghl_pipeline_stage_id_b2b_nuevo"),
    ghlPipelineIdB2c: texto(raw, "ghl_pipeline_id_b2c"),
    ghlPipelineStageIdB2c: texto(raw, "ghl_pipeline_stage_id_b2c"),
  };
}
