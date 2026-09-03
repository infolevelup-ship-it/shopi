import Link from "next/link";
import { searchOrders } from "@/lib/actions/orders";
import { OrderSearch } from "./order-search";

export default async function OrdersPage() {
  const initialResults = await searchOrders("");

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-neutral-500 hover:underline">
            ← Inicio
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-neutral-900">Pedidos</h1>
        </div>
        <Link
          href="/orders/new"
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
        >
          + Nuevo pedido
        </Link>
      </div>

      <OrderSearch initialResults={initialResults} />
    </main>
  );
}
