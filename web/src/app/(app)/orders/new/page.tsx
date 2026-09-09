"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OrderForm } from "@/components/order-form";
import { getCurrentUserIdAction } from "@/lib/actions/customers";

function NewOrder() {
  const searchParams = useSearchParams();
  // Se pide al servidor en vez de recibirlo por props porque esta página es
  // "use client" (necesita useSearchParams para el ?cliente=... que llega
  // desde la ficha del cliente) y getCurrentProfile depende de las cookies de
  // la petición, que un componente cliente no puede leer directamente.
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  useEffect(() => {
    getCurrentUserIdAction().then((id) => setCurrentUserId(id ?? undefined));
  }, []);

  return (
    <OrderForm
      mode="create"
      preselectedCustomerId={searchParams.get("cliente")}
      currentUserId={currentUserId}
    />
  );
}

// useSearchParams necesita un límite de Suspense para que Next pueda
// prerenderizar la parte estática de la página.
export default function NewOrderPage() {
  return (
    <Suspense fallback={<div className="skeleton h-64 w-full" />}>
      <NewOrder />
    </Suspense>
  );
}
