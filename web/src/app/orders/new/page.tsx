"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { searchCustomers, type CustomerSearchResult } from "@/lib/actions/customers";
import { searchProducts, type ProductSearchResult } from "@/lib/actions/products";
import { createOrderAction, type OrderItemInput } from "@/lib/actions/orders";

const PAYMENT_METHODS = [
  { value: "contado", label: "Contado" },
  { value: "credito_15", label: "Crédito 15 días" },
  { value: "credito_30", label: "Crédito 30 días" },
  { value: "credito_45", label: "Crédito 45 días" },
  { value: "credito_60", label: "Crédito 60 días" },
  { value: "contra_entrega", label: "Contra entrega" },
];

// Tasas confirmadas contra el catálogo real de Siigo (doc 06 §14). 10% NO
// se incluye a propósito: el formulario anterior la ofrecía pero no se
// encontró en Siigo — ofrecerla aquí crearía pedidos que fallarían al
// facturar en la Fase 7.
const RETENTION_RATES = [0, 1, 2, 2.5, 3.5, 4, 6, 7, 11];

function customerLabel(c: CustomerSearchResult) {
  return (
    c.commercial_name ??
    c.legal_name ??
    (`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.document_number)
  );
}

type Line = OrderItemInput & { key: string; name: string };

function formatMoney(value: number) {
  return value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

function lineNet(line: Line) {
  const subtotal = line.quantity * line.unitPrice;
  const discount = subtotal * ((line.discountPercent ?? 0) / 100);
  return subtotal - discount;
}

export default function NewOrderPage() {
  const router = useRouter();

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
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/orders" className="text-sm text-neutral-500 hover:underline">
        ← Pedidos
      </Link>
      <h1 className="mt-1 mb-6 text-lg font-semibold text-neutral-900">Nuevo pedido</h1>

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
              <div key={l.key} className="rounded-md border border-neutral-200 p-3 text-sm">
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
                    {formatMoney(lineNet(l))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-sm font-medium text-neutral-700">Forma de pago</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              {PAYMENT_METHODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="w-36">
            <label className="text-sm font-medium text-neutral-700">Retención</label>
            <select
              value={retentionPercent}
              onChange={(e) => setRetentionPercent(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              {RETENTION_RATES.map((r) => (
                <option key={r} value={r}>
                  {r === 0 ? "Sin retención" : `${r}%`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {lines.length > 0 && (
          <div className="space-y-1 border-t border-neutral-200 pt-2 text-sm">
            <div className="flex justify-end gap-4">
              <span className="text-neutral-500">Neto estimado (antes de IVA)</span>
              <span className="w-32 text-right">{formatMoney(netTotal)}</span>
            </div>
            {retentionPercent > 0 && (
              <div className="flex justify-end gap-4">
                <span className="text-neutral-500">Retención estimada</span>
                <span className="w-32 text-right">-{formatMoney(retentionEstimate)}</span>
              </div>
            )}
            <p className="text-right text-xs text-neutral-400">
              El IVA y el total exacto los calcula el servidor al guardar.
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
          {isPending ? "Guardando..." : "Crear pedido"}
        </button>
      </form>
    </main>
  );
}
