import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { NewProductForm } from "./product-form";

export default async function NewProductPage() {
  const profile = await getCurrentProfile();

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <Link href="/products" className="text-sm text-neutral-500 hover:underline">
        ← Productos
      </Link>
      <h1 className="mt-1 mb-6 text-lg font-semibold text-neutral-900">Nuevo producto</h1>

      {profile?.role !== "ADMIN" ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Solo un administrador puede crear productos (doc 05 §5) — el catálogo se sincroniza desde
          Siigo, esto es solo para pruebas mientras esa integración no existe.
        </div>
      ) : (
        <NewProductForm />
      )}
    </main>
  );
}
