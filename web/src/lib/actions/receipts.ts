"use server";

import { createClient } from "@/lib/supabase/server";
import { RECEIPTS_BUCKET, receiptObjectPath as objectPath } from "@/lib/receipts";

const SIGNED_URL_SECONDS = 60 * 60;

export type OrderReceipt = {
  id: string;
  originalFilename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  uploadedByName: string | null;
  /** Firmada, válida una hora. Null si el archivo ya no está en el bucket. */
  url: string | null;
  isImage: boolean;
};

export async function listOrderReceipts(orderId: string): Promise<OrderReceipt[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attachments")
    .select(
      "id, storage_path, original_filename, mime_type, size_bytes, created_at, uploader:users!attachments_uploaded_by_fkey(name)",
    )
    .eq("entity_type", "order")
    .eq("entity_id", orderId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`No se pudieron cargar los comprobantes: ${error.message}`);

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const { data: signed } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrls(rows.map((r) => objectPath(r.storage_path)), SIGNED_URL_SECONDS);

  // createSignedUrls devuelve un resultado por archivo, en el mismo orden, y
  // marca el que falló en vez de tumbar toda la llamada.
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.error ? null : s.signedUrl]));

  return rows.map((r) => {
    const uploader = Array.isArray(r.uploader) ? r.uploader[0] : r.uploader;
    return {
      id: r.id,
      originalFilename: r.original_filename,
      mimeType: r.mime_type,
      sizeBytes: r.size_bytes,
      createdAt: r.created_at,
      uploadedByName: uploader?.name ?? null,
      url: urlByPath.get(objectPath(r.storage_path)) ?? null,
      isImage: (r.mime_type ?? "").startsWith("image/"),
    };
  });
}

export type ReceiptActionResult = { ok: true } | { ok: false; error: string };

export async function registerOrderReceiptAction(input: {
  orderId: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<ReceiptActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_order_receipt", {
    p_order_id: input.orderId,
    p_storage_path: input.storagePath,
    p_original_filename: input.originalFilename,
    p_mime_type: input.mimeType,
    p_size_bytes: input.sizeBytes,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Borra primero la fila y después el archivo. En ese orden a propósito: si
// falla el segundo paso queda un huérfano invisible en el bucket, molesto
// pero inofensivo; al revés quedaría un enlace roto en pantalla.
export async function deleteOrderReceiptAction(
  attachmentId: string,
): Promise<ReceiptActionResult> {
  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc("delete_order_receipt", {
    p_attachment_id: attachmentId,
  });
  if (error) return { ok: false, error: error.message };

  if (path) {
    await supabase.storage.from(RECEIPTS_BUCKET).remove([objectPath(path)]);
  }
  return { ok: true };
}

// Si el registro falla después de haber subido el archivo, hay que quitarlo
// del bucket: si no, queda ocupando espacio sin que nadie sepa que existe.
export async function discardOrphanReceiptAction(storagePath: string): Promise<void> {
  const supabase = await createClient();
  await supabase.storage.from(RECEIPTS_BUCKET).remove([objectPath(storagePath)]);
}
