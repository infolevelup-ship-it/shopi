// Reglas del documento legal del cliente (Cámara de Comercio, RUT, etc.),
// compartidas por el navegador y el servidor. Mismo patrón que
// lib/receipts.ts para los comprobantes de pago de un pedido.

// Bucket privado: aunque no lleve datos bancarios, un RUT o una cédula sí es
// dato personal, así que nunca se sirve por URL pública.
export const CUSTOMER_DOCUMENTS_BUCKET = "customer-documents";
export const MAX_DOCUMENTS_PER_CUSTOMER = 5;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_DOCUMENT_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

export function customerDocumentStoragePath(customerId: string, fileName: string) {
  return `${CUSTOMER_DOCUMENTS_BUCKET}/customers/${customerId}/${fileName}`;
}

export function customerDocumentObjectPath(storagePath: string) {
  const prefix = `${CUSTOMER_DOCUMENTS_BUCKET}/`;
  return storagePath.startsWith(prefix) ? storagePath.slice(prefix.length) : storagePath;
}
