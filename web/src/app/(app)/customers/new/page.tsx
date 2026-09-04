"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  checkDuplicateCustomer,
  createCustomerAction,
  type CreateCustomerInput,
  type DuplicateCheckResult,
} from "@/lib/actions/customers";
import { PageHeader } from "@/components/ui";

const DOCUMENT_TYPES = ["NIT", "CC", "CE", "PAS", "TI"];

type FormState = {
  customerType: "natural" | "juridica";
  documentType: string;
  documentNumber: string;
  legalName: string;
  firstName: string;
  lastName: string;
  commercialName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
};

const initialState: FormState = {
  customerType: "juridica",
  documentType: "NIT",
  documentNumber: "",
  legalName: "",
  firstName: "",
  lastName: "",
  commercialName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
};

export default function NewCustomerPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [existingCustomerId, setExistingCustomerId] = useState<string | null>(null);
  const [phoneWarning, setPhoneWarning] = useState<DuplicateCheckResult["phoneMatches"]>([]);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toInput(): CreateCustomerInput {
    return {
      customerType: form.customerType,
      documentType: form.documentType,
      documentNumber: form.documentNumber,
      legalName: form.customerType === "juridica" ? form.legalName : undefined,
      firstName: form.customerType === "natural" ? form.firstName : undefined,
      lastName: form.customerType === "natural" ? form.lastName : undefined,
      commercialName: form.commercialName || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      address: form.address || undefined,
      city: form.city || undefined,
    };
  }

  async function doCreate() {
    const result = await createCustomerAction(toInput());
    if (!result.ok) {
      setError(result.error);
      setExistingCustomerId(result.existingCustomerId ?? null);
      return;
    }
    router.push(`/customers/${result.customerId}`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setExistingCustomerId(null);
    setPhoneWarning([]);

    startTransition(async () => {
      try {
        const dup = await checkDuplicateCustomer(form.documentType, form.documentNumber, form.phone);

        if (dup.exactMatch) {
          setError(`Ya existe un cliente con este documento: ${dup.exactMatch.display_name}.`);
          setExistingCustomerId(dup.exactMatch.id);
          return;
        }

        if (dup.phoneMatches.length > 0) {
          setPhoneWarning(dup.phoneMatches);
          return; // esperar confirmación explícita, doc 01 §7: avisar, no bloquear
        }

        await doCreate();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error creando el cliente");
      }
    });
  }

  function handleConfirmDespitePhoneMatch() {
    setError(null);
    startTransition(async () => {
      try {
        await doCreate();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error creando el cliente");
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={{ href: "/customers", label: "Clientes" }} title="Nuevo cliente" />

      <form onSubmit={handleSubmit} className="grid gap-5">
        <section className="card card-pad">
          {/* doc 11 §27: el tipo de cliente es lo primero — decide qué campos
              siguen (razón social vs. nombres) */}
          <fieldset>
            <legend className="field-label">Tipo de cliente</legend>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
              <label className="flex min-h-[44px] items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="customerType"
                  checked={form.customerType === "juridica"}
                  onChange={() => update("customerType", "juridica")}
                  className="h-4 w-4"
                />
                Empresa (persona jurídica)
              </label>
              <label className="flex min-h-[44px] items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="customerType"
                  checked={form.customerType === "natural"}
                  onChange={() => update("customerType", "natural")}
                  className="h-4 w-4"
                />
                Persona natural
              </label>
            </div>
          </fieldset>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="doc-type" className="field-label">
                Tipo de identificación
              </label>
              <select
                id="doc-type"
                value={form.documentType}
                onChange={(e) => update("documentType", e.target.value)}
                className="select"
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="doc-number" className="field-label">
                Número de identificación
              </label>
              <input
                id="doc-number"
                required
                inputMode="numeric"
                value={form.documentNumber}
                onChange={(e) => update("documentNumber", e.target.value)}
                className="input"
              />
            </div>

            {form.customerType === "juridica" ? (
              <div className="sm:col-span-2">
                <label htmlFor="legal-name" className="field-label">
                  Razón social
                </label>
                <input
                  id="legal-name"
                  required
                  value={form.legalName}
                  onChange={(e) => update("legalName", e.target.value)}
                  className="input"
                />
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="first-name" className="field-label">
                    Nombres
                  </label>
                  <input
                    id="first-name"
                    required
                    value={form.firstName}
                    onChange={(e) => update("firstName", e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="last-name" className="field-label">
                    Apellidos
                  </label>
                  <input
                    id="last-name"
                    required
                    value={form.lastName}
                    onChange={(e) => update("lastName", e.target.value)}
                    className="input"
                  />
                </div>
              </>
            )}

            <div className="sm:col-span-2">
              <label htmlFor="commercial-name" className="field-label">
                Nombre comercial (opcional)
              </label>
              <input
                id="commercial-name"
                value={form.commercialName}
                onChange={(e) => update("commercialName", e.target.value)}
                className="input"
                placeholder="Como lo conocen: “Salón Luna”"
              />
            </div>
          </div>
        </section>

        <section className="card card-pad">
          <h2 className="mb-3 text-base font-semibold">Contacto y ubicación</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="phone" className="field-label">
                Teléfono
              </label>
              {/* doc 11 §79: teclado contextual en móvil */}
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
              <label htmlFor="address" className="field-label">
                Dirección
              </label>
              <input
                id="address"
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                className="input"
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-text-muted">
            Ciudad y dirección son obligatorias para poder facturar en Siigo más adelante.
          </p>
        </section>

        {error && (
          <div className="rounded-xl border border-danger/30 bg-danger-bg p-3 text-sm text-[#b42318]">
            {error}
            {existingCustomerId && (
              <>
                {" "}
                <Link href={`/customers/${existingCustomerId}`} className="underline">
                  Ver cliente existente
                </Link>
              </>
            )}
          </div>
        )}

        {/* doc 11 §29: posible duplicado — se muestra a quién se parece y se
            deja decidir, nunca se bloquea en silencio */}
        {phoneWarning.length > 0 && (
          <div className="rounded-xl border border-warning/30 bg-warning-bg p-4 text-sm text-[#b54708]">
            <p className="font-semibold">⚠ Posible cliente existente</p>
            <p className="mt-1">Ya hay un cliente registrado con el mismo teléfono:</p>
            <ul className="mt-2 grid gap-1">
              {phoneWarning.map((m) => (
                <li key={m.id}>
                  <Link href={`/customers/${m.id}`} className="font-medium underline">
                    {m.display_name}
                  </Link>{" "}
                  ({m.phone})
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={handleConfirmDespitePhoneMatch}
              disabled={isPending}
              className="btn btn-secondary btn-sm btn-block-mobile mt-3"
            >
              No es el mismo, crear de todas formas
            </button>
          </div>
        )}

        <button type="submit" disabled={isPending} className="btn btn-primary btn-block-mobile">
          {isPending ? "Verificando…" : "Crear cliente"}
        </button>
      </form>
    </div>
  );
}
