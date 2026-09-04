import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { searchProducts } from "@/lib/actions/products";
import { formatMoney } from "@/lib/ui/format";
import { EmptyState, PageHeader, Tone_ } from "@/components/ui";
import { SearchForm } from "@/components/search-form";

// doc 11 §30: el catálogo se lee de un vistazo — nombre, SKU, precio y stock.
// El estado del stock se muestra con texto, nunca solo con color (doc 11 §35).
function StockCell({ stock }: { stock: number | null }) {
  if (stock === null) {
    // Honesto: sin sincronización con Siigo no hay inventario que mostrar.
    // Mejor decirlo que pintar un "0" que parecería agotado (doc 11 §39).
    return <span className="text-text-muted">sin datos</span>;
  }
  if (stock <= 0) return <Tone_ tone="danger">Agotado</Tone_>;
  if (stock <= 10) return <Tone_ tone="warning">Quedan {stock}</Tone_>;
  return <span className="text-text">{stock}</span>;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const [profile, products] = await Promise.all([getCurrentProfile(), searchProducts(q)]);

  return (
    <div>
      <PageHeader
        title="Productos"
        subtitle={q ? `Resultados para "${q}"` : `${products.length} productos en catálogo`}
        actions={
          profile?.role === "ADMIN" ? (
            <Link href="/products/new" className="btn btn-primary btn-block-mobile">
              + Nuevo producto
            </Link>
          ) : undefined
        }
      />

      <SearchForm
        action="/products"
        placeholder="Buscar por nombre, código o marca…"
        defaultValue={q}
      />

      {products.length === 0 ? (
        <EmptyState
          title={q ? "Sin resultados" : "Todavía no hay productos"}
          description={
            q
              ? "Prueba con el código (SKU) o parte del nombre."
              : "El catálogo se llenará al sincronizar con Siigo, o creando productos a mano."
          }
        />
      ) : (
        <>
          <div className="desktop-only card overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Marca</th>
                  <th className="text-right">Público</th>
                  <th className="text-right">Profesional</th>
                  <th className="text-right">Salón</th>
                  <th>Inventario</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="font-medium">{p.name}</span>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-text-soft">
                        <span>{p.code}</span>
                        {!p.active && <Tone_ tone="neutral">Inactivo</Tone_>}
                        {!p.siigo_product_id && <Tone_ tone="warning">Sin Siigo</Tone_>}
                      </div>
                    </td>
                    <td className="text-text-soft">{p.brand ?? "—"}</td>
                    <td className="text-right">{formatMoney(p.price_public)}</td>
                    <td className="text-right text-text-soft">
                      {p.price_professional ? formatMoney(p.price_professional) : "—"}
                    </td>
                    <td className="text-right text-text-soft">
                      {p.price_salon ? formatMoney(p.price_salon) : "—"}
                    </td>
                    <td>
                      <StockCell stock={p.stock_cache} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mobile-only grid gap-2">
            {products.map((p) => (
              <li key={p.id} className="card card-pad">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium text-text">{p.name}</span>
                  <span className="text-sm font-semibold whitespace-nowrap">
                    {formatMoney(p.price_public)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-text-soft">
                  {p.code}
                  {p.brand ? ` · ${p.brand}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <StockCell stock={p.stock_cache} />
                  {!p.active && <Tone_ tone="neutral">Inactivo</Tone_>}
                  {!p.siigo_product_id && <Tone_ tone="warning">Sin Siigo</Tone_>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
