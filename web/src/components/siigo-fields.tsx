"use client";

import type { ReactNode } from "react";

// Campos con el aspecto de "Crear un tercero" de Siigo. La etiqueta va después
// del control en el HTML a propósito: el selector CSS que la hace flotar es de
// hermano posterior. `for`/`id` mantienen la asociación para lectores de
// pantalla, así que el orden visual no cambia la accesibilidad.

function labelNode(label: string, required?: boolean) {
  return (
    <>
      {required && <span className="s-required">*</span>}
      {label}
    </>
  );
}

export function SText({
  id,
  label,
  value,
  onChange,
  required,
  error,
  type = "text",
  inputMode,
  maxLength,
  className = "",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string | null;
  type?: string;
  inputMode?: "text" | "numeric" | "tel" | "email" | "decimal";
  maxLength?: number;
  className?: string;
}) {
  // Un input de fecha dibuja su formato (dd/mm/aaaa) aunque esté vacío, así que
  // `:placeholder-shown` no sirve para saber si tiene contenido.
  const alwaysFloated = type === "date";
  return (
    <div
      className={[
        "s-field",
        required ? "s-field--required" : "",
        error ? "s-field--error" : "",
        alwaysFloated ? "s-field--floated" : "",
        value ? "" : "s-field--empty",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // El espacio es necesario: `:placeholder-shown` es lo que distingue un
        // campo vacío de uno lleno para hacer flotar la etiqueta.
        placeholder=" "
      />
      <label htmlFor={id}>{labelNode(label, required)}</label>
      {error && <p className="s-error">{error}</p>}
    </div>
  );
}

export function SSelect({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  required,
  className = "",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={`s-field ${value ? "" : "s-field--empty"} ${className}`}>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <label htmlFor={id}>{labelNode(label, required)}</label>
    </div>
  );
}

export function SNumber({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step,
  className = "",
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: string;
  max?: string;
  step?: string;
  className?: string;
}) {
  return (
    <div className={`s-field s-field--filled ${className}`}>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        placeholder=" "
      />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

export function STextarea({
  id,
  label,
  value,
  onChange,
  rows = 3,
  className = "",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={`s-field ${className}`}>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder=" "
      />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

export function SCard({
  title,
  required,
  children,
  className = "",
}: {
  title: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`s-card ${className}`}>
      <h2 className="s-card-title">
        {required && <span className="s-required">*&nbsp;&nbsp;</span>}
        {title}
      </h2>
      {children}
    </section>
  );
}
