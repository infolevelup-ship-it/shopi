"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getCustomerForPicker,
  searchCustomers,
  type CustomerSearchResult,
} from "@/lib/actions/customers";
import { searchProducts, type ProductSearchResult } from "@/lib/actions/products";
import { createQuoteAction, type QuoteItemInput } from "@/lib/actions/quotes";
import { PageHeader } from "@/components/ui";
import { customerDisplayName, formatMoney } from "@/lib/ui/format";

type Line = QuoteItemInput & { key: string; code: string; name: string };

function lineTotal(line: Line) {
  const subtotal = line.quantity * line.unitPrice;
  const discount = subtotal * ((line.discountPercent ?? 0) / 100);
  return subtotal - discount;
}

function NewQuoteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomerId = searchParams.get("cliente");

  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerSearchResult[]>([]);
  const [customer, setCustomer] = useState<CustomerSearchResult | null>(null);

  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<ProductSearchResult[]>([]);

  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Cliente preseleccionado al llegar desde su ficha (?cliente=…)
  useEffect(() => {
    if (!preselectedCustomerId) return;
    let cancelled = false;
    getCustomerForPicker(preselectedCustomerId).then((c) => {
      if (!cancelled && c) setCustomer(c);
    });
    return () => {
      cancelled = true;
    };
  }, [preselectedCustomerId]);

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
    <div className="mx-auto max-w-3xl">
      <PageHeader back={{ href: "/quotes", label: "Cotizaciones" }} title="Nueva cotización" />

      <form onSubmit={handleSubmit} className="grid gap-5">
        <section className="card card-pad">
          <label className="field-label">Cliente</label>
          {customer ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-soft px-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{customerDisplayName(customer)}</p>
                <p className="text-sm text-text-soft">
                  {customer.document_type} {customer.document_number}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomer(null)}
                className="btn btn-tertiary btn-sm"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                value={customerQuery}
                onChange={(e) => runCustomerSearch(e.target.value)}
                placeholder="Buscar por documento, nombre o teléfono…"
                className="input"
              />
              {customerResults.length > 0 && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-md)]">
                  {customerResults.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => {
                        setCustomer(c);
                        setCustomerResults([]);
                      }}
                      className="block w-full px-3 py-3 text-left hover:bg-surface-soft"
                    >
                      <span className="font-medium">{customerDisplayName(c)}</span>
                      <span className="block text-sm text-text-soft">
                        {c.document_type} {c.document_number}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="card card-pad">
          <label className="field-label">Agregar producto</label>
          <div className="relative">
            <input
              value={productQuery}
              onChange={(e) => runProductSearch(e.target.value)}
              placeholder="Buscar por nombre, código o marca…"
              className="input"
            />
            {productResults.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-line bg-surface shadow-[var(--shadow-md)]">
                {productResults.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => addLine(p)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-surface-soft"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="block text-sm text-text-soft">{p.code}</span>
                    </span>
                    <span className="font-medium whitespace-nowrap">
                      {formatMoney(p.price_public)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {lines.length > 0 && (
          <ul className="mt-4 grid gap-2">
            {lines.map((l) => (
              <li
                key={l.key}
                className="rounded-xl border border-line p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{l.name}</p>
                    <p className="text-xs text-text-soft">{l.code}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(l.key)}
                    className="btn btn-tertiary btn-sm text-danger"
                  >
                    Quitar
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div>
                    <label className="field-label">Cant.</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={l.quantity}
                      onChange={(e) => updateLine(l.key, { quantity: Number(e.target.value) })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="field-label">Precio</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={l.unitPrice}
                      onChange={(e) => updateLine(l.key, { unitPrice: Number(e.target.value) })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="field-label">% Desc.</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={l.discountPercent ?? 0}
                      onChange={(e) =>
                        updateLine(l.key, { discountPercent: Number(e.target.value) })
                      }
                      className="input"
                    />
                  </div>
                </div>
                <div className="mt-2 text-right text-sm font-semibold">
                  {formatMoney(lineTotal(l))}
                </div>
              </li>
            ))}
          </ul>
          )}

          {lines.length > 0 && (
            <div className="mt-4 border-t border-line pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-text-soft">Estimado (antes de IVA)</span>
                <span className="font-semibold">{formatMoney(total)}</span>
              </div>
              <p className="mt-1 text-xs text-text-muted">
                El total real (con IVA y descuentos) lo calcula el servidor al guardar.
              </p>
            </div>
          )}
        </section>

        <section className="card card-pad">
          <label htmlFor="quote-notes" className="field-label">
            Notas (opcional)
          </label>
          <textarea
            id="quote-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="textarea"
          />
        </section>

        {error && (
          <div className="rounded-xl border border-danger/30 bg-danger-bg p-3 text-sm text-[#b42318]">
            {error}
          </div>
        )}

        <button type="submit" disabled={isPending} className="btn btn-primary btn-block-mobile">
          {isPending ? "Guardando…" : "Crear cotización"}
        </button>
      </form>
    </div>
  );
}

export default function NewQuotePage() {
  return (
    <Suspense fallback={<div className="skeleton h-64 w-full" />}>
      <NewQuoteForm />
    </Suspense>
  );
}
