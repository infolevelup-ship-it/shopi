"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { QuoteForm } from "@/components/quote-form";

function NewQuote() {
  const searchParams = useSearchParams();
  return <QuoteForm mode="create" preselectedCustomerId={searchParams.get("cliente")} />;
}

// useSearchParams necesita un límite de Suspense para que Next pueda
// prerenderizar la parte estática de la página.
export default function NewQuotePage() {
  return (
    <Suspense fallback={<div className="skeleton h-64 w-full" />}>
      <NewQuote />
    </Suspense>
  );
}
