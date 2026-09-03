"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { searchQuotes, type QuoteSearchResult } from "@/lib/actions/quotes";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  FOLLOW_UP: "En seguimiento",
  ACCEPTED: "Aceptada",
  CONVERTED: "Convertida",
  LOST: "Perdida",
  EXPIRED: "Expirada",
  CANCELLED: "Cancelada",
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-neutral-100 text-neutral-700",
  SENT: "bg-blue-100 text-blue-700",
  FOLLOW_UP: "bg-amber-100 text-amber-700",
  ACCEPTED: "bg-green-100 text-green-700",
  CONVERTED: "bg-green-100 text-green-700",
  LOST: "bg-red-100 text-red-700",
  EXPIRED: "bg-neutral-100 text-neutral-500",
  CANCELLED: "bg-neutral-100 text-neutral-500",
};

function formatMoney(value: number) {
  return value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

export function QuoteSearch({ initialResults }: { initialResults: QuoteSearchResult[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QuoteSearchResult[]>(initialResults);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function runSearch(q: string) {
    setError(null);
    startTransition(async () => {
      try {
        setResults(await searchQuotes(q));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error buscando cotizaciones");
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
          placeholder="Buscar por consecutivo (WOW-C-...)"
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
          results.map((q) => (
            <Link
              key={q.id}
              href={`/quotes/${q.id}`}
              className="flex items-center justify-between p-4 hover:bg-neutral-50"
            >
              <div>
                <p className="text-sm font-medium text-neutral-900">{q.quote_number}</p>
                <p className="text-xs text-neutral-500">
                  {q.customer_name ?? "(sin cliente)"}
                  {q.seller_name ? ` · ${q.seller_name}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-neutral-900">{formatMoney(q.grand_total)}</p>
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[q.status] ?? "bg-neutral-100 text-neutral-700"}`}
                >
                  {STATUS_LABEL[q.status] ?? q.status}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </>
  );
}
