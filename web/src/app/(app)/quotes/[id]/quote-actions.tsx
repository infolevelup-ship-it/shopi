"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  sendQuoteAction,
  acceptQuoteAction,
  loseQuoteAction,
  convertQuoteToOrderAction,
} from "@/lib/actions/quotes";
import { formatMoney } from "@/lib/ui/format";

export type CambioDePrecio = { nombre: string; cotizado: number; hoy: number };

export function QuoteActions({
  quoteId,
  status,
  puedeConvertir,
  convertedOrderId,
  cambiosDePrecio,
}: {
  quoteId: string;
  status: string;
  puedeConvertir: boolean;
  convertedOrderId: string | null;
  cambiosDePrecio: CambioDePrecio[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showLoseForm, setShowLoseForm] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function convertir() {
    setError(null);
    startTransition(async () => {
      const result = await convertQuoteToOrderAction(quoteId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/orders/${result.orderId}`);
      router.refresh();
    });
  }

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

      {convertedOrderId && (
        <p className="mb-3 text-sm text-text-soft">
          Esta cotización ya es un pedido.{" "}
          <Link href={`/orders/${convertedOrderId}`} className="font-medium underline">
            Ver el pedido
          </Link>
        </p>
      )}

      {/* El pedido se crea con el precio de hoy, no con el cotizado. Si algo
          cambió desde que se cotizó, se dice antes y con nombre y cifras: que
          la vendedora pueda avisarle al cliente en vez de enterarse los dos
          cuando llegue la factura. */}
      {puedeConvertir && cambiosDePrecio.length > 0 && (
        <div className="mb-3 rounded-xl border border-warning/40 bg-warning-bg p-3 text-sm">
          <p className="font-semibold text-[#b54708]">
            {cambiosDePrecio.length === 1
              ? "Un producto cambió de precio desde que se cotizó"
              : `${cambiosDePrecio.length} productos cambiaron de precio desde que se cotizó`}
          </p>
          <ul className="mt-2 grid gap-1">
            {cambiosDePrecio.map((c) => (
              <li key={c.nombre} className="flex flex-wrap justify-between gap-x-3">
                <span className="min-w-0 truncate">{c.nombre}</span>
                <span className="whitespace-nowrap">
                  <span className="text-text-soft line-through">{formatMoney(c.cotizado)}</span>{" "}
                  <span className="font-semibold">{formatMoney(c.hoy)}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-text-soft">
            El pedido se crea con el precio de hoy. Confírmalo con el cliente antes de continuar.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {puedeConvertir && (
          <button
            disabled={isPending}
            onClick={convertir}
            className="btn btn-primary btn-block-mobile"
          >
            {isPending ? "Creando…" : "Pasar a pedido"}
          </button>
        )}

        {status === "DRAFT" && (
          <button
            disabled={isPending}
            onClick={() => run(() => sendQuoteAction(quoteId))}
            className="btn btn-secondary btn-block-mobile"
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
