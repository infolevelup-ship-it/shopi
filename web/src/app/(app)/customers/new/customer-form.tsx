"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  checkDuplicateCustomer,
  createCustomerAction,
  type CreateCustomerInput,
  type DuplicateCheckResult,
} from "@/lib/actions/customers";
import { convertProspectAction } from "@/lib/actions/prospects";
import type { DaneLocation } from "@/lib/actions/dane";
import {
  CHANNELS,
  CUSTOMER_CLASSIFICATIONS,
  DOCUMENT_TYPES,
  FISCAL_RESPONSIBILITIES,
  PERSON_TYPES,
  PURCHASE_TYPES,
  VAT_REGIMES,
  nitCheckDigit,
} from "@/lib/ui/fiscal";
import { SCard, SSelect, SText } from "@/components/siigo-fields";

type FormState = {
  customerType: "natural" | "juridica";
  documentType: string;
  documentNumber: string;
  checkDigit: string;
  checkDigitManual: boolean;
  legalName: string;
  firstName: string;
  lastName: string;
  commercialName: string;
  branchCode: string;
  department: string;
  cityCode: string;
  address: string;
  postalCode: string;
  phoneIndicative: string;
  phone: string;
  phoneExtension: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  contactIndicative: string;
  contactPhone: string;
  email: string;
  birthday: string;
  websiteSocial: string;
  vatResponsible: string;
  fiscalResponsibilities: string[];
  purchaseType: string;
  customerTypeClassification: string;
  channel: string;
  creditLimit: string;
};

const initialState: FormState = {
  customerType: "juridica",
  documentType: "NIT",
  documentNumber: "",
  checkDigit: "",
  checkDigitManual: false,
  legalName: "",
  firstName: "",
  lastName: "",
  commercialName: "",
  branchCode: "",
  department: "",
  cityCode: "",
  address: "",
  postalCode: "",
  phoneIndicative: "601",
  phone: "",
  phoneExtension: "",
  contactFirstName: "",
  contactLastName: "",
  contactEmail: "",
  contactIndicative: "",
  contactPhone: "",
  email: "",
  birthday: "",
  websiteSocial: "",
  vatResponsible: "false",
  // Siigo pide como mínimo R-99-PN y la trae marcada por defecto.
  fiscalResponsibilities: ["R-99-PN"],
  purchaseType: "contado",
  customerTypeClassification: "",
  channel: "B2B",
  creditLimit: "",
};

export type ProspectPrefill = {
  id: string;
  name: string;
  commercialName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
};

export function NewCustomerForm({
  locations,
  fromProspect = null,
}: {
  locations: DaneLocation[];
  fromProspect?: ProspectPrefill | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => {
    if (!fromProspect) return initialState;
    // La ciudad del prospecto es texto libre: si coincide con una del catálogo
    // DANE se preselecciona con sus códigos; si no, se deja vacía para que la
    // vendedora la elija, en vez de guardar una ciudad sin código con la que
    // luego no se puede facturar.
    const match = fromProspect.city
      ? locations.find(
          (l) => l.city_name.toLowerCase() === fromProspect.city!.trim().toLowerCase(),
        )
      : undefined;
    return {
      ...initialState,
      commercialName: fromProspect.commercialName ?? fromProspect.name,
      phone: fromProspect.phone ?? "",
      email: fromProspect.email ?? "",
      department: match?.department ?? "",
      cityCode: match?.city_code ?? "",
    };
  });
  const [error, setError] = useState<string | null>(null);
  const [existingCustomerId, setExistingCustomerId] = useState<string | null>(null);
  const [phoneWarning, setPhoneWarning] = useState<DuplicateCheckResult["phoneMatches"]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const departments = useMemo(
    () => [...new Set(locations.map((l) => l.department))].sort((a, b) => a.localeCompare(b, "es")),
    [locations],
  );
  const cities = useMemo(
    () => locations.filter((l) => l.department === form.department),
    [locations, form.department],
  );
  const selectedCity = locations.find((l) => l.city_code === form.cityCode) ?? null;

  const isNit = form.documentType === "NIT";
  const isCompany = form.customerType === "juridica";
  // Se calcula solo y se puede corregir a mano: hay NIT en circulación con el
  // DV mal impreso, y Siigo rechaza la factura si no coincide con el suyo.
  const autoCheckDigit = isNit ? nitCheckDigit(form.documentNumber) : null;
  const effectiveCheckDigit = form.checkDigitManual ? form.checkDigit : (autoCheckDigit ?? "");

  // Solo se marcan en rojo después del primer intento de guardar: señalar en
  // rojo un campo que la vendedora todavía no ha tocado es ruido.
  const missing = (v: string) => (submitted && !v.trim() ? "*Campo obligatorio" : null);

  function toggleResponsibility(code: string) {
    setForm((f) => ({
      ...f,
      fiscalResponsibilities: f.fiscalResponsibilities.includes(code)
        ? f.fiscalResponsibilities.filter((c) => c !== code)
        : [...f.fiscalResponsibilities, code],
    }));
  }

  function toInput(): CreateCustomerInput {
    return {
      customerType: form.customerType,
      documentType: form.documentType,
      documentNumber: form.documentNumber,
      legalName: isCompany ? form.legalName : undefined,
      firstName: !isCompany ? form.firstName : undefined,
      lastName: !isCompany ? form.lastName : undefined,
      commercialName: form.commercialName || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      address: form.address || undefined,
      city: selectedCity?.city_name,
      checkDigit: isNit ? effectiveCheckDigit || undefined : undefined,
      branchCode: form.branchCode || undefined,
      department: selectedCity?.department,
      stateCode: selectedCity?.state_code,
      cityCode: selectedCity?.city_code,
      postalCode: form.postalCode || undefined,
      fiscalResponsibilities: form.fiscalResponsibilities,
      vatResponsible: form.vatResponsible === "true",
      phoneIndicative: form.phoneIndicative || undefined,
      phoneExtension: form.phoneExtension || undefined,
      contactFirstName: form.contactFirstName || undefined,
      contactLastName: form.contactLastName || undefined,
      contactEmail: form.contactEmail || undefined,
      contactIndicative: form.contactIndicative || undefined,
      contactPhone: form.contactPhone || undefined,
      purchaseType: form.purchaseType || undefined,
      customerTypeClassification: form.customerTypeClassification || undefined,
      channel: form.channel || undefined,
      creditLimit: form.creditLimit ? Number(form.creditLimit) : undefined,
      websiteSocial: form.websiteSocial || undefined,
      birthday: form.birthday || undefined,
    };
  }

  async function doCreate() {
    const result = await createCustomerAction(toInput());
    if (!result.ok) {
      setError(result.error);
      setExistingCustomerId(result.existingCustomerId ?? null);
      return;
    }

    if (fromProspect) {
      // El cliente ya existe pase lo que pase aquí; si el enlace falla se avisa
      // en vez de perder al cliente recién creado.
      const linked = await convertProspectAction(fromProspect.id, result.customerId);
      if (!linked.ok) {
        setError(`El cliente se creó, pero no se pudo cerrar el prospecto: ${linked.error}`);
        return;
      }
    }

    router.push(`/customers/${result.customerId}`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setError(null);
    setExistingCustomerId(null);
    setPhoneWarning([]);

    if (!form.documentNumber.trim()) return;
    if (isCompany ? !form.legalName.trim() : !form.firstName.trim() || !form.lastName.trim()) return;

    startTransition(async () => {
      try {
        const dup = await checkDuplicateCustomer(form.documentType, form.documentNumber, form.phone);

        if (dup.exactMatch) {
          setError(`Ya existe un cliente con este documento: ${dup.exactMatch.display_name}.`);
          setExistingCustomerId(dup.exactMatch.id);
          return;
        }
        if (dup.phoneMatches.length > 0) {
          setPhoneWarning(dup.phoneMatches); // doc 01 §7: avisar, no bloquear
          return;
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
    <form onSubmit={handleSubmit} className="grid gap-5">
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        {/* ======================================================== izquierda */}
        <SCard title="Datos básicos" required>
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            <SSelect
              id="person-type"
              label="Tipo"
              value={form.customerType}
              onChange={(v) => update("customerType", v as "natural" | "juridica")}
              options={PERSON_TYPES}
            />
            <SSelect
              id="doc-type"
              label="Tipo de identificación"
              value={form.documentType}
              onChange={(v) => update("documentType", v)}
              options={DOCUMENT_TYPES}
            />

            {/* Siigo pone el Dv al lado de la identificación siempre, no solo
                para NIT; se calcula solo cuando es NIT. */}
            <div className="grid grid-cols-[1fr_4.5rem] gap-4">
              <SText
                id="doc-number"
                label="Identificación"
                required
                inputMode="numeric"
                value={form.documentNumber}
                onChange={(v) => update("documentNumber", v)}
                error={missing(form.documentNumber)}
              />
              <SText
                id="check-digit"
                label="Dv"
                inputMode="numeric"
                maxLength={1}
                value={effectiveCheckDigit}
                onChange={(v) => {
                  update("checkDigit", v.replace(/\D/g, ""));
                  update("checkDigitManual", true);
                }}
              />
            </div>

            {isCompany ? (
              <SText
                id="legal-name"
                label="Razón social"
                required
                value={form.legalName}
                onChange={(v) => update("legalName", v)}
                error={missing(form.legalName)}
              />
            ) : (
              <SText
                id="first-name"
                label="Nombres"
                required
                value={form.firstName}
                onChange={(v) => update("firstName", v)}
                error={missing(form.firstName)}
              />
            )}

            {!isCompany && (
              <>
                <SText
                  id="last-name"
                  label="Apellidos"
                  required
                  value={form.lastName}
                  onChange={(v) => update("lastName", v)}
                  error={missing(form.lastName)}
                />
                {/* Deja la fila completa para que lo que sigue no se desalinee. */}
                <span className="hidden sm:block" />
              </>
            )}

            {/* Siigo tiene una sola "Ciudad"; aquí son dos selectores porque
                Siigo factura con los códigos DANE, no con el texto. */}
            <SSelect
              id="department"
              label="Departamento"
              value={form.department}
              onChange={(v) => {
                update("department", v);
                update("cityCode", ""); // la ciudad anterior ya no pertenece aquí
              }}
              options={departments.map((d) => ({ value: d, label: d }))}
              placeholder="Selecciona…"
            />
            <SSelect
              id="city"
              label="Ciudad"
              value={form.cityCode}
              onChange={(v) => update("cityCode", v)}
              options={cities.map((c) => ({ value: c.city_code, label: c.city_name }))}
              placeholder={form.department ? "Selecciona…" : "Elige departamento"}
              disabled={!form.department}
            />

            <SText
              id="address"
              label="Dirección"
              value={form.address}
              onChange={(v) => update("address", v)}
            />
            <SText
              id="postal-code"
              label="Código postal"
              inputMode="numeric"
              value={form.postalCode}
              onChange={(v) => update("postalCode", v)}
            />

            <SText
              id="commercial-name"
              label="Nombre comercial"
              value={form.commercialName}
              onChange={(v) => update("commercialName", v)}
            />
            <SText
              id="branch-code"
              label="Código de sucursal"
              value={form.branchCode}
              onChange={(v) => update("branchCode", v)}
            />

            {/* En Siigo van los tres en una fila. A 390px no caben sin que la
                etiqueta "# de Teléfono" se parta, así que la extensión baja a
                su propia línea y desde `sm` vuelve a la fila de tres. */}
            <div className="grid grid-cols-[5rem_1fr] gap-4 sm:col-span-2 sm:grid-cols-[6rem_1fr_1fr]">
              <SText
                id="phone-indicative"
                label="Indicativo"
                inputMode="numeric"
                value={form.phoneIndicative}
                onChange={(v) => update("phoneIndicative", v)}
              />
              <SText
                id="phone"
                label="# de Teléfono"
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(v) => update("phone", v)}
              />
              <SText
                id="phone-extension"
                label="Extensión"
                inputMode="numeric"
                value={form.phoneExtension}
                onChange={(v) => update("phoneExtension", v)}
                className="col-span-2 sm:col-span-1"
              />
            </div>
          </div>

          {selectedCity && (
            <p className="s-note mt-4 border-t border-line pt-3">
              Códigos DANE que se enviarán a Siigo: departamento {selectedCity.state_code} · ciudad{" "}
              {selectedCity.city_code}
            </p>
          )}
        </SCard>

        {/* ========================================================== derecha */}
        <SCard title="Datos para facturación y envío">
          <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
            <div className="grid gap-y-1">
              <SText
                id="contact-first"
                label="Nombres del contacto"
                value={form.contactFirstName}
                onChange={(v) => update("contactFirstName", v)}
              />
              <SText
                id="contact-last"
                label="Apellidos del contacto"
                value={form.contactLastName}
                onChange={(v) => update("contactLastName", v)}
              />
              <SText
                id="contact-email"
                label="Correo electrónico cuando aplique"
                type="email"
                inputMode="email"
                value={form.contactEmail}
                onChange={(v) => update("contactEmail", v)}
              />
              <SSelect
                id="vat-regime"
                label="Tipo de régimen IVA"
                value={form.vatResponsible}
                onChange={(v) => update("vatResponsible", v)}
                options={VAT_REGIMES}
              />
              <div className="grid grid-cols-[6rem_1fr] gap-4">
                <SText
                  id="contact-indicative"
                  label="Indicativo"
                  inputMode="numeric"
                  value={form.contactIndicative}
                  onChange={(v) => update("contactIndicative", v)}
                />
                <SText
                  id="contact-phone"
                  label="# de Teléfono"
                  type="tel"
                  inputMode="tel"
                  value={form.contactPhone}
                  onChange={(v) => update("contactPhone", v)}
                />
              </div>

              {/* Nuestros, no están en Siigo pero se capturan aquí porque son
                  de la misma naturaleza: a dónde llega la factura y cómo
                  contactar al salón. */}
              <SText
                id="email"
                label="Correo de facturación electrónica"
                type="email"
                inputMode="email"
                value={form.email}
                onChange={(v) => update("email", v)}
              />
              <SText
                id="website"
                label="Página web o red social"
                value={form.websiteSocial}
                onChange={(v) => update("websiteSocial", v)}
              />
              <SText
                id="birthday"
                label="Cumpleaños"
                type="date"
                value={form.birthday}
                onChange={(v) => update("birthday", v)}
              />
            </div>

            <fieldset className="sm:w-64 sm:border-l sm:border-line sm:pl-6">
              <legend className="s-legend">Responsabilidad fiscal</legend>
              <p className="s-note mb-3">
                Verifica la responsabilidad en el RUT de tu cliente, mínimo asignar R-99-PN
              </p>
              {FISCAL_RESPONSIBILITIES.map((f) => (
                <label key={f.value} className="s-check">
                  <input
                    type="checkbox"
                    checked={form.fiscalResponsibilities.includes(f.value)}
                    onChange={() => toggleResponsibility(f.value)}
                  />
                  <span>
                    <span className="font-medium">{f.value}</span>{" "}
                    <span className="text-text-soft">{f.label}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </div>
        </SCard>
      </div>

      {/* ================================================ nuestro, no en Siigo */}
      <SCard title="Clasificación comercial">
        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
          <SSelect
            id="channel"
            label="Canal"
            value={form.channel}
            onChange={(v) => update("channel", v)}
            options={CHANNELS}
          />
          <SSelect
            id="classification"
            label="Tipo de negocio"
            value={form.customerTypeClassification}
            onChange={(v) => update("customerTypeClassification", v)}
            options={CUSTOMER_CLASSIFICATIONS}
            placeholder="Sin clasificar"
          />
          <SSelect
            id="purchase-type"
            label="Tipo de compra habitual"
            value={form.purchaseType}
            onChange={(v) => update("purchaseType", v)}
            options={PURCHASE_TYPES}
          />
          {form.purchaseType === "credito" && (
            <SText
              id="credit-limit"
              label="Cupo de crédito"
              inputMode="numeric"
              value={form.creditLimit}
              onChange={(v) => update("creditLimit", v.replace(/\D/g, ""))}
            />
          )}
        </div>
      </SCard>

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

      {/* doc 11 §29: posible duplicado — se muestra a quién se parece y se deja
          decidir, nunca se bloquea en silencio */}
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

      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="submit" disabled={isPending} className="btn btn-primary btn-block-mobile">
          {isPending
            ? "Verificando…"
            : fromProspect
              ? "Crear cliente y cerrar prospecto"
              : "Crear cliente"}
        </button>
      </div>
    </form>
  );
}
