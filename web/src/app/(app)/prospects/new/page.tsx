"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProspectAction } from "@/lib/actions/prospects";
import { PROSPECT_SOURCES } from "@/lib/ui/prospects";
import { PageHeader } from "@/components/ui";

export default function NewProspectPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    commercialName: "",
    phone: "",
    email: "",
    city: "",
    source: "",
    notes: "",
    nextFollowUpAt: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createProspectAction({
        name: form.name,
        commercialName: form.commercialName || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        city: form.city || undefined,
        source: form.source || undefined,
        notes: form.notes || undefined,
        // El input entrega "2026-09-10"; el servidor espera un instante.
        nextFollowUpAt: form.nextFollowUpAt ? `${form.nextFollowUpAt}T12:00:00` : undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/prospects/${result.prospectId}`);
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        back={{ href: "/prospects", label: "Prospectos" }}
        title="Nuevo prospecto"
        subtitle="Un salón que todavía no compra. No pide datos fiscales: eso se llena cuando se convierta en cliente."
      />

      <form onSubmit={handleSubmit} className="grid gap-5">
        <section className="card card-pad">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="name" className="field-label">
                Nombre del negocio o de la persona
              </label>
              <input
                id="name"
                required
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className="input"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="commercial" className="field-label">
                Nombre comercial (opcional)
              </label>
              <input
                id="commercial"
                value={form.commercialName}
                onChange={(e) => update("commercialName", e.target.value)}
                className="input"
                placeholder="Como lo conocen: “Salón Luna”"
              />
            </div>
            <div>
              <label htmlFor="phone" className="field-label">
                Teléfono
              </label>
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="email" className="field-label">
                Correo
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="city" className="field-label">
                Ciudad
              </label>
              <input
                id="city"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="source" className="field-label">
                ¿De dónde salió?
              </label>
              <select
                id="source"
                value={form.source}
                onChange={(e) => update("source", e.target.value)}
                className="select"
              >
                <option value="">Sin especificar</option>
                {PROSPECT_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="follow-up" className="field-label">
                Próximo seguimiento
              </label>
              <input
                id="follow-up"
                type="date"
                value={form.nextFollowUpAt}
                onChange={(e) => update("nextFollowUpAt", e.target.value)}
                className="input"
              />
              <p className="mt-1 text-xs text-text-muted">
                Sin fecha, el prospecto no aparece en ninguna agenda y es fácil que se olvide.
              </p>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="notes" className="field-label">
                Notas
              </label>
              <textarea
                id="notes"
                rows={3}
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                className="textarea"
                placeholder="Qué marcas maneja, quién decide la compra, horarios…"
              />
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-danger/30 bg-danger-bg p-3 text-sm text-[#b42318]">
            {error}
          </div>
        )}

        <button type="submit" disabled={isPending} className="btn btn-primary btn-block-mobile">
          {isPending ? "Guardando…" : "Crear prospecto"}
        </button>
      </form>
    </div>
  );
}
