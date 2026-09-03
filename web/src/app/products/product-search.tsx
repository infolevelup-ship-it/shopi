"use client";

import { useState, useTransition } from "react";
import { searchProducts, type ProductSearchResult } from "@/lib/actions/products";

function formatPrice(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

export function ProductSearch({ initialResults }: { initialResults: ProductSearchResult[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductSearchResult[]>(initialResults);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function runSearch(q: string) {
    setError(null);
    startTransition(async () => {
      try {
        setResults(await searchProducts(q));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error buscando productos");
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
          placeholder="Buscar por código, nombre o marca..."
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
          <p className="p-4 text-sm text-neutral-500">
            {isPending ? "Cargando..." : "Sin resultados."}
          </p>
        ) : (
          results.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium text-neutral-900">
                  {p.name}
                  {!p.active && (
                    <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                      inactivo
                    </span>
                  )}
                  {!p.siigo_product_id && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                      sin sincronizar con Siigo
                    </span>
                  )}
                </p>
                <p className="text-xs text-neutral-500">
                  {p.code}
                  {p.brand ? ` · ${p.brand}` : ""}
                  {p.stock_cache !== null ? ` · stock aprox: ${p.stock_cache}` : ""}
                </p>
              </div>
              <div className="text-right text-xs text-neutral-500">
                <p>Público: {formatPrice(p.price_public)}</p>
                {p.price_professional !== null && <p>Profesional: {formatPrice(p.price_professional)}</p>}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
