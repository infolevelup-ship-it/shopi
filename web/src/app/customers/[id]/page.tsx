import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { SiigoSyncButton } from "./siigo-sync-button";
import { GhlSyncStatus } from "./ghl-sync-status";
import { FollowUpsPanel } from "./followups-panel";

const ACTIVITY_LABEL: Record<string, string> = {
  CALL: "Llamada",
  WHATSAPP: "WhatsApp",
  EMAIL: "Correo",
  VISIT: "Visita",
  NOTE: "Nota",
  QUOTE_CREATED: "Cotización creada",
  QUOTE_SENT: "Cotización enviada",
  QUOTE_WON: "Cotización ganada",
  QUOTE_LOST: "Cotización perdida",
  ORDER_CREATED: "Pedido creado",
  ORDER_UPDATED: "Pedido actualizado",
  INVOICE_CREATED: "Factura creada",
  SHIPMENT: "Despacho",
  FOLLOW_UP: "Seguimiento",
  OTHER: "Otro",
};

function displayName(c: {
  legal_name: string | null;
  first_name: string | null;
  last_name: string | null;
  commercial_name: string | null;
}) {
  return (
    c.commercial_name ??
    c.legal_name ??
    (`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "(sin nombre)")
  );
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: customer }, profile] = await Promise.all([
    supabase
      .from("customers")
      .select(
        "id, customer_type, document_type, document_number, legal_name, first_name, last_name, commercial_name, email, phone, address, city, status, created_at, siigo_customer_id, ghl_sync_status, ghl_sync_error, responsible:users!customers_responsible_user_id_fkey(name)",
      )
      .eq("id", id)
      .maybeSingle(),
    getCurrentProfile(),
  ]);

  if (!customer) {
    notFound();
  }

  const [{ data: activities }, { data: metrics }, { data: pendingFollowUps }] = await Promise.all([
    supabase
      .from("customer_activities")
      .select("id, activity_type, description, activity_at, user:users(name)")
      .eq("customer_id", id)
      .order("activity_at", { ascending: false })
      .limit(50),
    supabase
      .from("customer_metrics")
      .select("last_order_at, days_since_last_order, avg_days_between_orders, estimated_next_purchase_at, is_at_risk")
      .eq("customer_id", id)
      .maybeSingle(),
    supabase
      .from("follow_ups")
      .select("id, scheduled_at, reason, type")
      .eq("customer_id", id)
      .eq("status", "PENDING")
      .order("scheduled_at", { ascending: true }),
  ]);

  const responsible = Array.isArray(customer.responsible)
    ? customer.responsible[0]
    : customer.responsible;
  const canFollowUp = profile?.role === "SELLER" || profile?.role === "SUPERVISOR" || profile?.role === "ADMIN";

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/customers" className="text-sm text-neutral-500 hover:underline">
        ← Clientes
      </Link>

      <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">{displayName(customer)}</h1>
            <p className="text-sm text-neutral-500">
              {customer.document_type} {customer.document_number} ·{" "}
              {customer.customer_type === "juridica" ? "Empresa" : "Persona natural"}
            </p>
          </div>
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
            {customer.status}
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-neutral-500">Responsable</dt>
            <dd className="text-neutral-900">{responsible?.name ?? "Sin asignar"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Teléfono</dt>
            <dd className="text-neutral-900">{customer.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Email</dt>
            <dd className="text-neutral-900">{customer.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Ciudad</dt>
            <dd className="text-neutral-900">{customer.city ?? "—"}</dd>
          </div>
          {customer.address && (
            <div className="col-span-2">
              <dt className="text-neutral-500">Dirección</dt>
              <dd className="text-neutral-900">{customer.address}</dd>
            </div>
          )}
        </dl>
      </div>

      {metrics && metrics.last_order_at && (
        <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4 text-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-neutral-500">Seguimiento inteligente</h2>
            {metrics.is_at_risk && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                🔴 Fuera de ciclo
              </span>
            )}
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <dt className="text-xs text-neutral-500">Última compra</dt>
              <dd className="text-neutral-900">{new Date(metrics.last_order_at).toLocaleDateString("es-CO")}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Frecuencia promedio</dt>
              <dd className="text-neutral-900">
                {metrics.avg_days_between_orders ? `~${Math.round(metrics.avg_days_between_orders)} días` : "—"}
              </dd>
            </div>
            {metrics.estimated_next_purchase_at && (
              <div className="col-span-2">
                <dt className="text-xs text-neutral-500">Próxima compra estimada</dt>
                <dd className="text-neutral-900">
                  {new Date(metrics.estimated_next_purchase_at).toLocaleDateString("es-CO")}
                </dd>
              </div>
            )}
          </dl>
          <p className="mt-2 text-xs text-neutral-400">
            Recomendación basada en datos — no reemplaza el criterio comercial.
          </p>
        </div>
      )}

      {profile?.role === "ADMIN" &&
        (customer.siigo_customer_id ? (
          <p className="mt-4 text-xs text-neutral-400">
            Sincronizado con Siigo (id {customer.siigo_customer_id}).
          </p>
        ) : (
          <SiigoSyncButton customerId={customer.id} />
        ))}

      {profile?.role === "ADMIN" && (
        <GhlSyncStatus customerId={customer.id} status={customer.ghl_sync_status} error={customer.ghl_sync_error} />
      )}

      {canFollowUp && <FollowUpsPanel customerId={customer.id} followUps={pendingFollowUps ?? []} />}

      <h2 className="mt-8 mb-3 text-sm font-semibold text-neutral-700">Actividad</h2>
      <div className="space-y-3">
        {!activities || activities.length === 0 ? (
          <p className="text-sm text-neutral-500">Sin actividad todavía.</p>
        ) : (
          activities.map((a) => {
            const user = Array.isArray(a.user) ? a.user[0] : a.user;
            return (
              <div
                key={a.id}
                className="rounded-lg border border-neutral-200 bg-white p-4 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-neutral-900">
                    {ACTIVITY_LABEL[a.activity_type] ?? a.activity_type}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {new Date(a.activity_at).toLocaleString("es-CO")}
                  </span>
                </div>
                {a.description && <p className="mt-1 text-neutral-700">{a.description}</p>}
                {user?.name && <p className="mt-1 text-xs text-neutral-500">{user.name}</p>}
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
