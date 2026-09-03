"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { searchOrders, type OrderSearchResult } from "@/lib/actions/orders";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  SUBMITTED: "Enviado",
  PENDING_REVIEW: "Pendiente de revisión",
  IN_REVIEW: "En revisión",
  RETURNED_TO_SELLER: "Devuelto a vendedora",
  APPROVED_FOR_INVOICE: "Aprobado para facturar",
  INVOICING: "Facturando",
  INVOICED: "Facturado",
  READY_FOR_DISPATCH: "Listo para despacho",
  DISPATCHED: "Despachado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  BLOCKED: "Bloqueado",
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-neutral-100 text-neutral-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  PENDING_REVIEW: "bg-amber-100 text-amber-700",
  IN_REVIEW: "bg-amber-100 text-amber-700",
  RETURNED_TO_SELLER: "bg-red-100 text-red-700",
  APPROVED_FOR_INVOICE: "bg-green-100 text-green-700",
  INVOICING: "bg-blue-100 text-blue-700",
  INVOICED: "bg-green-100 text-green-700",
  READY_FOR_DISPATCH: "bg-green-100 text-green-700",
  DISPATCHED: "bg-green-100 text-green-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-neutral-100 text-neutral-500",
  BLOCKED: "bg-red-100 text-red-700",
};

function formatMoney(value: number) {
  return value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

export function OrderSearch({ initialResults }: { initialResults: OrderSearchResult[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OrderSearchResult[]>(initialResults);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function runSearch(q: string) {
    setError(null);
    startTransition(async () => {
      try {
        setResults(await searchOrders(q));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error buscando pedidos");
      }
    });
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(query);
        }}
        className="flex gap-2"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por consecutivo (WOW-P-...)"
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {isPending ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
        {results.length === 0 ? (
          <p className="p-4 text-sm text-neutral-500">Sin resultados.</p>
        ) : (
          results.map((o) => (
            <Link
              key={o.id}
              href={`/orders/${o.id}`}
              className="flex items-center justify-between p-4 hover:bg-neutral-50"
            >
              <div>
                <p className="text-sm font-medium text-neutral-900">{o.order_number}</p>
                <p className="text-xs text-neutral-500">
                  {o.customer_name ?? "(sin cliente)"}
                  {o.seller_name ? ` · ${o.seller_name}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-neutral-900">{formatMoney(o.grand_total)}</p>
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[o.status] ?? "bg-neutral-100 text-neutral-700"}`}
                >
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </>
  );
}
