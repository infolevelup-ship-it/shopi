"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveOrderAction, returnOrderAction, type ChecklistState } from "@/lib/actions/orders";

const CHECKLIST_ITEMS: { key: keyof ChecklistState; label: string }[] = [
  { key: "customerOk", label: "Cliente correcto" },
  { key: "productsOk", label: "Productos correctos" },
  { key: "quantitiesOk", label: "Cantidades correctas" },
  { key: "pricesOk", label: "Precios correctos" },
  { key: "inventoryOk", label: "Inventario disponible" },
  { key: "paymentOk", label: "Forma de pago correcta" },
  { key: "receiptsOk", label: "Comprobante verificado" },
  { key: "fiscalDataOk", label: "Datos fiscales correctos" },
  { key: "printedReceipt", label: "Recibo impreso/verificado" },
];

const EMPTY_CHECKLIST: ChecklistState = {
  customerOk: false,
  productsOk: false,
  quantitiesOk: false,
  pricesOk: false,
  inventoryOk: false,
  paymentOk: false,
  receiptsOk: false,
  fiscalDataOk: false,
  printedReceipt: false,
};

export function OrderReviewPanel({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [checklist, setChecklist] = useState<ChecklistState>(EMPTY_CHECKLIST);
  const [notes, setNotes] = useState("");
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allChecked = Object.values(checklist).every(Boolean);

  function toggle(key: keyof ChecklistState) {
    setChecklist((c) => ({ ...c, [key]: !c[key] }));
  }

  function approve() {
    setError(null);
    startTransition(async () => {
      const result = await approveOrderAction(orderId, checklist, notes || undefined);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function doReturn() {
    setError(null);
    startTransition(async () => {
      const result = await returnOrderAction(orderId, returnReason, checklist);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-neutral-900">Checklist de revisión</h2>
      <div className="mt-3 space-y-2">
        {CHECKLIST_ITEMS.map((item) => (
          <label key={item.key} className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={checklist[item.key]}
              onChange={() => toggle(item.key)}
              className="h-4 w-4 rounded border-neutral-300"
            />
            {item.label}
          </label>
        ))}
      </div>

      <div className="mt-4">
        <label className="text-sm font-medium text-neutral-700">Notas (opcional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={isPending || !allChecked}
          onClick={approve}
          title={!allChecked ? "Marca todos los puntos del checklist para aprobar" : undefined}
          className="rounded-md bg-green-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Aprobar para facturar
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setShowReturnForm((s) => !s)}
          className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700"
        >
          Devolver a vendedora
        </button>
      </div>

      {showReturnForm && (
        <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <label className="text-sm font-medium text-neutral-700">Motivo de la devolución</label>
          <input
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            placeholder="Producto agotado, precio incorrecto..."
          />
          <button
            type="button"
            disabled={isPending || !returnReason.trim()}
            onClick={doReturn}
            className="mt-2 rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Confirmar devolución
          </button>
        </div>
      )}
    </div>
  );
}
