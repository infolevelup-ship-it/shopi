"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markProspectLostAction,
  registerProspectVisitAction,
} from "@/lib/actions/prospects";
import {
  PROSPECT_LOST_REASONS,
  PROSPECT_STAGE_FLOW,
  PROSPECT_VISIT_TYPES,
  type ProspectStage,
} from "@/lib/ui/prospects";
import { statusMeta } from "@/lib/ui/status";

export function ProspectActions({
  prospectId,
  currentStage,
}: {
  prospectId: string;
  currentStage: string;
}) {
  const router = useRouter();
  const [visitType, setVisitType] = useState("visita");
  const [notes, setNotes] = useState("");
  const [stage, setStage] = useState<ProspectStage>(currentStage as ProspectStage);
  const [nextFollowUp, setNextFollowUp] = useState("");
  const [showLose, setShowLose] = useState(false);
  const [lostReason, setLostReason] = useState(PROSPECT_LOST_REASONS[0]);
  const [lostDetail, setLostDetail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleVisit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await registerProspectVisitAction({
        prospectId,
        visitType,
        notes: notes || undefined,
        stage,
        nextFollowUpAt: nextFollowUp ? `${nextFollowUp}T12:00:00` : undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotes("");
      setNextFollowUp("");
      router.refresh();
    });
  }

  function handleLose() {
    setError(null);
    // "Otro" a secas no le dice nada a nadie dentro de tres meses.
    const reason =
      lostReason === "Otro" && lostDetail.trim() ? lostDetail.trim() : lostReason;
    startTransition(async () => {
      const result = await markProspectLostAction(prospectId, reason);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="card card-pad">
      <h2 className="mb-3 text-base font-semibold">Registrar visita</h2>

      {error && (
        <div className="mb-3 rounded-xl border border-danger/30 bg-danger-bg p-3 text-sm text-[#b42318]">
          {error}
        </div>
      )}

      <form onSubmit={handleVisit} className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="visit-type" className="field-label">
              Tipo de contacto
            </label>
            <select
              id="visit-type"
              value={visitType}
              onChange={(e) => setVisitType(e.target.value)}
              className="select"
            >
              {PROSPECT_VISIT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="stage" className="field-label">
              Etapa después de esta visita
            </label>
            <select
              id="stage"
              value={stage}
              onChange={(e) => setStage(e.target.value as ProspectStage)}
              className="select"
            >
              {PROSPECT_STAGE_FLOW.map((s) => (
                <option key={s} value={s}>
                  {statusMeta("prospect", s).label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="visit-notes" className="field-label">
            Qué pasó
          </label>
          <textarea
            id="visit-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="textarea"
            placeholder="Con quién habló, qué le interesó, qué quedó pendiente…"
          />
        </div>

        <div>
          <label htmlFor="next-follow-up" className="field-label">
            Próximo seguimiento
          </label>
          <input
            id="next-follow-up"
            type="date"
            value={nextFollowUp}
            onChange={(e) => setNextFollowUp(e.target.value)}
            className="input"
          />
          <p className="mt-1 text-xs text-text-muted">
            Si lo dejas vacío, el prospecto sale de la agenda hasta que vuelvas a entrar aquí.
          </p>
        </div>

        <button type="submit" disabled={isPending} className="btn btn-primary btn-block-mobile">
          {isPending ? "Guardando…" : "Guardar visita"}
        </button>
      </form>

      <div className="mt-4 border-t border-line pt-4">
        <button
          type="button"
          onClick={() => setShowLose((s) => !s)}
          className="btn btn-tertiary btn-sm text-danger"
        >
          Marcar como perdido
        </button>

        {showLose && (
          <div className="mt-3 rounded-xl border border-line bg-surface-soft p-3">
            <label htmlFor="lost-reason" className="field-label">
              Motivo
            </label>
            <select
              id="lost-reason"
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              className="select"
            >
              {PROSPECT_LOST_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {lostReason === "Otro" && (
              <input
                value={lostDetail}
                onChange={(e) => setLostDetail(e.target.value)}
                className="input mt-2"
                placeholder="¿Cuál?"
              />
            )}
            <button
              type="button"
              disabled={isPending || (lostReason === "Otro" && !lostDetail.trim())}
              onClick={handleLose}
              className="btn btn-danger btn-sm btn-block-mobile mt-2"
            >
              Confirmar como perdido
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
