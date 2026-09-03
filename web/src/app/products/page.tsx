import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { searchProducts } from "@/lib/actions/products";
import { ProductSearch } from "./product-search";

export default async function ProductsPage() {
  const [profile, initialResults] = await Promise.all([
    getCurrentProfile(),
    searchProducts(""),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-neutral-500 hover:underline">
            ← Inicio
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-neutral-900">Productos</h1>
        </div>
        {profile?.role === "ADMIN" && (
          <Link
            href="/products/new"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
          >
            + Nuevo producto
          </Link>
        )}
      </div>

      <ProductSearch initialResults={initialResults} />
    </main>
  );
}
