import Link from "next/link";

// Paginador de listas largas. Se navega con enlaces y no con estado de
// cliente a propósito: así la página N es una URL que se puede compartir,
// recargar y abrir en otra pestaña, y funciona sin JavaScript.
export function Pager({
  page,
  totalPages,
  total,
  basePath,
  params,
  labelSingular,
  labelPlural,
}: {
  page: number;
  totalPages: number;
  total: number;
  basePath: string;
  /** Lo que hay que conservar al cambiar de página (la búsqueda, un filtro…). */
  params?: Record<string, string | undefined>;
  labelSingular: string;
  labelPlural: string;
}) {
  if (totalPages <= 1) return null;

  const href = (n: number) => {
    const search = new URLSearchParams();
    for (const [clave, valor] of Object.entries(params ?? {})) {
      if (valor) search.set(clave, valor);
    }
    // La página 1 no lleva parámetro: la URL "limpia" y la "?p=1" son la misma
    // lista, y dos direcciones para lo mismo confunden al compartirlas.
    if (n > 1) search.set("p", String(n));
    const cadena = search.toString();
    return cadena ? `${basePath}?${cadena}` : basePath;
  };

  return (
    <nav
      className="mt-4 flex flex-wrap items-center justify-between gap-3"
      aria-label="Paginación"
    >
      <p className="text-sm text-text-soft">
        Página {page} de {totalPages} · {total} {total === 1 ? labelSingular : labelPlural}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className="btn btn-secondary" rel="prev">
            ← Anterior
          </Link>
        ) : (
          // Deshabilitado y no oculto: si el botón desapareciera, el de
          // "Siguiente" saltaría de sitio en cada página.
          <span className="btn btn-secondary opacity-40" aria-disabled="true">
            ← Anterior
          </span>
        )}
        {page < totalPages ? (
          <Link href={href(page + 1)} className="btn btn-secondary" rel="next">
            Siguiente →
          </Link>
        ) : (
          <span className="btn btn-secondary opacity-40" aria-disabled="true">
            Siguiente →
          </span>
        )}
      </div>
    </nav>
  );
}
