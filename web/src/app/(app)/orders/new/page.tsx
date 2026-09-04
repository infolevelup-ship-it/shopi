"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { OrderForm } from "@/components/order-form";

function NewOrder() {
  const searchParams = useSearchParams();
  return <OrderForm mode="create" preselectedCustomerId={searchParams.get("cliente")} />;
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
