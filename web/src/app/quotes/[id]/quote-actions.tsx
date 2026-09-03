"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendQuoteAction, acceptQuoteAction, loseQuoteAction } from "@/lib/actions/quotes";

export function QuoteActions({ quoteId, status }: { quoteId: string; status: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showLoseForm, setShowLoseForm] = useState(false);
  const [lostReason, setLostReason] = useState("");
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

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        {status === "DRAFT" && (
          <button
            disabled={isPending}
            onClick={() => run(() => sendQuoteAction(quoteId))}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Enviar al cliente
          </button>
        )}

        {(status === "SENT" || status === "FOLLOW_UP") && (
          <>
            <button
              disabled={isPending}
              onClick={() => run(() => acceptQuoteAction(quoteId))}
              className="rounded-md bg-green-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Marcar aceptada
            </button>
            <button
              disabled={isPending}
              onClick={() => setShowLoseForm((s) => !s)}
              className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700"
            >
              Marcar perdida
            </button>
          </>
        )}
      </div>

      {showLoseForm && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <label className="text-sm font-medium text-neutral-700">Motivo de la pérdida</label>
          <input
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            placeholder="Precio, falta de presupuesto, competencia..."
          />
          <button
            disabled={isPending || !lostReason.trim()}
            onClick={() => run(() => loseQuoteAction(quoteId, lostReason))}
            className="mt-2 rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Confirmar como perdida
          </button>
        </div>
      )}
    </div>
  );
}
