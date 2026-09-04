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
    <section className="card card-pad">
      {error && (
        <div className="mb-3 rounded-xl border border-danger/30 bg-danger-bg p-3 text-sm text-[#b42318]">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {status === "DRAFT" && (
          <button
            disabled={isPending}
            onClick={() => run(() => sendQuoteAction(quoteId))}
            className="btn btn-primary btn-block-mobile"
          >
            Enviar al cliente
          </button>
        )}

        {(status === "SENT" || status === "FOLLOW_UP") && (
          <>
            <button
              disabled={isPending}
              onClick={() => run(() => acceptQuoteAction(quoteId))}
              className="btn btn-success btn-block-mobile"
            >
              Marcar aceptada
            </button>
            <button
              disabled={isPending}
              onClick={() => setShowLoseForm((s) => !s)}
              className="btn btn-danger btn-block-mobile"
            >
              Marcar perdida
            </button>
          </>
        )}
      </div>

      {showLoseForm && (
        <div className="mt-3 rounded-xl border border-line bg-surface-soft p-3">
          <label htmlFor="lost-reason" className="field-label">
            Motivo de la pérdida
          </label>
          <input
            id="lost-reason"
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            className="input"
            placeholder="Precio, falta de presupuesto, competencia…"
          />
          <button
            disabled={isPending || !lostReason.trim()}
            onClick={() => run(() => loseQuoteAction(quoteId, lostReason))}
            className="btn btn-danger btn-sm btn-block-mobile mt-2"
          >
            Confirmar como perdida
          </button>
        </div>
      )}
    </section>
  );
}
