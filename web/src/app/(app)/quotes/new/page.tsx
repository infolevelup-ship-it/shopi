"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { QuoteForm } from "@/components/quote-form";
import { getCurrentUserRoleAction } from "@/lib/actions/customers";

function NewQuote() {
  const searchParams = useSearchParams();
  // Mismo motivo que orders/new/page.tsx: esta página es "use client" y
  // getCurrentProfile depende de las cookies de la petición.
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    getCurrentUserRoleAction().then(setRole);
  }, []);

  return (
    <QuoteForm
      mode="create"
      preselectedCustomerId={searchParams.get("cliente")}
      role={role}
    />
  );
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
