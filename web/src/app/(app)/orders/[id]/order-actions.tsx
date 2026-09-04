"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitOrderAction, cancelOrderAction } from "@/lib/actions/orders";

export function OrderActions({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Error");
        return;
      }
      router.refresh();
    });
  }

  const canSubmit = status === "DRAFT";
  const canCancel = status === "DRAFT" || status === "SUBMITTED";

  if (!canSubmit && !canCancel) return null;

  return (
    <section className="card card-pad">
      {error && (
        <div className="mb-3 rounded-xl border border-danger/30 bg-danger-bg p-3 text-sm text-[#b42318]">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {canSubmit && (
          <button
            disabled={isPending}
            onClick={() => run(() => submitOrderAction(orderId))}
            className="btn btn-primary btn-block-mobile"
          >
            {isPending ? "Enviando…" : "Enviar a revisión"}
          </button>
        )}
        {canCancel && (
          <button
            disabled={isPending}
            onClick={() => setShowCancelForm((s) => !s)}
            className="btn btn-danger btn-block-mobile"
          >
            Cancelar pedido
          </button>
        )}
      </div>

      {showCancelForm && (
        <div className="mt-3 rounded-xl border border-line bg-surface-soft p-3">
          <label className="field-label">Motivo de la cancelación</label>
          <input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="input"
            placeholder="Cliente canceló, error en el pedido…"
          />
          <button
            disabled={isPending || !cancelReason.trim()}
            onClick={() => run(() => cancelOrderAction(orderId, cancelReason))}
            className="btn btn-danger btn-sm btn-block-mobile mt-2"
          >
            Confirmar cancelación
          </button>
        </div>
      )}
    </section>
  );
}
