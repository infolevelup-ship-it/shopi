"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  deleteCustomerDocumentAction,
  discardOrphanCustomerDocumentAction,
  registerCustomerDocumentAction,
  type CustomerDocument,
} from "@/lib/actions/customer-documents";
import {
  ALLOWED_DOCUMENT_MIMES,
  MAX_DOCUMENTS_PER_CUSTOMER,
  MAX_DOCUMENT_BYTES,
  CUSTOMER_DOCUMENTS_BUCKET,
  customerDocumentStoragePath,
} from "@/lib/customer-documents";
import { formatDateTime } from "@/lib/ui/format";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

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
  if (file.type && ALLOWED_DOCUMENT_MIMES.includes(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[ext] ?? null;
}

function formatSize(bytes: number | null) {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// doc: Cámara de Comercio / RUT / cédula son los documentos legales que
// normalmente respaldan a un cliente B2B — se sugieren como atajos, pero el
// campo queda libre porque no todo cliente encaja en esas tres opciones.
const LABEL_SUGGESTIONS = ["Cámara de Comercio", "RUT", "Cédula", "Otro"];

export function DocumentsPanel({
  customerId,
  documents,
  canDelete,
}: {
  customerId: string;
  documents: CustomerDocument[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploadingName, setUploadingName] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const remaining = MAX_DOCUMENTS_PER_CUSTOMER - documents.length;
  const busy = isPending || uploadingName !== null;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    const chosen = Array.from(files).slice(0, remaining);
    if (files.length > remaining) {
      setError(
        `Solo caben ${MAX_DOCUMENTS_PER_CUSTOMER} documentos por cliente; se tomaron los primeros ${remaining}.`,
      );
    }

    const supabase = createClient();

    for (const file of chosen) {
      const mime = resolveMime(file);
      if (!mime) {
        setError(`"${file.name}" no es una imagen ni un PDF.`);
        continue;
      }
      if (file.size === 0 || file.size > MAX_DOCUMENT_BYTES) {
        setError(`"${file.name}" debe pesar entre 1 byte y 10 MB.`);
        continue;
      }

      setUploadingName(file.name);
      const fileName = `${crypto.randomUUID()}.${EXTENSION_BY_MIME[mime]}`;
      const objectPath = `customers/${customerId}/${fileName}`;
      const storagePath = customerDocumentStoragePath(customerId, fileName);

      const { error: uploadError } = await supabase.storage
        .from(CUSTOMER_DOCUMENTS_BUCKET)
        .upload(objectPath, file, { contentType: mime, upsert: false });

      if (uploadError) {
        setUploadingName(null);
        setError(`No se pudo subir "${file.name}": ${uploadError.message}`);
        continue;
      }

      const result = await registerCustomerDocumentAction({
        customerId,
        storagePath,
        originalFilename: file.name,
        mimeType: mime,
        sizeBytes: file.size,
        label: label || undefined,
      });

      if (!result.ok) {
        await discardOrphanCustomerDocumentAction(storagePath);
        setUploadingName(null);
        setError(result.error);
        continue;
      }

      setUploadingName(null);
    }

    setLabel("");
    if (inputRef.current) inputRef.current.value = "";
    startTransition(() => router.refresh());
  }

  function handleDelete(id: string, name: string | null) {
    if (!confirm(`¿Eliminar ${name ?? "este documento"}? No se puede deshacer.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteCustomerDocumentAction(id);
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
        <h2 className="text-base font-semibold">Documentos legales</h2>
        <span className="badge badge-neutral">Opcional</span>
      </div>

      {documents.length === 0 && (
        <p className="text-sm text-text-soft">
          Sin documentos adjuntos. Normalmente aquí va la Cámara de Comercio, el RUT o la cédula.
        </p>
      )}

      {documents.length > 0 && (
        <ul className="grid gap-2">
          {documents.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-3 rounded-xl border border-line p-2.5"
            >
              {d.isImage && d.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={d.url}
                  alt={d.originalFilename ?? "Documento"}
                  className="h-12 w-12 shrink-0 rounded-lg border border-line object-cover"
                />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-soft text-xs font-semibold text-text-soft">
                  {d.mimeType === "application/pdf" ? "PDF" : "?"}
                </span>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {d.label ?? d.originalFilename ?? "Documento"}
                </p>
                <p className="text-xs text-text-soft">
                  {d.label && d.originalFilename ? `${d.originalFilename} · ` : ""}
                  {formatSize(d.sizeBytes)}
                  {d.uploadedByName ? ` · ${d.uploadedByName}` : ""} ·{" "}
                  {formatDateTime(d.createdAt)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noreferrer" className="btn btn-tertiary btn-sm">
                    Ver
                  </a>
                ) : (
                  <span className="text-xs text-warning">no disponible</span>
                )}
                {canDelete && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDelete(d.id, d.label ?? d.originalFilename)}
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

      {remaining > 0 ? (
        <div className="mt-3">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ALLOWED_DOCUMENT_MIMES.join(",")}
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Tipo de documento (opcional)"
              list="document-label-suggestions"
              className="input max-w-[220px]"
            />
            <datalist id="document-label-suggestions">
              {LABEL_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="btn btn-secondary btn-block-mobile"
            >
              {busy ? "Subiendo…" : "+ Agregar documento"}
            </button>
          </div>
          <p className="mt-2 text-xs text-text-muted">
            Foto o PDF, hasta 10 MB. Quedan {remaining} de {MAX_DOCUMENTS_PER_CUSTOMER}.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-text-muted">
          Ya están los {MAX_DOCUMENTS_PER_CUSTOMER} documentos que admite un cliente.
        </p>
      )}
    </section>
  );
}
