import Link from "next/link";
import { searchQuotes } from "@/lib/actions/quotes";
import { QuoteSearch } from "./quote-search";

export default async function QuotesPage() {
  const initialResults = await searchQuotes("");

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-neutral-500 hover:underline">
            ← Inicio
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-neutral-900">Cotizaciones</h1>
        </div>
        <Link
          href="/quotes/new"
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
        >
          + Nueva cotización
        </Link>
      </div>

      <QuoteSearch initialResults={initialResults} />
    </main>
  );
}
