"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncOrderProductStockAction } from "@/lib/actions/siigo";

export function OrderStockSyncButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function sync() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await syncOrderProductStockAction(orderId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(`Actualizado: ${result.updated}${result.skipped ? `, sin datos: ${result.skipped}` : ""}`);
      router.refresh();
    });
  }

  // doc 11 §40: acción secundaria — el dato importante es el inventario, no
  // el botón para refrescarlo.
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <button
        type="button"
        disabled={isPending}
        onClick={sync}
        className="btn btn-secondary btn-sm"
      >
        {isPending ? "Actualizando…" : "↻ Actualizar inventario"}
      </button>
      {message && <span className="text-success">{message}</span>}
      {error && <span className="text-danger">{error}</span>}
    </div>
  );
}
