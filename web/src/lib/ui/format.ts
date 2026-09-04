// Formato compartido. Antes cada pantalla traía su propia copia de
// formatMoney (14 copias) y algunas formateaban fechas de forma distinta —
// doc 11 §94: un mismo concepto se ve igual en toda la app.

export function formatMoney(value: number | string | null | undefined) {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return (Number.isFinite(n) ? n : 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

/** Solo el número, sin símbolo — para tablas densas donde la columna ya dice $. */
export function formatNumber(value: number | string | null | undefined) {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return (Number.isFinite(n) ? n : 0).toLocaleString("es-CO", {
    maximumFractionDigits: 2,
  });
}

// Las columnas `date` de Postgres llegan como "1990-05-14", y el motor de
// JavaScript las interpreta como medianoche UTC: en Colombia (UTC-5) eso se
// renderiza como el día anterior. Un cumpleaños o una fecha de vencimiento
// corrida un día es un error silencioso, así que las fechas sin hora se
// arman como fecha local.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = DATE_ONLY.test(iso)
    ? new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
    : new Date(iso);
  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "hace 3 min", "hace 2 h", "hace 4 días" — antigüedad en la cola de bodega. */
export function formatRelative(iso: string | null | undefined) {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days} ${days === 1 ? "día" : "días"}`;
  const months = Math.floor(days / 30);
  return `hace ${months} ${months === 1 ? "mes" : "meses"}`;
}

/** El nombre con el que se conoce a un cliente, con el mismo criterio en todas partes. */
export function customerDisplayName(c: {
  commercial_name?: string | null;
  legal_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  document_number?: string | null;
} | null): string {
  if (!c) return "—";
  return (
    c.commercial_name ??
    c.legal_name ??
    (`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.document_number || "—")
  );
}
