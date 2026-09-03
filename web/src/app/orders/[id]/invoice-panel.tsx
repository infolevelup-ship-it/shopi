"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  invoiceOrderAction,
  resolveUncertainInvoiceAction,
  searchSiigoInvoiceCandidatesAction,
  type InvoiceCandidate,
} from "@/lib/actions/invoices";

function formatMoney(value: number) {
  return value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

export type InvoicePanelProps = {
  orderId: string;
  canInvoice: boolean;
  isAdmin: boolean;
  isUncertain: boolean;
  uncertainMessage?: string | null;
  invoice?: { invoiceNumber: string | null; invoiceDate: string | null; total: number | null } | null;
  status: string;
};

export function InvoicePanel({
  orderId,
  canInvoice,
  isAdmin,
  isUncertain,
  uncertainMessage,
  invoice,
  status,
}: InvoicePanelProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<InvoiceCandidate[] | null>(null);
  const [isPending, startTransition] = useTransition();

  function facturar() {
    setError(null);
    startTransition(async () => {
      const result = await invoiceOrderAction(orderId);
      if (!result.ok) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      if (result.status === "UNCERTAIN") {
        setInfo(result.message);
      }
      router.refresh();
    });
  }

  function buscarCandidatos() {
    setError(null);
    startTransition(async () => {
      const result = await searchSiigoInvoiceCandidatesAction(orderId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCandidates(result.candidates);
    });
  }

  function confirmarEmitida(siigoInvoiceId: string) {
    setError(null);
    startTransition(async () => {
      const result = await resolveUncertainInvoiceAction(orderId, "confirmed_issued", siigoInvoiceId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function confirmarNoEmitida() {
    setError(null);
    startTransition(async () => {
      const result = await resolveUncertainInvoiceAction(orderId, "confirmed_not_issued");
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (status === "INVOICED") {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        Facturado{invoice?.invoiceNumber ? ` — ${invoice.invoiceNumber}` : ""}
        {invoice?.total ? ` · ${formatMoney(invoice.total)}` : ""}
        {invoice?.invoiceDate ? ` · ${new Date(invoice.invoiceDate).toLocaleDateString("es-CO")}` : ""}
      </div>
    );
  }

  if (status === "INVOICING" && isUncertain) {
    if (!isAdmin) {
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No se pudo confirmar si este pedido se facturó (timeout con Siigo). Un administrador debe
          reconciliarlo antes de continuar.
        </div>
      );
    }
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-medium">Facturación incierta</p>
        <p className="mt-1">{uncertainMessage ?? "No se pudo confirmar si Siigo llegó a emitir la factura."}</p>

        <button
          type="button"
          disabled={isPending}
          onClick={buscarCandidatos}
          className="mt-3 rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          Buscar en Siigo
        </button>

        {candidates && (
          <div className="mt-3 space-y-2">
            {candidates.length === 0 ? (
              <p className="text-xs">Sin resultados en la ventana de tiempo buscada.</p>
            ) : (
              candidates.map((c) => (
                <div key={c.siigoInvoiceId} className="flex items-center justify-between rounded-md bg-white p-2 text-xs">
                  <span>
                    {c.name ?? c.siigoInvoiceId}
                    {c.total ? ` · ${formatMoney(c.total)}` : ""}
                    {c.date ? ` · ${c.date}` : ""}
                  </span>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => confirmarEmitida(c.siigoInvoiceId)}
                    className="rounded-md bg-green-700 px-2 py-1 font-medium text-white disabled:opacity-50"
                  >
                    Es esta, vincular
                  </button>
                </div>
              ))
            )}
            <button
              type="button"
              disabled={isPending}
              onClick={confirmarNoEmitida}
              className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50"
            >
              Ninguna es — no se emitió, permitir reintentar
            </button>
          </div>
        )}

        {error && <p className="mt-2 text-red-700">{error}</p>}
      </div>
    );
  }

  if (status === "INVOICING") {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">Facturando...</div>
    );
  }

  if (status !== "APPROVED_FOR_INVOICE" || !canInvoice) {
    return null;
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      {error && <p className="mb-2 text-sm text-red-700">{error}</p>}
      {info && <p className="mb-2 text-sm text-amber-700">{info}</p>}
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
        >
          Facturar
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-neutral-700">
            Vas a generar una factura electrónica en Siigo. Una vez emitida, no se elimina como un
            pedido normal.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={facturar}
              className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isPending ? "Facturando..." : "Confirmar y facturar"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirming(false)}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
