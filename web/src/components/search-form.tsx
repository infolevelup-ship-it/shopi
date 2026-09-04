"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Búsqueda que vive en la URL (?q=...) en vez de en estado del componente:
// el resultado se puede compartir, el botón "atrás" funciona, y la página
// puede seguir siendo un server component.
export function SearchForm({
  action,
  placeholder,
  defaultValue,
}: {
  action: string;
  placeholder: string;
  defaultValue?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        router.push(q ? `${action}?q=${encodeURIComponent(q)}` : action);
      }}
      className="mb-5 flex gap-2"
    >
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="input flex-1"
      />
      <button type="submit" className="btn btn-secondary">
        Buscar
      </button>
    </form>
  );
}
