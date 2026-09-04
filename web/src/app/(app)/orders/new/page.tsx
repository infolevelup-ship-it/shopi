"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getCustomerForPicker,
  searchCustomers,
  type CustomerSearchResult,
} from "@/lib/actions/customers";
import { searchProducts, type ProductSearchResult } from "@/lib/actions/products";
import { createOrderAction, type OrderItemInput } from "@/lib/actions/orders";
import { PageHeader } from "@/components/ui";
import { customerDisplayName, formatMoney } from "@/lib/ui/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/ui/status";

const PAYMENT_METHODS = Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => ({
  value,
  label,
}));

// Tasas confirmadas contra el catálogo real de Siigo (doc 06 §14). 10% NO
// se incluye a propósito: el formulario anterior la ofrecía pero no se
// encontró en Siigo — ofrecerla aquí crearía pedidos que fallarían al
// facturar en la Fase 7.
const RETENTION_RATES = [0, 1, 2, 2.5, 3.5, 4, 6, 7, 11];

type Line = OrderItemInput & { key: string; name: string; code: string; stock: number | null };

function lineNet(line: Line) {
  const subtotal = line.quantity * line.unitPrice;
  const discount = subtotal * ((line.discountPercent ?? 0) / 100);
  return subtotal - discount;
}

function NewOrderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomerId = searchParams.get("cliente");

  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerSearchResult[]>([]);
  const [customer, setCustomer] = useState<CustomerSearchResult | null>(null);

  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<ProductSearchResult[]>([]);

  const [lines, setLines] = useState<Line[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("contado");
  const [retentionPercent, setRetentionPercent] = useState(0);
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
        name: p.name,
        code: p.code,
        stock: p.stock_cache,
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

  const netTotal = lines.reduce((sum, l) => sum + lineNet(l), 0);
  const retentionEstimate = netTotal * (retentionPercent / 100);
  const units = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);

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
      const result = await createOrderAction(
        customer.id,
        lines.map(({ productId, quantity, unitPrice, discountPercent }) => ({
          productId,
          quantity,
          unitPrice,
          discountPercent,
        })),
        paymentMethod,
        retentionPercent,
        notes || undefined,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/orders/${result.orderId}`);
    });
  }

  return (
    <div className="mx-auto max-w-3xl pb-24 md:pb-0">
      <PageHeader back={{ href: "/orders", label: "Pedidos" }} title="Nuevo pedido" />

      <form onSubmit={handleSubmit} className="grid gap-5">
        {/* ------------------------------------------------------- cliente */}
        <section className="card card-pad">
          <label className="field-label">Cliente</label>
          {customer ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-soft px-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{customerDisplayName(customer)}</p>
                <p className="text-sm text-text-soft">
                  {customer.document_type} {customer.document_number}
                  {customer.responsible_name ? ` · ${customer.responsible_name}` : ""}
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

        {/* ------------------------------------------------------ productos */}
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
                      <span className="block text-sm text-text-soft">
                        {p.code}
                        {p.stock_cache !== null ? ` · stock aprox. ${p.stock_cache}` : ""}
                      </span>
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
              {lines.map((l) => {
                const short = l.stock !== null && l.stock < Number(l.quantity);
                return (
                  <li key={l.key} className="rounded-xl border border-line p-3">
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
                          inputMode="decimal"
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
                          inputMode="numeric"
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
                          inputMode="decimal"
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

                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className={short ? "font-medium text-danger" : "text-text-soft"}>
                        {l.stock === null
                          ? "Inventario sin datos"
                          : short
                            ? `Solo hay ${l.stock} en inventario`
                            : `Inventario: ${l.stock}`}
                      </span>
                      <span className="font-semibold">{formatMoney(lineNet(l))}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ----------------------------------------------------------- pago */}
        <section className="card card-pad">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="payment" className="field-label">
                Forma de pago
              </label>
              <select
                id="payment"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="select"
              >
                {PAYMENT_METHODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="retention" className="field-label">
                Retención
              </label>
              <select
                id="retention"
                value={retentionPercent}
                onChange={(e) => setRetentionPercent(Number(e.target.value))}
                className="select"
              >
                {RETENTION_RATES.map((r) => (
                  <option key={r} value={r}>
                    {r === 0 ? "Sin retención" : `${r}%`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="notes" className="field-label">
              Notas (opcional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="textarea"
            />
          </div>

          {lines.length > 0 && (
            <dl className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-soft">Neto estimado (antes de IVA)</dt>
                <dd>{formatMoney(netTotal)}</dd>
              </div>
              {retentionPercent > 0 && (
                <div className="flex justify-between">
                  <dt className="text-text-soft">Retención estimada</dt>
                  <dd>-{formatMoney(retentionEstimate)}</dd>
                </div>
              )}
              {/* doc 11 §87: no afirmar un total que todavía no calculó el servidor */}
              <p className="pt-1 text-xs text-text-muted">
                El IVA y el total exacto los calcula el servidor al guardar.
              </p>
            </dl>
          )}
        </section>

        {error && (
          <div className="rounded-xl border border-danger/30 bg-danger-bg p-3 text-sm text-[#b42318]">
            {error}
          </div>
        )}

        <button type="submit" disabled={isPending} className="btn btn-primary hidden md:inline-flex">
          {isPending ? "Guardando…" : "Crear pedido"}
        </button>
      </form>

      {/* doc 11 §32/§52: en móvil el total y la acción principal viven fijos abajo */}
      <div className="safe-bottom fixed inset-x-0 bottom-16 z-[450] border-t border-line bg-surface/96 px-4 pt-3 backdrop-blur md:hidden">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-text-soft">
            {lines.length} producto(s) · {units} unidad(es)
          </span>
          <span className="font-semibold">{formatMoney(netTotal)}</span>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={handleSubmit}
          className="btn btn-primary w-full"
        >
          {isPending ? "Guardando…" : "Crear pedido"}
        </button>
      </div>
    </div>
  );
}

// useSearchParams necesita un límite de Suspense para que Next pueda
// prerenderizar la parte estática de la página.
export default function NewOrderPage() {
  return (
    <Suspense fallback={<div className="skeleton h-64 w-full" />}>
      <NewOrderForm />
    </Suspense>
  );
}
