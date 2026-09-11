"use server";

import { createClient } from "@/lib/supabase/server";
import {
  CUSTOMER_DOCUMENTS_BUCKET,
  customerDocumentObjectPath as objectPath,
} from "@/lib/customer-documents";

const SIGNED_URL_SECONDS = 60 * 60;

export type CustomerDocument = {
  id: string;
  originalFilename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  label: string | null;
  createdAt: string;
  uploadedByName: string | null;
  /** Firmada, válida una hora. Null si el archivo ya no está en el bucket. */
  url: string | null;
  isImage: boolean;
};

export async function listCustomerDocuments(customerId: string): Promise<CustomerDocument[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attachments")
    .select(
      "id, storage_path, original_filename, mime_type, size_bytes, label, created_at, uploader:users!attachments_uploaded_by_fkey(name)",
    )
    .eq("entity_type", "customer")
    .eq("entity_id", customerId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`No se pudieron cargar los documentos: ${error.message}`);

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const { data: signed } = await supabase.storage
    .from(CUSTOMER_DOCUMENTS_BUCKET)
    .createSignedUrls(rows.map((r) => objectPath(r.storage_path)), SIGNED_URL_SECONDS);

  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.error ? null : s.signedUrl]));

  return rows.map((r) => {
    const uploader = Array.isArray(r.uploader) ? r.uploader[0] : r.uploader;
    return {
      id: r.id,
      originalFilename: r.original_filename,
      mimeType: r.mime_type,
      sizeBytes: r.size_bytes,
      label: r.label,
      createdAt: r.created_at,
      uploadedByName: uploader?.name ?? null,
      url: urlByPath.get(objectPath(r.storage_path)) ?? null,
      isImage: (r.mime_type ?? "").startsWith("image/"),
    };
  });
}

export type CustomerDocumentActionResult = { ok: true } | { ok: false; error: string };

export async function registerCustomerDocumentAction(input: {
  customerId: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  label?: string;
}): Promise<CustomerDocumentActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_customer_document", {
    p_customer_id: input.customerId,
    p_storage_path: input.storagePath,
    p_original_filename: input.originalFilename,
    p_mime_type: input.mimeType,
    p_size_bytes: input.sizeBytes,
    p_label: input.label || undefined,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteCustomerDocumentAction(
  attachmentId: string,
): Promise<CustomerDocumentActionResult> {
  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc("delete_customer_document", {
    p_attachment_id: attachmentId,
  });
  if (error) return { ok: false, error: error.message };

  if (path) {
    await supabase.storage.from(CUSTOMER_DOCUMENTS_BUCKET).remove([objectPath(path)]);
  }
  return { ok: true };
}

export async function discardOrphanCustomerDocumentAction(storagePath: string): Promise<void> {
  const supabase = await createClient();
  await supabase.storage.from(CUSTOMER_DOCUMENTS_BUCKET).remove([objectPath(storagePath)]);
}
