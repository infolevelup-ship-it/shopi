"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  invoiceOrderAction,
  resolveUncertainInvoiceAction,
  searchSiigoInvoiceCandidatesAction,
  type InvoiceCandidate,
} from "@/lib/actions/invoices";
import { formatDate, formatMoney } from "@/lib/ui/format";

export type InvoicePanelProps = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  grandTotal: number;
  canInvoice: boolean;
  isAdmin: boolean;
  isUncertain: boolean;
  uncertainMessage?: string | null;
  invoice?: {
    invoiceNumber: string | null;
    invoiceDate: string | null;
    total: number | null;
  } | null;
  status: string;
};

export function InvoicePanel({
  orderId,
  orderNumber,
  customerName,
  grandTotal,
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
      const result = await resolveUncertainInvoiceAction(
        orderId,
        "confirmed_issued",
        siigoInvoiceId,
      );
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

  // doc 11 §44: resultado exitoso, con el número real de la factura.
  if (status === "INVOICED") {
    return (
      <section className="card card-pad border-success/30 bg-success-bg">
        <p className="font-semibold text-[#05834b]">✓ Factura creada</p>
        <p className="mt-1 text-sm text-[#05834b]">
          {invoice?.invoiceNumber ?? "Factura registrada en Siigo"}
          {invoice?.total ? ` · ${formatMoney(invoice.total)}` : ""}
          {invoice?.invoiceDate ? ` · ${formatDate(invoice.invoiceDate)}` : ""}
        </p>
      </section>
    );
  }

  // doc 11 §44/§87: "incierto" nunca se muestra como éxito ni como error —
  // es su propio estado, y lo primero que dice es qué NO hacer.
  if (status === "INVOICING" && isUncertain) {
    if (!isAdmin) {
      return (
        <section className="card card-pad border-warning/30 bg-warning-bg">
          <p className="font-semibold text-[#b54708]">⚠ Estamos verificando la factura</p>
          <p className="mt-1 text-sm text-[#b54708]">
            No vuelvas a facturar este pedido. No se pudo confirmar con Siigo si la factura
            alcanzó a emitirse; un administrador debe verificarlo antes de continuar.
          </p>
        </section>
      );
    }
    return (
      <section className="card card-pad border-warning/30 bg-warning-bg">
        <p className="font-semibold text-[#b54708]">⚠ Estamos verificando la factura</p>
        <p className="mt-1 text-sm text-[#b54708]">
          {uncertainMessage ?? "No se pudo confirmar si Siigo llegó a emitir la factura."} No
          vuelvas a facturar este pedido hasta resolverlo aquí.
        </p>

        <button
          type="button"
          disabled={isPending}
          onClick={buscarCandidatos}
          className="btn btn-secondary btn-sm btn-block-mobile mt-3"
        >
          {isPending ? "Buscando…" : "Buscar en Siigo"}
        </button>

        {candidates && (
          <div className="mt-3 grid gap-2">
            {candidates.length === 0 ? (
              <p className="text-sm text-[#b54708]">
                Sin resultados en la ventana de tiempo buscada.
              </p>
            ) : (
              candidates.map((c) => (
                <div
                  key={c.siigoInvoiceId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface p-3 text-sm"
                >
                  <span>
                    {c.name ?? c.siigoInvoiceId}
                    {c.total ? ` · ${formatMoney(c.total)}` : ""}
                    {c.date ? ` · ${c.date}` : ""}
                  </span>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => confirmarEmitida(c.siigoInvoiceId)}
                    className="btn btn-success btn-sm"
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
              className="btn btn-danger btn-sm"
            >
              Ninguna es — no se emitió, permitir reintentar
            </button>
          </div>
        )}

        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </section>
    );
  }

  if (status === "INVOICING") {
    return (
      <section className="card card-pad border-info/30 bg-info-bg">
        <p className="font-semibold text-[#175cd3]">Facturando…</p>
        <p className="mt-1 text-sm text-[#175cd3]">
          Se está generando la factura electrónica. No vuelvas a facturar este pedido.
        </p>
      </section>
    );
  }

  if (status !== "APPROVED_FOR_INVOICE" || !canInvoice) {
    return null;
  }

  return (
    <section className="card card-pad">
      {error && (
        <div className="mb-3 rounded-xl border border-danger/30 bg-danger-bg p-3 text-sm text-[#b42318]">
          {error}
        </div>
      )}
      {info && (
        <div className="mb-3 rounded-xl border border-warning/30 bg-warning-bg p-3 text-sm text-[#b54708]">
          {info}
        </div>
      )}

      {!confirming ? (
        <>
          <h2 className="text-base font-semibold">Facturación</h2>
          <p className="mt-1 mb-3 text-sm text-text-soft">
            El pedido está aprobado. Al facturar se genera la factura electrónica en Siigo.
          </p>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="btn btn-primary btn-block-mobile"
          >
            Facturar en Siigo
          </button>
        </>
      ) : (
        // doc 11 §43: la confirmación repite los datos del pedido y dice
        // explícitamente que esto genera un documento fiscal.
        <div>
          <h2 className="text-base font-semibold">Vas a generar una factura electrónica</h2>
          <dl className="mt-3 grid gap-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-soft">Pedido</dt>
              <dd className="font-medium">{orderNumber}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-soft">Cliente</dt>
              <dd className="font-medium">{customerName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-soft">Total</dt>
              <dd className="font-medium">{formatMoney(grandTotal)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm font-medium text-danger">
            Esta acción genera un documento fiscal. Una vez emitida, la factura no se elimina
            como un pedido normal.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={isPending}
              onClick={facturar}
              className="btn btn-primary btn-block-mobile"
            >
              {isPending ? "Facturando…" : "Confirmar y facturar"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirming(false)}
              className="btn btn-secondary btn-block-mobile"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
