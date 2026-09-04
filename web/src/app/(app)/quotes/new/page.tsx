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
import { SCard, SNumber, SSelect, SText, STextarea } from "@/components/siigo-fields";
import { customerDisplayName, formatMoney } from "@/lib/ui/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/ui/status";
import { PRICE_LISTS, type PriceList } from "@/lib/ui/fiscal";

const PAYMENT_METHODS = Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => ({
  value,
  label,
}));

// Las mismas tasas verificadas contra Siigo que usa el pedido: una
// cotización que promete un total con una retención inexistente termina en
// una factura que no cuadra con lo cotizado.
const RETENTION_RATES = [0, 1, 2, 2.5, 3.5, 4, 6, 7, 11];

type Line = QuoteItemInput & {
  key: string;
  code: string;
  name: string;
  // Las tres listas viajan en la línea para poder re-tarifar sin volver a
  // consultar el producto.
  prices: Record<PriceList, number | null>;
};

function priceFor(p: ProductSearchResult, list: PriceList) {
  if (list === "profesional") return p.price_professional;
  if (list === "salon") return p.price_salon;
  return p.price_public;
}

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
  const [priceList, setPriceList] = useState<PriceList>("salon");
  const [paymentMethod, setPaymentMethod] = useState("contado");
  const [retentionPercent, setRetentionPercent] = useState(0);
  const [validUntil, setValidUntil] = useState("");
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
        prices: {
          publico: p.price_public,
          profesional: p.price_professional,
          salon: p.price_salon,
        },
        quantity: 1,
        unitPrice: priceFor(p, priceList) ?? p.price_public ?? 0,
        discountPercent: 0,
      },
    ]);
    setProductQuery("");
    setProductResults([]);
  }

  function applyPriceList(list: PriceList) {
    setPriceList(list);
    setLines((ls) =>
      ls.map((l) => {
        const next = l.prices[list];
        // Un producto sin precio en esa lista conserva el que ya tenía.
        return next === null ? l : { ...l, unitPrice: next };
      }),
    );
  }

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setLines((ls) => ls.filter((l) => l.key !== key));
  }

  const total = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  const retentionEstimate = total * (retentionPercent / 100);

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
      const result = await createQuoteAction({
        customerId: customer.id,
        items: lines.map(({ productId, quantity, unitPrice, discountPercent }) => ({
          productId,
          quantity,
          unitPrice,
          discountPercent,
        })),
        notes: notes || undefined,
        priceList,
        retentionPercent,
        paymentMethod,
        validUntil: validUntil || undefined,
      });
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
        <SCard title="Lista de precio">
          <SSelect
            id="price-list"
            label="Lista de precio"
            value={priceList}
            onChange={(v) => applyPriceList(v as PriceList)}
            options={PRICE_LISTS.map((p) => ({ value: p.value, label: p.label }))}
          />
          <p className="s-note mt-1">
            Cambiarla vuelve a poner el precio de esa lista en los productos ya agregados. Si
            editaste un precio a mano, se pierde ese cambio.
          </p>
        </SCard>

        <SCard title="Cliente">
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
        </SCard>

        <SCard title="Productos">
          <div className="relative">
            <input
              value={productQuery}
              onChange={(e) => runProductSearch(e.target.value)}
              placeholder="Buscar por nombre, código o marca…"
              className="s-search"
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
                      {formatMoney(priceFor(p, priceList) ?? p.price_public)}
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
                <div className="mt-1 grid grid-cols-3 gap-4">
                  <SNumber
                    id={`qty-${l.key}`}
                    label="Cant."
                    min="0.01"
                    step="0.01"
                    value={l.quantity}
                    onChange={(v) => updateLine(l.key, { quantity: v })}
                  />
                  <SNumber
                    id={`price-${l.key}`}
                    label="Precio"
                    min="0"
                    step="1"
                    value={l.unitPrice}
                    onChange={(v) => updateLine(l.key, { unitPrice: v })}
                  />
                  <SNumber
                    id={`disc-${l.key}`}
                    label="% Desc."
                    min="0"
                    max="100"
                    step="0.01"
                    value={l.discountPercent ?? 0}
                    onChange={(v) => updateLine(l.key, { discountPercent: v })}
                  />
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
              {retentionPercent > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-soft">Retención estimada</span>
                  <span>-{formatMoney(retentionEstimate)}</span>
                </div>
              )}
              <p className="s-note mt-1">
                El total real (con IVA y descuentos) lo calcula el servidor al guardar.
              </p>
            </div>
          )}
        </SCard>

        <SCard title="Condiciones">
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            <SSelect
              id="quote-payment"
              label="Forma de pago propuesta"
              value={paymentMethod}
              onChange={setPaymentMethod}
              options={PAYMENT_METHODS}
            />
            <SSelect
              id="quote-retention"
              label="Retención"
              value={String(retentionPercent)}
              onChange={(v) => setRetentionPercent(Number(v))}
              options={RETENTION_RATES.map((r) => ({
                value: String(r),
                label: r === 0 ? "Sin retención" : `${r}%`,
              }))}
            />
            <div>
              <SText
                id="valid-until"
                label="Válida hasta"
                type="date"
                value={validUntil}
                onChange={setValidUntil}
              />
              <p className="s-note mt-1">Hasta cuándo se sostienen estos precios.</p>
            </div>
          </div>

          <div className="mt-2">
            <STextarea id="quote-notes" label="Notas" rows={2} value={notes} onChange={setNotes} />
          </div>
        </SCard>

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
