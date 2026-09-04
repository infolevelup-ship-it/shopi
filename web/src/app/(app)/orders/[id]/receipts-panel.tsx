"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  deleteOrderReceiptAction,
  discardOrphanReceiptAction,
  registerOrderReceiptAction,
  type OrderReceipt,
} from "@/lib/actions/receipts";
import {
  ALLOWED_RECEIPT_MIMES,
  MAX_RECEIPTS_PER_ORDER,
  MAX_RECEIPT_BYTES,
  RECEIPTS_BUCKET,
  receiptStoragePath,
} from "@/lib/receipts";
import { formatDateTime } from "@/lib/ui/format";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

// Algunos navegadores entregan `file.type` vacío para HEIC (las fotos de
// iPhone), así que cuando falta se deduce de la extensión antes de rendirse.
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
};

function resolveMime(file: File) {
  if (file.type && ALLOWED_RECEIPT_MIMES.includes(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[ext] ?? null;
}

function formatSize(bytes: number | null) {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ReceiptsPanel({
  orderId,
  receipts,
  canUpload,
  canDelete,
}: {
  orderId: string;
  receipts: OrderReceipt[];
  canUpload: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadingName, setUploadingName] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const remaining = MAX_RECEIPTS_PER_ORDER - receipts.length;
  const busy = isPending || uploadingName !== null;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    const chosen = Array.from(files).slice(0, remaining);
    if (files.length > remaining) {
      setError(
        `Solo caben ${MAX_RECEIPTS_PER_ORDER} comprobantes por pedido; se tomaron los primeros ${remaining}.`,
      );
    }

    const supabase = createClient();

    for (const file of chosen) {
      const mime = resolveMime(file);
      if (!mime) {
        setError(`"${file.name}" no es una imagen ni un PDF.`);
        continue;
      }
      if (file.size === 0 || file.size > MAX_RECEIPT_BYTES) {
        setError(`"${file.name}" debe pesar entre 1 byte y 10 MB.`);
        continue;
      }

      setUploadingName(file.name);
      const fileName = `${crypto.randomUUID()}.${EXTENSION_BY_MIME[mime]}`;
      const objectPath = `orders/${orderId}/${fileName}`;
      const storagePath = receiptStoragePath(orderId, fileName);

      // El archivo va directo del navegador al bucket: pasarlo por el
      // servidor de Next chocaría con el límite de tamaño de las server
      // actions, y una foto de celular lo supera con facilidad.
      const { error: uploadError } = await supabase.storage
        .from(RECEIPTS_BUCKET)
        .upload(objectPath, file, { contentType: mime, upsert: false });

      if (uploadError) {
        setUploadingName(null);
        setError(`No se pudo subir "${file.name}": ${uploadError.message}`);
        continue;
      }

      const result = await registerOrderReceiptAction({
        orderId,
        storagePath,
        originalFilename: file.name,
        mimeType: mime,
        sizeBytes: file.size,
      });

      if (!result.ok) {
        // El archivo ya está arriba pero nadie lo va a poder encontrar:
        // se retira para no dejar basura invisible en el bucket.
        await discardOrphanReceiptAction(storagePath);
        setUploadingName(null);
        setError(result.error);
        continue;
      }

      setUploadingName(null);
    }

    if (inputRef.current) inputRef.current.value = "";
    startTransition(() => router.refresh());
  }

  function handleDelete(id: string, name: string | null) {
    if (!confirm(`¿Eliminar ${name ?? "este comprobante"}? No se puede deshacer.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteOrderReceiptAction(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="card card-pad">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Comprobantes de pago</h2>
        <span className="badge badge-neutral">Opcional</span>
      </div>

      {receipts.length === 0 && !canUpload && (
        <p className="text-sm text-text-soft">Este pedido no tiene comprobantes adjuntos.</p>
      )}

      {receipts.length > 0 && (
        <ul className="grid gap-2">
          {receipts.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 rounded-xl border border-line p-2.5"
            >
              {/* Vista previa (doc 11 §80). Se usa <img> y no next/image a
                  propósito: la URL viene firmada y caduca en una hora, así que
                  no sirve para el optimizador de imágenes. */}
              {r.isImage && r.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.url}
                  alt={r.originalFilename ?? "Comprobante"}
                  className="h-12 w-12 shrink-0 rounded-lg border border-line object-cover"
                />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-soft text-xs font-semibold text-text-soft">
                  {r.mimeType === "application/pdf" ? "PDF" : "?"}
                </span>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {r.originalFilename ?? "Comprobante"}
                </p>
                <p className="text-xs text-text-soft">
                  {formatSize(r.sizeBytes)}
                  {r.uploadedByName ? ` · ${r.uploadedByName}` : ""} ·{" "}
                  {formatDateTime(r.createdAt)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {r.url ? (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-tertiary btn-sm"
                  >
                    Ver
                  </a>
                ) : (
                  // La fila existe pero el archivo no se pudo firmar: mejor
                  // decirlo que ofrecer un enlace que no va a abrir.
                  <span className="text-xs text-warning">no disponible</span>
                )}
                {canDelete && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDelete(r.id, r.originalFilename)}
                    className="btn btn-tertiary btn-sm text-danger"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {uploadingName && (
        <p className="mt-3 flex items-center gap-2 text-sm text-text-soft">
          <span className="skeleton h-4 w-4 rounded-full" />
          Subiendo {uploadingName}…
        </p>
      )}

      {error && (
        <div className="mt-3 rounded-xl border border-danger/30 bg-danger-bg p-3 text-sm text-[#b42318]">
          {error}
        </div>
      )}

      {canUpload && (
        <div className="mt-3">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ALLOWED_RECEIPT_MIMES.join(",")}
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />
          {remaining > 0 ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="btn btn-secondary btn-block-mobile"
              >
                {busy ? "Subiendo…" : "+ Agregar comprobante"}
              </button>
              <p className="mt-2 text-xs text-text-muted">
                Foto o PDF, hasta 10 MB. Quedan {remaining} de {MAX_RECEIPTS_PER_ORDER}. En el
                celular puedes tomar la foto en el momento.
              </p>
            </>
          ) : (
            <p className="text-xs text-text-muted">
              Ya están los {MAX_RECEIPTS_PER_ORDER} comprobantes que admite un pedido.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
