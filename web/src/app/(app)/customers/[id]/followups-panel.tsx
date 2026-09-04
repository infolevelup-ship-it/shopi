"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFollowUpAction, completeFollowUpAction } from "@/lib/actions/followups";
import { formatDateTime } from "@/lib/ui/format";

export type FollowUpRow = {
  id: string;
  scheduled_at: string;
  reason: string | null;
  type: string | null;
};

function isOverdue(scheduledAt: string) {
  return new Date(scheduledAt).getTime() < Date.now();
}

// doc 11 §45/§46: los seguimientos son tareas con acción inmediata. En móvil
// la vendedora está en la calle: WhatsApp y llamar salen directo del teléfono
// del cliente, sin navegar por otras pantallas.
export function FollowUpsPanel({
  customerId,
  followUps,
  phone,
}: {
  customerId: string;
  followUps: FollowUpRow[];
  phone?: string | null;
}) {
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
      const res = await createFollowUpAction(
        customerId,
        new Date(scheduledAt).toISOString(),
        reason,
      );
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

  const digits = phone?.replace(/\D/g, "") ?? "";

  return (
    <section className="card card-pad">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Seguimientos pendientes</h2>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="btn btn-secondary btn-sm"
        >
          + Nuevo seguimiento
        </button>
      </div>

      {error && <p className="mb-2 text-sm text-danger">{error}</p>}

      {showForm && (
        <div className="mb-3 rounded-xl border border-line bg-surface-soft p-3">
          <label htmlFor="fu-date" className="field-label">
            Fecha y hora
          </label>
          <input
            id="fu-date"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="input"
          />
          <label htmlFor="fu-reason" className="field-label mt-3">
            Motivo
          </label>
          <input
            id="fu-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Llamar por recompra, confirmar recibo del pedido…"
            className="input"
          />
          <button
            type="button"
            disabled={isPending || !scheduledAt || !reason.trim()}
            onClick={create}
            className="btn btn-primary btn-sm btn-block-mobile mt-3"
          >
            Guardar seguimiento
          </button>
        </div>
      )}

      {followUps.length === 0 ? (
        <p className="text-sm text-text-soft">
          Sin seguimientos pendientes. Programa uno para no perder el ciclo de compra de este
          cliente.
        </p>
      ) : (
        <ul className="grid gap-2">
          {followUps.map((f) => {
            const overdue = isOverdue(f.scheduled_at);
            return (
              <li key={f.id} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={overdue ? "font-medium text-danger" : "text-text"}>
                    {formatDateTime(f.scheduled_at)}
                  </span>
                  {overdue && <span className="badge badge-danger">Vencido</span>}
                </div>
                {f.reason && <p className="mt-1 text-sm text-text-soft">{f.reason}</p>}

                <div className="mt-2 flex flex-wrap gap-2">
                  {digits && (
                    <>
                      <a
                        href={`https://wa.me/${digits.length === 10 ? `57${digits}` : digits}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                      >
                        WhatsApp
                      </a>
                      <a href={`tel:${digits}`} className="btn btn-secondary btn-sm">
                        Llamar
                      </a>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setCompletingId((id) => (id === f.id ? null : f.id))}
                    className="btn btn-secondary btn-sm"
                  >
                    Completar
                  </button>
                </div>

                {completingId === f.id && (
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={result}
                      onChange={(e) => setResult(e.target.value)}
                      placeholder="¿Qué pasó?"
                      className="input flex-1"
                    />
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => complete(f.id)}
                      className="btn btn-primary btn-sm"
                    >
                      Confirmar
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
