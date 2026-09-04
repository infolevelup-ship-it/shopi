"use client";

import Link from "next/link";

// doc 11 §41: imprimir es una acción aparte y sin efecto fiscal. La barra vive
// solo en pantalla — al imprimir desaparece, para que la hoja salga con el
// documento y nada más.
export function PrintToolbar({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <div className="print-hide mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <Link href={backHref} className="text-sm text-text-soft hover:text-text">
        ← {backLabel}
      </Link>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={() => window.print()} className="btn btn-primary">
          Imprimir
        </button>
      </div>
    </div>
  );
}

// El PDF sale del propio diálogo de impresión ("Guardar como PDF"), que existe
// en todos los navegadores de escritorio y móviles. Se dice explícitamente
// porque no es obvio que el botón de imprimir también sirva para guardar.
export function PrintHint() {
  return (
    <p className="print-hide mt-4 text-center text-xs text-text-muted">
      Para guardarlo como PDF, elige “Guardar como PDF” en el destino del diálogo de impresión.
    </p>
  );
}
