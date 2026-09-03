"use client";

import Link from "next/link";
import type { ReviewQueueItem } from "@/lib/actions/orders";

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Enviado",
  PENDING_REVIEW: "Pendiente de revisión",
  IN_REVIEW: "En revisión",
};

function formatMoney(value: number) {
  return value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

function antiguedad(submittedAt: string | null) {
  if (!submittedAt) return "—";
  const ms = Date.now() - new Date(submittedAt).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return "< 1 h";
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

export function ReviewQueue({ items }: { items: ReviewQueueItem[] }) {
  if (items.length === 0) {
    return <p className="mt-6 text-sm text-neutral-500">No hay pedidos pendientes de revisión.</p>;
  }

  return (
    <div className="mt-6 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
      {items.map((o) => (
        <Link
          key={o.id}
          href={`/orders/${o.id}`}
          className="flex items-center justify-between p-4 hover:bg-neutral-50"
        >
          <div>
            <p className="text-sm font-medium text-neutral-900">{o.order_number}</p>
            <p className="text-xs text-neutral-500">
              {o.customer_name ?? "(sin cliente)"}
              {o.seller_name ? ` · ${o.seller_name}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-neutral-900">{formatMoney(o.grand_total)}</p>
            <p className="text-xs text-neutral-500">
              {STATUS_LABEL[o.status] ?? o.status} · {antiguedad(o.submitted_at)}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
