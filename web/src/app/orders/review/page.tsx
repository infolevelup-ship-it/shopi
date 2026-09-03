import Link from "next/link";
import { searchReviewQueue } from "@/lib/actions/orders";
import { getCurrentProfile } from "@/lib/auth";
import { ReviewQueue } from "./queue";

export default async function OrderReviewQueuePage() {
  const [items, profile] = await Promise.all([searchReviewQueue(), getCurrentProfile()]);
  const canReview =
    !!profile && (profile.role === "WAREHOUSE" || profile.role === "SUPERVISOR" || profile.role === "ADMIN");

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← Inicio
      </Link>
      <h1 className="mt-1 text-lg font-semibold text-neutral-900">Cola de revisión — bodega</h1>

      {!canReview && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Esta pantalla es de bodega/supervisor/admin. Solo verás aquí lo que tus propios permisos
          dejen ver.
        </div>
      )}

      <ReviewQueue items={items} />
    </main>
  );
}
