"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncCustomerToSiigoAction } from "@/lib/actions/siigo";

const OUTCOME_MESSAGE: Record<string, string> = {
  already_linked: "Ya estaba sincronizado.",
  matched: "Encontrado en Siigo y asociado.",
  created: "Creado en Siigo.",
};

export function SiigoSyncButton({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function sync() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await syncCustomerToSiigoAction(customerId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.outcome === "conflict") {
        setError(
          `Siigo devolvió ${result.matches} clientes con esa identificación — conflicto, no se creó nada. Revisar a mano en Siigo.`,
        );
        return;
      }
      setMessage(OUTCOME_MESSAGE[result.outcome] ?? result.outcome);
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={sync}
        className="btn btn-secondary btn-sm"
      >
        {isPending ? "Sincronizando…" : "Sincronizar ahora"}
      </button>
      {message && <span className="text-sm text-success">{message}</span>}
      {error && <span className="text-sm text-danger">{error}</span>}
    </span>
  );
}
