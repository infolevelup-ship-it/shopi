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
import type { DaneLocation } from "@/lib/actions/dane";
import { convertProspectAction } from "@/lib/actions/prospects";
import {
  CHANNELS,
  CUSTOMER_CLASSIFICATIONS,
  DOCUMENT_TYPES,
  FISCAL_RESPONSIBILITIES,
  PURCHASE_TYPES,
  nitCheckDigit,
} from "@/lib/ui/fiscal";

type FormState = {
  customerType: "natural" | "juridica";
  documentType: string;
  documentNumber: string;
  checkDigit: string;
  checkDigitManual: boolean;
  branchCode: string;
  legalName: string;
  firstName: string;
  lastName: string;
  commercialName: string;
  department: string;
  cityCode: string;
  address: string;
  postalCode: string;
  phoneIndicative: string;
  phone: string;
  email: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  contactPhone: string;
  birthday: string;
  fiscalResponsibility: string;
  vatResponsible: boolean;
  purchaseType: string;
  customerTypeClassification: string;
  channel: string;
  creditLimit: string;
  websiteSocial: string;
};

const initialState: FormState = {
  customerType: "juridica",
  documentType: "NIT",
  documentNumber: "",
  checkDigit: "",
  checkDigitManual: false,
  branchCode: "",
  legalName: "",
  firstName: "",
  lastName: "",
  commercialName: "",
  department: "",
  cityCode: "",
  address: "",
  postalCode: "",
  phoneIndicative: "",
  phone: "",
  email: "",
  contactFirstName: "",
  contactLastName: "",
  contactEmail: "",
  contactPhone: "",
  birthday: "",
  fiscalResponsibility: "R-99-PN",
  vatResponsible: false,
  purchaseType: "contado",
  customerTypeClassification: "",
  channel: "B2B",
  creditLimit: "",
  websiteSocial: "",
};

function Fieldset({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card card-pad">
      <h2 className="text-base font-semibold">{title}</h2>
      {hint && <p className="mt-0.5 mb-3 text-xs text-text-muted">{hint}</p>}
      <div className={hint ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

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
      // Un salón suele ser persona natural hasta que dice lo contrario, pero
      // el nombre del prospecto no distingue: se deja el tipo por defecto y
      // solo se traslada el nombre comercial, que sí aplica a ambos casos.
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
  // Punto 4 de la revisión: el DV se calcula solo, pero se puede corregir a
  // mano si el NIT del cliente trae uno distinto.
  const autoCheckDigit = isNit ? nitCheckDigit(form.documentNumber) : null;
  const effectiveCheckDigit = form.checkDigitManual ? form.checkDigit : (autoCheckDigit ?? "");

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
      city: selectedCity?.city_name,
      checkDigit: isNit ? effectiveCheckDigit || undefined : undefined,
      branchCode: form.branchCode || undefined,
      department: selectedCity?.department,
      stateCode: selectedCity?.state_code,
      cityCode: selectedCity?.city_code,
      postalCode: form.postalCode || undefined,
      fiscalResponsibility: form.fiscalResponsibility || undefined,
      vatResponsible: form.vatResponsible,
      phoneIndicative: form.phoneIndicative || undefined,
      contactFirstName: form.contactFirstName || undefined,
      contactLastName: form.contactLastName || undefined,
      contactEmail: form.contactEmail || undefined,
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
      // El cliente ya existe pase lo que pase aquí; si el enlace falla se
      // avisa en vez de perder al cliente recién creado, y el prospecto se
      // puede cerrar a mano.
      const linked = await convertProspectAction(fromProspect.id, result.customerId);
      if (!linked.ok) {
        setError(
          `El cliente se creó, pero no se pudo cerrar el prospecto: ${linked.error}`,
        );
        return;
      }
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
    <form onSubmit={handleSubmit} className="grid gap-5">
      {/* ------------------------------------------------- 1. identificación */}
      <Fieldset
        title="Identificación"
        hint="Estos datos van tal cual a la factura electrónica. Si están mal, la DIAN la rechaza."
      >
        {/* doc 11 §27: el tipo de cliente es lo primero — decide qué campos siguen */}
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
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className={isNit ? "grid grid-cols-[1fr_5rem] gap-2" : ""}>
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
            {isNit && (
              <div>
                <label htmlFor="check-digit" className="field-label">
                  DV
                </label>
                <input
                  id="check-digit"
                  inputMode="numeric"
                  maxLength={1}
                  value={effectiveCheckDigit}
                  onChange={(e) => {
                    update("checkDigit", e.target.value.replace(/\D/g, ""));
                    update("checkDigitManual", true);
                  }}
                  className="input text-center"
                />
              </div>
            )}
          </div>

          {isNit && (
            <p className="text-xs text-text-muted sm:col-span-2">
              El dígito de verificación se calcula solo.{" "}
              {form.checkDigitManual ? (
                <button
                  type="button"
                  onClick={() => {
                    update("checkDigitManual", false);
                    update("checkDigit", "");
                  }}
                  className="underline"
                >
                  Volver al calculado ({autoCheckDigit ?? "—"})
                </button>
              ) : (
                "Si el NIT del cliente trae otro, escríbelo encima."
              )}
            </p>
          )}

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

          <div>
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
          <div>
            <label htmlFor="branch-code" className="field-label">
              Código de sucursal (opcional)
            </label>
            <input
              id="branch-code"
              value={form.branchCode}
              onChange={(e) => update("branchCode", e.target.value)}
              className="input"
            />
          </div>
        </div>
      </Fieldset>

      {/* ------------------------------------------------------ 2. ubicación */}
      <Fieldset
        title="Ubicación"
        hint="Siigo factura con los códigos DANE del departamento y la ciudad, no con el texto libre."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="department" className="field-label">
              Departamento
            </label>
            <select
              id="department"
              value={form.department}
              onChange={(e) => {
                update("department", e.target.value);
                update("cityCode", ""); // la ciudad anterior ya no pertenece a este departamento
              }}
              className="select"
            >
              <option value="">Selecciona…</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="city" className="field-label">
              Ciudad
            </label>
            <select
              id="city"
              value={form.cityCode}
              onChange={(e) => update("cityCode", e.target.value)}
              disabled={!form.department}
              className="select"
            >
              <option value="">{form.department ? "Selecciona…" : "Elige departamento"}</option>
              {cities.map((c) => (
                <option key={c.city_code} value={c.city_code}>
                  {c.city_name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="address" className="field-label">
              Dirección
            </label>
            <input
              id="address"
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              className="input"
              placeholder="Calle 123 # 45-67, Local 2"
            />
          </div>
          <div>
            <label htmlFor="postal-code" className="field-label">
              Código postal (opcional)
            </label>
            <input
              id="postal-code"
              inputMode="numeric"
              value={form.postalCode}
              onChange={(e) => update("postalCode", e.target.value)}
              className="input"
            />
          </div>
          {selectedCity && (
            <p className="self-end text-xs text-text-muted">
              Códigos DANE: departamento {selectedCity.state_code} · ciudad {selectedCity.city_code}
            </p>
          )}
        </div>
      </Fieldset>

      {/* ------------------------------------------------------- 3. contacto */}
      <Fieldset title="Contacto">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid grid-cols-[5.5rem_1fr] gap-2">
            <div>
              <label htmlFor="phone-indicative" className="field-label">
                Indicativo
              </label>
              <input
                id="phone-indicative"
                inputMode="numeric"
                value={form.phoneIndicative}
                onChange={(e) => update("phoneIndicative", e.target.value)}
                className="input"
                placeholder="601"
              />
            </div>
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
          </div>
          <div>
            <label htmlFor="email" className="field-label">
              Correo de facturación electrónica
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
        </div>

        <p className="mt-4 mb-2 text-xs font-medium text-text-soft">
          Persona de contacto del salón (opcional)
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="contact-first" className="field-label">
              Nombres
            </label>
            <input
              id="contact-first"
              value={form.contactFirstName}
              onChange={(e) => update("contactFirstName", e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="contact-last" className="field-label">
              Apellidos
            </label>
            <input
              id="contact-last"
              value={form.contactLastName}
              onChange={(e) => update("contactLastName", e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="contact-phone" className="field-label">
              Teléfono
            </label>
            <input
              id="contact-phone"
              type="tel"
              inputMode="tel"
              value={form.contactPhone}
              onChange={(e) => update("contactPhone", e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="contact-email" className="field-label">
              Correo
            </label>
            <input
              id="contact-email"
              type="email"
              inputMode="email"
              value={form.contactEmail}
              onChange={(e) => update("contactEmail", e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="birthday" className="field-label">
              Cumpleaños
            </label>
            <input
              id="birthday"
              type="date"
              value={form.birthday}
              onChange={(e) => update("birthday", e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="website" className="field-label">
              Página web o red social
            </label>
            <input
              id="website"
              value={form.websiteSocial}
              onChange={(e) => update("websiteSocial", e.target.value)}
              className="input"
              placeholder="@salonluna"
            />
          </div>
        </div>
      </Fieldset>

      {/* --------------------------------------- 4. clasificación fiscal */}
      <Fieldset
        title="Clasificación fiscal y comercial"
        hint="La responsabilidad fiscal la exige Siigo; el resto es para reportes y seguimiento."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="fiscal-resp" className="field-label">
              Responsabilidad fiscal
            </label>
            <select
              id="fiscal-resp"
              value={form.fiscalResponsibility}
              onChange={(e) => update("fiscalResponsibility", e.target.value)}
              className="select"
            >
              {FISCAL_RESPONSIBILITIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex min-h-[44px] items-center gap-2 self-end text-sm">
            <input
              type="checkbox"
              checked={form.vatResponsible}
              onChange={(e) => update("vatResponsible", e.target.checked)}
              className="h-4 w-4"
            />
            Responsable de IVA
          </label>

          <div>
            <label htmlFor="channel" className="field-label">
              Canal
            </label>
            <select
              id="channel"
              value={form.channel}
              onChange={(e) => update("channel", e.target.value)}
              className="select"
            >
              {CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="classification" className="field-label">
              Tipo de negocio
            </label>
            <select
              id="classification"
              value={form.customerTypeClassification}
              onChange={(e) => update("customerTypeClassification", e.target.value)}
              className="select"
            >
              <option value="">Sin clasificar</option>
              {CUSTOMER_CLASSIFICATIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="purchase-type" className="field-label">
              Tipo de compra habitual
            </label>
            <select
              id="purchase-type"
              value={form.purchaseType}
              onChange={(e) => update("purchaseType", e.target.value)}
              className="select"
            >
              {PURCHASE_TYPES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          {form.purchaseType === "credito" && (
            <div>
              <label htmlFor="credit-limit" className="field-label">
                Cupo de crédito
              </label>
              <input
                id="credit-limit"
                type="number"
                inputMode="numeric"
                min="0"
                step="1000"
                value={form.creditLimit}
                onChange={(e) => update("creditLimit", e.target.value)}
                className="input"
              />
            </div>
          )}
        </div>
      </Fieldset>

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
        {isPending ? "Verificando…" : fromProspect ? "Crear cliente y cerrar prospecto" : "Crear cliente"}
      </button>
    </form>
  );
}
