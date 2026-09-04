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
    <form onSubmit={handleSubmit} className="grid gap-5">
      <section className="card card-pad grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label">Código (SKU)</label>
          <input
            required
            value={form.code}
            onChange={(e) => update("code", e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="field-label">Nombre</label>
          <input
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className="input"
          />
        </div>

      <div className="sm:col-span-2">
        <label className="field-label">Marca (opcional)</label>
        <input
          value={form.brand}
          onChange={(e) => update("brand", e.target.value)}
          className="input"
        />
      </div>

      </section>

      <section className="card card-pad">
      <h2 className="mb-3 text-base font-semibold">Precios e inventario</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="field-label">Precio público</label>
          <input
            type="number"
            min="0"
            step="1"
            value={form.pricePublic ?? ""}
            onChange={(e) => update("pricePublic", e.target.value ? Number(e.target.value) : undefined)}
            className="input"
          />
        </div>
        <div>
          <label className="field-label">Precio profesional</label>
          <input
            type="number"
            min="0"
            step="1"
            value={form.priceProfessional ?? ""}
            onChange={(e) =>
              update("priceProfessional", e.target.value ? Number(e.target.value) : undefined)
            }
            className="input"
          />
        </div>
        <div>
          <label className="field-label">Precio salón</label>
          <input
            type="number"
            min="0"
            step="1"
            value={form.priceSalon ?? ""}
            onChange={(e) => update("priceSalon", e.target.value ? Number(e.target.value) : undefined)}
            className="input"
          />
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="field-label">% IVA</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.taxPercent ?? ""}
            onChange={(e) => update("taxPercent", e.target.value ? Number(e.target.value) : undefined)}
            className="input"
          />
        </div>
        <div>
          <label className="field-label">Inventario aprox.</label>
          <input
            type="number"
            min="0"
            step="1"
            value={form.stockCache ?? ""}
            onChange={(e) => update("stockCache", e.target.value ? Number(e.target.value) : undefined)}
            className="input"
          />
        </div>
      </div>

      </section>

      <p className="rounded-xl border border-warning/30 bg-warning-bg p-3 text-sm text-[#b54708]">
        Este producto queda marcado como &quot;sin sincronizar con Siigo&quot; hasta que exista la
        integración real (Fase 7). El stock de aquí es solo referencial — nunca se usa para aprobar
        un pedido (doc 01 §10).
      </p>

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger-bg p-3 text-sm text-[#b42318]">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="submit" disabled={isPending} className="btn btn-primary btn-block-mobile">
          {isPending ? "Guardando…" : "Crear producto"}
        </button>
        <Link href="/products" className="btn btn-secondary btn-block-mobile">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
