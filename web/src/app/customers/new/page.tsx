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
    <main className="mx-auto max-w-xl px-4 py-10">
      <Link href="/customers" className="text-sm text-neutral-500 hover:underline">
        ← Clientes
      </Link>
      <h1 className="mt-1 mb-6 text-lg font-semibold text-neutral-900">Nuevo cliente</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={form.customerType === "juridica"}
              onChange={() => update("customerType", "juridica")}
            />
            Empresa (persona jurídica)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={form.customerType === "natural"}
              onChange={() => update("customerType", "natural")}
            />
            Persona natural
          </label>
        </div>

        <div className="flex gap-2">
          <div className="w-28">
            <label className="text-sm font-medium text-neutral-700">Tipo doc.</label>
            <select
              value={form.documentType}
              onChange={(e) => update("documentType", e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-2 py-2 text-sm"
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium text-neutral-700">Número de documento</label>
            <input
              required
              value={form.documentNumber}
              onChange={(e) => update("documentNumber", e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {form.customerType === "juridica" ? (
          <div>
            <label className="text-sm font-medium text-neutral-700">Razón social</label>
            <input
              required
              value={form.legalName}
              onChange={(e) => update("legalName", e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        ) : (
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-sm font-medium text-neutral-700">Nombres</label>
              <input
                required
                value={form.firstName}
                onChange={(e) => update("firstName", e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-neutral-700">Apellidos</label>
              <input
                required
                value={form.lastName}
                onChange={(e) => update("lastName", e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-neutral-700">Nombre comercial (opcional)</label>
          <input
            value={form.commercialName}
            onChange={(e) => update("commercialName", e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-sm font-medium text-neutral-700">Teléfono</label>
            <input
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium text-neutral-700">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-sm font-medium text-neutral-700">Dirección</label>
            <input
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="w-40">
            <label className="text-sm font-medium text-neutral-700">Ciudad</label>
            <input
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
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

        {phoneWarning.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <p className="font-medium">
              Este cliente ya está siendo gestionado — encontramos otro cliente con el mismo
              teléfono:
            </p>
            <ul className="mt-1 list-disc pl-5">
              {phoneWarning.map((m) => (
                <li key={m.id}>
                  <Link href={`/customers/${m.id}`} className="underline">
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
              className="mt-2 rounded-md border border-amber-400 bg-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              Crear de todas formas
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? "Verificando..." : "Crear cliente"}
        </button>
      </form>
    </main>
  );
}
