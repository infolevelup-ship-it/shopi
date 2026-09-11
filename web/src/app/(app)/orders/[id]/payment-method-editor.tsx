"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { correctOrderPaymentMethodAction } from "@/lib/actions/orders";
import { PAYMENT_METHOD_LABEL } from "@/lib/ui/status";
import { PAYMENT_DETAILS, labelOf } from "@/lib/ui/fiscal";

const PAYMENT_METHODS = Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => ({
  value,
  label,
}));

// Bodega ve esto justo al lado de los comprobantes adjuntos: si el pago
// anotado no coincide con lo que muestra el comprobante real, lo corrige
// aquí mismo sin tener que devolver el pedido entero a la vendedora.
export function PaymentMethodEditor({
  orderId,
  paymentMethod,
  paymentMethodDetail,
}: {
  orderId: string;
  paymentMethod: string | null;
  paymentMethodDetail: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [method, setMethod] = useState(paymentMethod ?? "contado");
  const [detail, setDetail] = useState(paymentMethodDetail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isCash = method === "contado";

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await correctOrderPaymentMethodAction(
        orderId,
        method,
        isCash ? detail || undefined : undefined,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 sm:justify-start">
        <dt className="text-text-soft">Forma de pago:</dt>
        <dd className="text-text">
          {(paymentMethod && PAYMENT_METHOD_LABEL[paymentMethod]) ?? paymentMethod ?? "—"}
          {paymentMethodDetail ? ` · ${labelOf(PAYMENT_DETAILS, paymentMethodDetail)}` : ""}
        </dd>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-medium text-brand underline"
        >
          Corregir
        </button>
      </div>
    );
  }

  return (
    <div className="col-span-full rounded-xl border border-line bg-surface-soft p-3 text-sm">
      <p className="mb-2 font-medium">
        Corregir forma de pago (según el comprobante real)
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="input"
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        {isCash && (
          <select
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            className="input"
          >
            <option value="">Sin especificar</option>
            {PAYMENT_DETAILS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        )}
      </div>
      {error && <p className="mt-2 text-danger">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={save}
          className="btn btn-primary btn-sm"
        >
          {isPending ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setEditing(false)}
          className="btn btn-secondary btn-sm"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
