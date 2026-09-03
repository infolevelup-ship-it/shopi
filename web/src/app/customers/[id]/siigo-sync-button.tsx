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
    <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-neutral-900">Siigo</p>
        <button
          type="button"
          disabled={isPending}
          onClick={sync}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-900 disabled:opacity-50"
        >
          {isPending ? "Sincronizando..." : "Sincronizar con Siigo"}
        </button>
      </div>
      {message && <p className="mt-2 text-sm text-green-700">{message}</p>}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
