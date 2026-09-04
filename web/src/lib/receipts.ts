// Reglas del comprobante de pago, compartidas por el navegador y el servidor.
// Viven fuera de "use server" porque ese tipo de archivo solo puede exportar
// funciones async — y el formulario necesita validar tipo y tamaño antes de
// empezar a subir, no después.

// Bucket privado: un comprobante lleva datos bancarios del cliente, así que
// nunca se sirve por URL pública, solo por URL firmada de vida corta.
export const RECEIPTS_BUCKET = "receipts";
export const MAX_RECEIPTS_PER_ORDER = 3;
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_RECEIPT_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

// `attachments.storage_path` guarda bucket + ruta ("receipts/orders/…"), que
// es lo que documenta el modelo de datos; las APIs de Storage quieren el
// bucket por separado. Un solo par de funciones hace la conversión.
export function receiptStoragePath(orderId: string, fileName: string) {
  return `${RECEIPTS_BUCKET}/orders/${orderId}/${fileName}`;
}

export function receiptObjectPath(storagePath: string) {
  const prefix = `${RECEIPTS_BUCKET}/`;
  return storagePath.startsWith(prefix) ? storagePath.slice(prefix.length) : storagePath;
}
