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
};

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
  };
}
