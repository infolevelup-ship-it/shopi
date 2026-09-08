// Iconos de línea en SVG, dibujados aquí en vez de traer una librería: son
// nueve, y una dependencia entera para nueve trazos entra al bundle de todas
// las pantallas.
//
// Todos usan `currentColor` y `stroke`, así que heredan el color del enlace:
// el estado activo del menú no necesita una segunda versión de cada icono,
// como sí pasaba con los emoji, que además cada sistema operativo dibuja a su
// manera (y en Windows el de la fábrica salía en color).

export type IconName =
  | "inicio"
  | "clientes"
  | "prospectos"
  | "cotizaciones"
  | "pedidos"
  | "productos"
  | "bodega"
  | "reportes"
  | "configuracion";

const TRAZOS: Record<IconName, React.ReactNode> = {
  // casa
  inicio: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </>
  ),
  // dos personas
  clientes: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 20c0-3.4 2.8-5.6 6.2-5.6s6.2 2.2 6.2 5.6" />
      <path d="M16.5 5.5a3.2 3.2 0 0 1 0 6" />
      <path d="M18 14.8c2 .7 3.2 2.5 3.2 5.2" />
    </>
  ),
  // diana
  prospectos: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  // documento con líneas
  cotizaciones: (
    <>
      <path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5Z" />
      <path d="M13.5 3v5.5H19" />
      <path d="M9 13h6M9 16.5h4" />
    </>
  ),
  // carrito
  pedidos: (
    <>
      <path d="M2.5 3h2.2l2.3 11.2a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.3L20.5 7H6" />
      <circle cx="9.5" cy="19.5" r="1.4" />
      <circle cx="17" cy="19.5" r="1.4" />
    </>
  ),
  // caja
  productos: (
    <>
      <path d="M20.5 7.8v8.4a1.5 1.5 0 0 1-.8 1.3l-7 3.9a1.5 1.5 0 0 1-1.4 0l-7-3.9a1.5 1.5 0 0 1-.8-1.3V7.8" />
      <path d="M3.2 7.2 12 12l8.8-4.8L12 2.4Z" />
      <path d="M12 12v9.6" />
    </>
  ),
  // Estantería con cajas. La primera versión era una nave con techo a dos
  // aguas y a 18px se leía igual que la casa de "Inicio": dos destinos del
  // mismo menú no pueden compartir silueta.
  bodega: (
    <>
      <rect x="3" y="3.5" width="18" height="17" rx="1.5" />
      <path d="M3 9.2h18M3 14.8h18" />
      <path d="M7 3.5v5.7M14 9.2v5.6M9.5 14.8v5.7" />
    </>
  ),
  // barras
  reportes: (
    <>
      <path d="M3.5 21h17" />
      <path d="M6.5 21v-7" />
      <path d="M12 21V6" />
      <path d="M17.5 21v-10" />
    </>
  ),
  // engranaje simplificado
  configuracion: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.5 1.1Z" />
    </>
  ),
};

export function Icon({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      // aria-hidden porque el texto del enlace ya dice a dónde va: anunciarlo
      // dos veces solo alarga el recorrido con lector de pantalla.
      aria-hidden
      focusable="false"
      className={`h-[18px] w-[18px] shrink-0 ${className}`}
    >
      {TRAZOS[name]}
    </svg>
  );
}
