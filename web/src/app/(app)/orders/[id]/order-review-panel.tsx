"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveOrderAction, returnOrderAction, type ChecklistState } from "@/lib/actions/orders";

// doc 11 §38: el checklist va al final de la revisión, después de que bodega
// ya vio cliente, datos fiscales, inventario y productos — que es el orden en
// que están las tarjetas en la pantalla del pedido.
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

  const checkedCount = Object.values(checklist).filter(Boolean).length;
  const allChecked = checkedCount === CHECKLIST_ITEMS.length;

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
    <section className="card card-pad">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Checklist de revisión</h2>
        <span className={`badge ${allChecked ? "badge-success" : "badge-neutral"}`}>
          {checkedCount} de {CHECKLIST_ITEMS.length}
        </span>
      </div>
      <p className="mb-4 text-sm text-text-soft">
        Verifica cada punto físicamente. El pedido no se puede aprobar con puntos sin marcar.
      </p>

      <div className="grid gap-1 sm:grid-cols-2">
        {CHECKLIST_ITEMS.map((item) => (
          <label
            key={item.key}
            className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-surface-soft"
          >
            <input
              type="checkbox"
              checked={checklist[item.key]}
              onChange={() => toggle(item.key)}
              className="h-5 w-5 rounded border-line-strong accent-[#12b76a]"
            />
            {item.label}
          </label>
        ))}
      </div>

      <div className="mt-4">
        <label htmlFor="review-notes" className="field-label">
          Notas (opcional)
        </label>
        <textarea
          id="review-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="textarea"
        />
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-danger/30 bg-danger-bg p-3 text-sm text-[#b42318]">
          {error}
        </div>
      )}

      {/* doc 11 §42: aprobar significa "bodega verificó y está listo para que
          se facture" — no crea la factura. El texto lo dice explícitamente. */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={isPending || !allChecked}
          onClick={approve}
          title={!allChecked ? "Marca todos los puntos del checklist para aprobar" : undefined}
          className="btn btn-success btn-block-mobile"
        >
          ✓ Aprobar para facturar
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setShowReturnForm((s) => !s)}
          className="btn btn-danger btn-block-mobile"
        >
          Devolver a vendedora
        </button>
      </div>
      <p className="mt-2 text-xs text-text-muted">
        Aprobar no genera la factura: solo deja el pedido listo para facturarse.
      </p>

      {showReturnForm && (
        <div className="mt-3 rounded-xl border border-line bg-surface-soft p-3">
          <label htmlFor="return-reason" className="field-label">
            Motivo de la devolución (lo verá la vendedora)
          </label>
          <input
            id="return-reason"
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            className="input"
            placeholder="Producto agotado, precio incorrecto…"
          />
          <button
            type="button"
            disabled={isPending || !returnReason.trim()}
            onClick={doReturn}
            className="btn btn-danger btn-sm btn-block-mobile mt-2"
          >
            Confirmar devolución
          </button>
        </div>
      )}
    </section>
  );
}
