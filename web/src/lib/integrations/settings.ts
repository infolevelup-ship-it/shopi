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
  "ghl_pipeline_id_b2c",
  "ghl_pipeline_stage_id_b2c",
];

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
  /** Embudo y etapa donde caen los pedidos B2B. */
  ghlPipelineId: string | null;
  ghlPipelineStageId: string | null;
  /** Los B2C van a otro embudo (doc GUIA_B2C). Si falta, se usa el B2B. */
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
    ghlPipelineIdB2c: texto(raw, "ghl_pipeline_id_b2c"),
    ghlPipelineStageIdB2c: texto(raw, "ghl_pipeline_stage_id_b2c"),
  };
}
