"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getCustomerForPicker,
  searchCustomers,
  type CustomerSearchResult,
} from "@/lib/actions/customers";
import { searchProducts, type ProductSearchResult } from "@/lib/actions/products";
import {
  createOrderAction,
  updateOrderAction,
  type OrderItemInput,
} from "@/lib/actions/orders";
import { PageHeader } from "@/components/ui";
import { SCard, SNumber, SSelect, STextarea } from "@/components/siigo-fields";
import { customerDisplayName, formatMoney } from "@/lib/ui/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/ui/status";
import { PAYMENT_DETAILS, PRICE_LISTS, SALE_ORIGINS, type PriceList } from "@/lib/ui/fiscal";

const PAYMENT_METHODS = Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => ({
  value,
  label,
}));

// Tasas confirmadas contra el catálogo real de Siigo (doc 06 §14). 10% NO
// se incluye a propósito: el formulario anterior la ofrecía pero no se
// encontró en Siigo — ofrecerla aquí crearía pedidos que fallarían al
// facturar en la Fase 7.
const RETENTION_RATES = [0, 1, 2, 2.5, 3.5, 4, 6, 7, 11];

type Line = OrderItemInput & {
  key: string;
  name: string;
  code: string;
  stock: number | null;
  // Las tres listas se guardan en la línea para poder re-tarifar sin volver
  // a consultar el producto cuando la vendedora cambia de lista.
  prices: Record<PriceList, number | null>;
};

function priceFor(p: ProductSearchResult, list: PriceList) {
  if (list === "profesional") return p.price_professional;
  if (list === "salon") return p.price_salon;
  return p.price_public;
}

function lineNet(line: Line) {
  const subtotal = line.quantity * line.unitPrice;
  const discount = subtotal * ((line.discountPercent ?? 0) / 100);
  return subtotal - discount;
}

export type OrderFormLine = {
  productId: string;
  name: string;
  code: string;
  stock: number | null;
  prices: Record<PriceList, number | null>;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
};

export type OrderFormInitial = {
  customer: CustomerSearchResult | null;
  lines: OrderFormLine[];
  channel: "B2B" | "B2C";
  priceList: PriceList;
  paymentMethod: string;
  paymentDetail: string;
  saleOrigin: string;
  retentionPercent: number;
  notes: string;
};

/**
 * El mismo formulario sirve para crear y para editar. Se comparte a propósito:
 * si fueran dos pantallas separadas, cualquier regla nueva (una lista de
 * precio, un medio de pago) habría que recordarla en las dos y tarde o
 * temprano se separarían.
 */
export function OrderForm({
  mode,
  orderId,
  initial,
  preselectedCustomerId = null,
}: {
  mode: "create" | "edit";
  orderId?: string;
  initial?: OrderFormInitial;
  preselectedCustomerId?: string | null;
}) {
  const router = useRouter();
  const isEdit = mode === "edit";

  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerSearchResult[]>([]);
  const [customer, setCustomer] = useState<CustomerSearchResult | null>(
    initial?.customer ?? null,
  );

  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<ProductSearchResult[]>([]);

  const [lines, setLines] = useState<Line[]>(
    () => (initial?.lines ?? []).map((l, i) => ({ ...l, key: `${l.productId}-${i}` })),
  );
  const [channel, setChannel] = useState<"B2B" | "B2C">(initial?.channel ?? "B2B");
  const [priceList, setPriceList] = useState<PriceList>(initial?.priceList ?? "salon");
  const [paymentMethod, setPaymentMethod] = useState(initial?.paymentMethod ?? "contado");
  const [paymentDetail, setPaymentDetail] = useState(initial?.paymentDetail ?? "");
  const [saleOrigin, setSaleOrigin] = useState(initial?.saleOrigin ?? "");
  const [retentionPercent, setRetentionPercent] = useState(initial?.retentionPercent ?? 0);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Cliente preseleccionado al llegar desde su ficha (?cliente=…). En edición
  // no aplica: el cliente del pedido no se cambia.
  useEffect(() => {
    if (isEdit || !preselectedCustomerId) return;
    let cancelled = false;
    getCustomerForPicker(preselectedCustomerId).then((c) => {
      if (!cancelled && c) setCustomer(c);
    });
    return () => {
      cancelled = true;
    };
  }, [isEdit, preselectedCustomerId]);

  // doc GUIA_B2C: en B2C el precio es el público, no hay retención y solo
  // se cobra de contado. Cambiar de canal re-tarifa lo que ya esté cargado.
  function switchChannel(next: "B2B" | "B2C") {
    setChannel(next);
    if (next === "B2C") {
      applyPriceList("publico");
      setRetentionPercent(0);
      setPaymentMethod("contado");
    } else {
      applyPriceList("salon");
    }
  }

  function applyPriceList(list: PriceList) {
    setPriceList(list);
    setLines((ls) =>
      ls.map((l) => {
        const next = l.prices[list];
        // Un producto sin precio en esa lista conserva el que ya tenía: es
        // mejor que ponerlo en cero y facturar gratis.
        return next === null ? l : { ...l, unitPrice: next };
      }),
    );
  }

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

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setLines((ls) => ls.filter((l) => l.key !== key));
  }

  const netTotal = lines.reduce((sum, l) => sum + lineNet(l), 0);
  const retentionEstimate = netTotal * (retentionPercent / 100);
  const units = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
  const isCash = paymentMethod === "contado";
  const availablePaymentMethods =
    channel === "B2C" ? PAYMENT_METHODS.filter((p) => p.value === "contado") : PAYMENT_METHODS;

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

    const common = {
      items: lines.map(({ productId, quantity, unitPrice, discountPercent }) => ({
        productId,
        quantity,
        unitPrice,
        discountPercent,
      })),
      paymentMethod,
      retentionPercent: channel === "B2C" ? 0 : retentionPercent,
      notes: notes || undefined,
      channel,
      priceList,
      paymentMethodDetail: isCash ? paymentDetail || undefined : undefined,
      saleOrigin: saleOrigin || undefined,
    };

    startTransition(async () => {
      const result =
        isEdit && orderId
          ? await updateOrderAction({ orderId, ...common })
          : await createOrderAction({ customerId: customer.id, ...common });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/orders/${result.orderId}`);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-3xl pb-24 md:pb-0">
      <PageHeader
        back={
          isEdit && orderId
            ? { href: `/orders/${orderId}`, label: "Pedido" }
            : { href: "/orders", label: "Pedidos" }
        }
        title={isEdit ? "Editar pedido" : "Nuevo pedido"}
        subtitle={
          isEdit
            ? "Se recalculan los totales al guardar. El cliente no se cambia: un pedido para otro cliente es otro pedido."
            : undefined
        }
      />

      <form onSubmit={handleSubmit} className="grid gap-5">
        {/* --------------------------------------------------- canal B2B/B2C */}
        <SCard title="Tipo de venta">
          <fieldset>
            <div className="grid grid-cols-2 gap-2">
              {(["B2B", "B2C"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => switchChannel(c)}
                  className={`min-h-[44px] rounded-xl border px-3 text-sm font-medium ${
                    channel === c
                      ? "border-primary bg-primary text-white"
                      : "border-line-strong bg-surface text-text-soft"
                  }`}
                >
                  {c === "B2B" ? "B2B · Salón o profesional" : "B2C · Consumidor final"}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-3">
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
          </div>
        </SCard>

        {/* ------------------------------------------------------- cliente */}
        <SCard title="Cliente">
          {customer ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-soft px-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{customerDisplayName(customer)}</p>
                <p className="text-sm text-text-soft">
                  {customer.document_type} {customer.document_number}
                  {customer.responsible_name ? ` · ${customer.responsible_name}` : ""}
                </p>
              </div>
              {!isEdit && (
                <button
                  type="button"
                  onClick={() => setCustomer(null)}
                  className="btn btn-tertiary btn-sm"
                >
                  Cambiar
                </button>
              )}
            </div>
          ) : (
            <div className="relative">
              <input
                value={customerQuery}
                onChange={(e) => runCustomerSearch(e.target.value)}
                placeholder="Buscar por documento, nombre o teléfono…"
                className="s-search"
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
              {/* Punto 2 de la revisión: no hay cliente ficticio de mostrador
                  — un B2C se registra como persona natural igual que los demás. */}
              <p className="mt-2 text-xs text-text-muted">
                ¿No está?{" "}
                <Link href="/customers/new" className="underline">
                  Crear cliente
                </Link>
                .
              </p>
            </div>
          )}
        </SCard>

        {/* ------------------------------------------------------ productos */}
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
                      <span className="block text-sm text-text-soft">
                        {p.code}
                        {p.stock_cache !== null ? ` · stock aprox. ${p.stock_cache}` : ""}
                      </span>
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
        </SCard>

        {/* ----------------------------------------------------------- pago */}
        <SCard title="Pago y origen">
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            <div>
              <SSelect
                id="payment"
                label="Forma de pago"
                value={paymentMethod}
                onChange={setPaymentMethod}
                options={availablePaymentMethods}
              />
              {channel === "B2C" && (
                <p className="s-note mt-1">En B2C solo se cobra de contado.</p>
              )}
            </div>

            {/* El medio de pago solo tiene sentido si ya entró la plata: a
                crédito todavía no hay nada que registrar. */}
            {isCash && (
              <SSelect
                id="payment-detail"
                label="Medio de pago"
                value={paymentDetail}
                onChange={setPaymentDetail}
                options={PAYMENT_DETAILS}
                placeholder="Sin especificar"
              />
            )}

            {channel === "B2B" && (
              <SSelect
                id="retention"
                label="Retención"
                value={String(retentionPercent)}
                onChange={(v) => setRetentionPercent(Number(v))}
                options={RETENTION_RATES.map((r) => ({
                  value: String(r),
                  label: r === 0 ? "Sin retención" : `${r}%`,
                }))}
              />
            )}

            <SSelect
              id="sale-origin"
              label="Origen de la venta"
              value={saleOrigin}
              onChange={setSaleOrigin}
              options={SALE_ORIGINS}
              placeholder="Sin especificar"
            />
          </div>

          <div className="mt-2">
            <STextarea id="notes" label="Notas" rows={2} value={notes} onChange={setNotes} />
          </div>

          {lines.length > 0 && (
            <dl className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-soft">Neto estimado (antes de IVA)</dt>
                <dd>{formatMoney(netTotal)}</dd>
              </div>
              {retentionPercent > 0 && channel === "B2B" && (
                <div className="flex justify-between">
                  <dt className="text-text-soft">Retención estimada</dt>
                  <dd>-{formatMoney(retentionEstimate)}</dd>
                </div>
              )}
              {/* doc 11 §87: no afirmar un total que todavía no calculó el servidor */}
              <p className="s-note pt-1">
                El IVA y el total exacto los calcula el servidor al guardar.
              </p>
            </dl>
          )}
        </SCard>

        {error && (
          <div className="rounded-xl border border-danger/30 bg-danger-bg p-3 text-sm text-[#b42318]">
            {error}
          </div>
        )}

        <button type="submit" disabled={isPending} className="btn btn-primary hidden md:inline-flex">
          {isPending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear pedido"}
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
          {isPending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear pedido"}
        </button>
      </div>
    </div>
  );
}
