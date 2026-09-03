"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFollowUpAction, completeFollowUpAction } from "@/lib/actions/followups";

export type FollowUpRow = {
  id: string;
  scheduled_at: string;
  reason: string | null;
  type: string | null;
};

function isOverdue(scheduledAt: string) {
  return new Date(scheduledAt).getTime() < Date.now();
}

export function FollowUpsPanel({ customerId, followUps }: { customerId: string; followUps: FollowUpRow[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [showForm, setShowForm] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [reason, setReason] = useState("");

  const [completingId, setCompletingId] = useState<string | null>(null);
  const [result, setResult] = useState("");

  function create() {
    if (!scheduledAt || !reason.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await createFollowUpAction(customerId, new Date(scheduledAt).toISOString(), reason);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setShowForm(false);
      setScheduledAt("");
      setReason("");
      router.refresh();
    });
  }

  function complete(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await completeFollowUpAction(id, result || "Completado");
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCompletingId(null);
      setResult("");
      router.refresh();
    });
  }

  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-700">Seguimientos pendientes</h2>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="text-xs font-medium text-neutral-700 underline"
        >
          + Nuevo seguimiento
        </button>
      </div>

      {error && <p className="mb-2 text-sm text-red-700">{error}</p>}

      {showForm && (
        <div className="mb-3 rounded-lg border border-neutral-200 bg-white p-3">
          <label className="text-xs text-neutral-500">Fecha</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <label className="mt-2 block text-xs text-neutral-500">Motivo</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Llamar por recompra, confirmar recibo del pedido..."
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={isPending || !scheduledAt || !reason.trim()}
            onClick={create}
            className="mt-2 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
      )}

      {followUps.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin seguimientos pendientes.</p>
      ) : (
        <div className="space-y-2">
          {followUps.map((f) => (
            <div key={f.id} className="rounded-lg border border-neutral-200 bg-white p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className={isOverdue(f.scheduled_at) ? "font-medium text-red-700" : "text-neutral-900"}>
                  {new Date(f.scheduled_at).toLocaleString("es-CO")}
                  {isOverdue(f.scheduled_at) ? " — vencido" : ""}
                </span>
                <button
                  type="button"
                  onClick={() => setCompletingId((id) => (id === f.id ? null : f.id))}
                  className="text-xs font-medium text-neutral-700 underline"
                >
                  Completar
                </button>
              </div>
              {f.reason && <p className="mt-1 text-neutral-700">{f.reason}</p>}

              {completingId === f.id && (
                <div className="mt-2 flex gap-2">
                  <input
                    value={result}
                    onChange={(e) => setResult(e.target.value)}
                    placeholder="Qué pasó..."
                    className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => complete(f.id)}
                    className="rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                  >
                    Confirmar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
