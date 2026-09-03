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
    <div className="space-y-3">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        {canSubmit && (
          <button
            disabled={isPending}
            onClick={() => run(() => submitOrderAction(orderId))}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Enviar a revisión
          </button>
        )}
        {canCancel && (
          <button
            disabled={isPending}
            onClick={() => setShowCancelForm((s) => !s)}
            className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700"
          >
            Cancelar pedido
          </button>
        )}
      </div>

      {showCancelForm && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <label className="text-sm font-medium text-neutral-700">Motivo de la cancelación</label>
          <input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            placeholder="Cliente canceló, error en el pedido..."
          />
          <button
            disabled={isPending || !cancelReason.trim()}
            onClick={() => run(() => cancelOrderAction(orderId, cancelReason))}
            className="mt-2 rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Confirmar cancelación
          </button>
        </div>
      )}
    </div>
  );
}
