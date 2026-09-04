"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncCustomerToGhlAction } from "@/lib/actions/ghl";

export function GhlSyncStatus({
  customerId,
  status,
  error,
}: {
  customerId: string;
  status: string | null;
  error: string | null;
}) {
  const router = useRouter();
  const [localError, setLocalError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!status) return null;

  function retry() {
    setLocalError(null);
    startTransition(async () => {
      const result = await syncCustomerToGhlAction(customerId);
      if (!result.ok) {
        setLocalError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (status === "SYNCED") {
    return <p className="text-xs text-text-muted">GHL: sincronizado</p>;
  }

  return (
    <p className="text-xs text-warning">
      GHL: {status === "ERROR" ? "error" : "pendiente"}
      {error ? ` — ${error}` : ""}{" "}
      <button type="button" disabled={isPending} onClick={retry} className="underline disabled:opacity-50">
        {isPending ? "reintentando..." : "reintentar"}
      </button>
      {localError && <span className="text-danger"> — {localError}</span>}
    </p>
  );
}
