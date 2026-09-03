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

  return (
    <div className="mt-2 flex items-center gap-2 text-xs">
      <button
        type="button"
        disabled={isPending}
        onClick={sync}
        className="rounded-md border border-neutral-300 px-2 py-1 font-medium text-neutral-700 disabled:opacity-50"
      >
        {isPending ? "Actualizando..." : "Actualizar stock desde Siigo"}
      </button>
      {message && <span className="text-green-700">{message}</span>}
      {error && <span className="text-red-700">{error}</span>}
    </div>
  );
}
