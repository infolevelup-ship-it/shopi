"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { searchCustomers, type CustomerSearchResult } from "@/lib/actions/customers";

function displayName(c: CustomerSearchResult) {
  return (
    c.commercial_name ??
    c.legal_name ??
    (`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "(sin nombre)")
  );
}

export default function CustomersPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerSearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        setResults(await searchCustomers(query));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error buscando clientes");
      }
    });
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-neutral-500 hover:underline">
            ← Inicio
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-neutral-900">Clientes</h1>
        </div>
        <Link
          href="/customers/new"
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
        >
          + Nuevo cliente
        </Link>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por documento, nombre o teléfono..."
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

      {results !== null && (
        <div className="mt-6 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {results.length === 0 ? (
            <p className="p-4 text-sm text-neutral-500">Sin resultados.</p>
          ) : (
            results.map((c) => (
              <Link
                key={c.id}
                href={`/customers/${c.id}`}
                className="flex items-center justify-between p-4 hover:bg-neutral-50"
              >
                <div>
                  <p className="text-sm font-medium text-neutral-900">{displayName(c)}</p>
                  <p className="text-xs text-neutral-500">
                    {c.document_type} {c.document_number}
                    {c.phone ? ` · ${c.phone}` : ""}
                  </p>
                </div>
                <div className="text-right text-xs text-neutral-500">
                  <p>{c.status}</p>
                  {c.responsible_name && <p>Responsable: {c.responsible_name}</p>}
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </main>
  );
}
