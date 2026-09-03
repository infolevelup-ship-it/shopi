"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { searchCustomers, type CustomerSearchResult } from "@/lib/actions/customers";
import { searchProducts, type ProductSearchResult } from "@/lib/actions/products";
import { createQuoteAction, type QuoteItemInput } from "@/lib/actions/quotes";

function customerLabel(c: CustomerSearchResult) {
  return (
    c.commercial_name ??
    c.legal_name ??
    (`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.document_number)
  );
}

type Line = QuoteItemInput & { key: string; code: string; name: string };

function formatMoney(value: number) {
  return value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

function lineTotal(line: Line) {
  const subtotal = line.quantity * line.unitPrice;
  const discount = subtotal * ((line.discountPercent ?? 0) / 100);
  return subtotal - discount;
}

export default function NewQuotePage() {
  const router = useRouter();

  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerSearchResult[]>([]);
  const [customer, setCustomer] = useState<CustomerSearchResult | null>(null);

  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<ProductSearchResult[]>([]);

  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function runCustomerSearch(q: string) {
    setCustomerQuery(q);
    if (!q.trim()) {
      setCustomerResults([]);
      return;
    }
    startTransition(async () => {
      setCustomerResults(await searchCustomers(q));
    });
  }

  function runProductSearch(q: string) {
    setProductQuery(q);
    if (!q.trim()) {
      setProductResults([]);
      return;
    }
    startTransition(async () => {
      setProductResults(await searchProducts(q));
    });
  }

  function addLine(p: ProductSearchResult) {
    setLines((ls) => [
      ...ls,
      {
        key: `${p.id}-${Date.now()}`,
        productId: p.id,
        code: p.code,
        name: p.name,
        quantity: 1,
        unitPrice: p.price_public ?? 0,
        discountPercent: 0,
      },
    ]);
    setProductQuery("");
    setProductResults([]);
  }

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setLines((ls) => ls.filter((l) => l.key !== key));
  }

  const total = lines.reduce((sum, l) => sum + lineTotal(l), 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!customer) {
      setError("Selecciona un cliente.");
      return;
    }
    if (lines.length === 0) {
      setError("Agrega al menos un producto.");
      return;
    }

    startTransition(async () => {
      const result = await createQuoteAction(
        customer.id,
        lines.map(({ productId, quantity, unitPrice, discountPercent }) => ({
          productId,
          quantity,
          unitPrice,
          discountPercent,
        })),
        notes || undefined,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/quotes/${result.quoteId}`);
    });
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/quotes" className="text-sm text-neutral-500 hover:underline">
        ← Cotizaciones
      </Link>
      <h1 className="mt-1 mb-6 text-lg font-semibold text-neutral-900">Nueva cotización</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="text-sm font-medium text-neutral-700">Cliente</label>
          {customer ? (
            <div className="mt-1 flex items-center justify-between rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm">
              <span>{customerLabel(customer)}</span>
              <button
                type="button"
                onClick={() => setCustomer(null)}
                className="text-xs text-neutral-500 underline"
              >
                cambiar
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                value={customerQuery}
                onChange={(e) => runCustomerSearch(e.target.value)}
                placeholder="Buscar cliente por documento, nombre o teléfono..."
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
              {customerResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-neutral-200 bg-white shadow-lg">
                  {customerResults.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => {
                        setCustomer(c);
                        setCustomerResults([]);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-50"
                    >
                      {customerLabel(c)}{" "}
                      <span className="text-xs text-neutral-500">
                        {c.document_type} {c.document_number}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">Agregar producto</label>
          <div className="relative">
            <input
              value={productQuery}
              onChange={(e) => runProductSearch(e.target.value)}
              placeholder="Buscar por código, nombre o marca..."
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
            {productResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border border-neutral-200 bg-white shadow-lg">
                {productResults.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => addLine(p)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-50"
                  >
                    {p.name} <span className="text-xs text-neutral-500">{p.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {lines.length > 0 && (
          <div className="space-y-2">
            {lines.map((l) => (
              <div
                key={l.key}
                className="rounded-md border border-neutral-200 p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-neutral-900">{l.name}</span>
                  <button
                    type="button"
                    onClick={() => removeLine(l.key)}
                    className="text-xs text-red-600"
                  >
                    quitar
                  </button>
                </div>
                <div className="mt-2 flex gap-2">
                  <div className="w-20">
                    <label className="text-xs text-neutral-500">Cant.</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={l.quantity}
                      onChange={(e) => updateLine(l.key, { quantity: Number(e.target.value) })}
                      className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="w-28">
                    <label className="text-xs text-neutral-500">Precio</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={l.unitPrice}
                      onChange={(e) => updateLine(l.key, { unitPrice: Number(e.target.value) })}
                      className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="w-20">
                    <label className="text-xs text-neutral-500">% Desc.</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={l.discountPercent ?? 0}
                      onChange={(e) => updateLine(l.key, { discountPercent: Number(e.target.value) })}
                      className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="flex flex-1 items-end justify-end text-sm font-medium text-neutral-900">
                    {formatMoney(lineTotal(l))}
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-end border-t border-neutral-200 pt-2 text-sm">
              <span className="text-neutral-500">Estimado (sin IVA calculado aquí): </span>
              <span className="ml-1 font-semibold text-neutral-900">{formatMoney(total)}</span>
            </div>
            <p className="text-right text-xs text-neutral-400">
              El total real (con IVA y descuentos) lo calcula el servidor al guardar.
            </p>
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-neutral-700">Notas (opcional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? "Guardando..." : "Crear cotización"}
        </button>
      </form>
    </main>
  );
}
