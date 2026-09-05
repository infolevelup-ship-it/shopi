"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { claimCustomerAction } from "@/lib/actions/customers";

export function ClaimCustomerButton({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await claimCustomerAction(customerId);
            if (!r.ok) {
              setError(r.error);
              return;
            }
            router.refresh();
          })
        }
        className="btn btn-primary btn-sm"
      >
        {isPending ? "Asignando…" : "Hacerme responsable"}
      </button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
