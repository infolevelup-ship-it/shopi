"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reassignCustomerAction, type SellerOption } from "@/lib/actions/customers";

export function ReassignCustomerSelect({
  customerId,
  currentSellerId,
  sellers,
}: {
  customerId: string;
  currentSellerId: string | null;
  sellers: SellerOption[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(currentSellerId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reasignar() {
    if (!selected || selected === currentSellerId) return;
    setError(null);
    startTransition(async () => {
      const r = await reassignCustomerAction(customerId, selected);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="input w-auto"
        >
          <option value="" disabled>
            Elegir vendedora…
          </option>
          {sellers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={isPending || !selected || selected === currentSellerId}
          onClick={reasignar}
          className="btn btn-secondary btn-sm"
        >
          {isPending ? "Reasignando…" : "Reasignar"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
