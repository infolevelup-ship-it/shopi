"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createProductAction, type CreateProductInput } from "@/lib/actions/products";

const initialState: CreateProductInput = {
  code: "",
  name: "",
  brand: "",
  description: "",
};

export function NewProductForm() {
  const router = useRouter();
  const [form, setForm] = useState<CreateProductInput>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof CreateProductInput>(key: K, value: CreateProductInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createProductAction(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/products");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-2">
        <div className="w-40">
          <label className="text-sm font-medium text-neutral-700">Código</label>
          <input
            required
            value={form.code}
            onChange={(e) => update("code", e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="text-sm font-medium text-neutral-700">Nombre</label>
          <input
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-neutral-700">Marca (opcional)</label>
        <input
          value={form.brand}
          onChange={(e) => update("brand", e.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-sm font-medium text-neutral-700">Precio público</label>
          <input
            type="number"
            min="0"
            step="1"
            value={form.pricePublic ?? ""}
            onChange={(e) => update("pricePublic", e.target.value ? Number(e.target.value) : undefined)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700">Precio profesional</label>
          <input
            type="number"
            min="0"
            step="1"
            value={form.priceProfessional ?? ""}
            onChange={(e) =>
              update("priceProfessional", e.target.value ? Number(e.target.value) : undefined)
            }
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700">Precio salón</label>
          <input
            type="number"
            min="0"
            step="1"
            value={form.priceSalon ?? ""}
            onChange={(e) => update("priceSalon", e.target.value ? Number(e.target.value) : undefined)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <div className="w-32">
          <label className="text-sm font-medium text-neutral-700">% IVA</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.taxPercent ?? ""}
            onChange={(e) => update("taxPercent", e.target.value ? Number(e.target.value) : undefined)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="w-32">
          <label className="text-sm font-medium text-neutral-700">Stock aprox.</label>
          <input
            type="number"
            min="0"
            step="1"
            value={form.stockCache ?? ""}
            onChange={(e) => update("stockCache", e.target.value ? Number(e.target.value) : undefined)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        Este producto queda marcado como &quot;sin sincronizar con Siigo&quot; hasta que exista la
        integración real (Fase 7). El stock de aquí es solo referencial — nunca se usa para aprobar
        un pedido (doc 01 §10).
      </p>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? "Guardando..." : "Crear producto"}
        </button>
        <Link
          href="/products"
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
