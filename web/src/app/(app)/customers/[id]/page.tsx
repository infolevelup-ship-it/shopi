import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { SiigoSyncButton } from "./siigo-sync-button";
import { GhlSyncStatus } from "./ghl-sync-status";
import { FollowUpsPanel } from "./followups-panel";
import { ClaimCustomerButton } from "./claim-button";
import { Callout, PageHeader, StatTile, StatusBadge } from "@/components/ui";
import { customerDisplayName, formatDate, formatDateTime, formatMoney } from "@/lib/ui/format";
import {
  CUSTOMER_CLASSIFICATIONS,
  FISCAL_RESPONSIBILITIES,
  PURCHASE_TYPES,
  labelOf,
} from "@/lib/ui/fiscal";

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

const ACTIVITY_ICON: Record<string, string> = {
  CALL: "📞",
  WHATSAPP: "💬",
  EMAIL: "✉️",
  VISIT: "🚗",
  NOTE: "📝",
  ORDER_CREATED: "🛒",
  INVOICE_CREATED: "🧾",
  QUOTE_CREATED: "📄",
  QUOTE_SENT: "📤",
  FOLLOW_UP: "🔔",
};

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
        "id, customer_type, document_type, document_number, check_digit, legal_name, first_name, last_name, commercial_name, email, phone, phone_indicative, address, city, department, state_code, city_code, postal_code, status, created_at, source, fiscal_responsibility, fiscal_responsibilities, vat_responsible, purchase_type, customer_type_classification, channel, credit_limit, website_social, birthday, branch_code, contact_first_name, contact_last_name, contact_email, contact_phone, siigo_customer_id, responsible_user_id, ghl_sync_status, ghl_sync_error, responsible:users!customers_responsible_user_id_fkey(name)",
      )
      .eq("id", id)
      .maybeSingle(),
    getCurrentProfile(),
  ]);

  if (!customer) {
    notFound();
  }

  const [
    { data: activities },
    { data: metrics },
    { data: pendingFollowUps },
    { data: orders },
    { data: quotes },
  ] = await Promise.all([
    supabase
      .from("customer_activities")
      .select("id, activity_type, description, activity_at, user:users(name)")
      .eq("customer_id", id)
      .order("activity_at", { ascending: false })
      .limit(30),
    supabase
      .from("customer_metrics")
      .select(
        "orders_count, lifetime_value, average_ticket, last_order_at, days_since_last_order, avg_days_between_orders, estimated_next_purchase_at, is_at_risk",
      )
      .eq("customer_id", id)
      .maybeSingle(),
    supabase
      .from("follow_ups")
      .select("id, scheduled_at, reason, type")
      .eq("customer_id", id)
      .eq("status", "PENDING")
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("orders")
      .select("id, order_number, status, grand_total, created_at")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("quotes")
      .select("id, quote_number, status, grand_total, created_at")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const responsible = Array.isArray(customer.responsible)
    ? customer.responsible[0]
    : customer.responsible;
  const canFollowUp =
    profile?.role === "SELLER" || profile?.role === "SUPERVISOR" || profile?.role === "ADMIN";
  const canSell = profile?.role !== "WAREHOUSE";
  // doc 11 §98: avisar ANTES de actuar comercialmente sobre un cliente que
  // es responsabilidad de otra vendedora.
  const isSomeoneElses =
    profile?.role === "SELLER" &&
    !!customer.responsible_user_id &&
    customer.responsible_user_id !== profile.id;
  // Mismas condiciones que aplica `update_customer` en la base.
  const canEditCustomer =
    !!profile &&
    (profile.role === "SUPERVISOR" ||
      profile.role === "ADMIN" ||
      customer.responsible_user_id === null ||
      customer.responsible_user_id === profile.id);

  const contactName =
    `${customer.contact_first_name ?? ""} ${customer.contact_last_name ?? ""}`.trim() || null;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        back={{ href: "/customers", label: "Clientes" }}
        title={customerDisplayName(customer)}
        subtitle={
          <>
            {customer.document_type} {customer.document_number}
            {customer.check_digit ? `-${customer.check_digit}` : ""} ·{" "}
            {customer.customer_type === "juridica" ? "Empresa" : "Persona natural"} · Responsable:{" "}
            {responsible?.name ?? "sin asignar"}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge kind="customer" status={customer.status} />
            {/* Origen visible: distingue de un vistazo un cliente antiguo de
                Siigo de uno creado aquí, que es lo que decide si editarlo
                pide confirmación. */}
            {customer.source === "SIIGO" && (
              <span className="badge badge-purple">Antiguo de Siigo</span>
            )}
            {canEditCustomer && (
              <Link href={`/customers/${customer.id}/editar`} className="btn btn-secondary btn-sm">
                Editar
              </Link>
            )}
          </div>
        }
      />

      {isSomeoneElses && (
        <div className="mb-5">
          <Callout tone="warning">
            Este cliente está asignado a {responsible?.name ?? "otra vendedora"}. Coordina con
            ella antes de crear un pedido o una cotización.
          </Callout>
        </div>
      )}

      {/* doc 11 §49: acciones contextuales — desde el cliente se crea pedido,
          cotización o seguimiento sin volver a buscarlo */}
      {/* Un cliente importado de Siigo llega sin vendedora. `create_order` la
          exige, así que sin tomarlo no se le puede hacer un pedido. */}
      {!customer.responsible_user_id && canSell && (
        <div className="mb-5">
          <Callout tone="info" title="Este cliente no tiene vendedora responsable">
            Viene del maestro de Siigo y nadie lo ha tomado todavía. Hazte responsable para poder
            crearle pedidos.
            <div className="mt-3">
              <ClaimCustomerButton customerId={customer.id} />
            </div>
          </Callout>
        </div>
      )}

      {canSell && (
        <div className="mb-6 flex flex-col gap-2 sm:flex-row">
          <Link href={`/orders/new?cliente=${customer.id}`} className="btn btn-primary">
            Crear pedido
          </Link>
          <Link href={`/quotes/new?cliente=${customer.id}`} className="btn btn-secondary">
            Crear cotización
          </Link>
        </div>
      )}

      {/* --------------------------------------------- capa comercial */}
      {metrics && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile value={metrics.orders_count ?? 0} label="pedidos" />
          <StatTile value={formatMoney(metrics.lifetime_value ?? 0)} label="valor histórico" />
          <StatTile value={formatMoney(metrics.average_ticket ?? 0)} label="ticket promedio" />
          <StatTile
            value={formatDate(metrics.last_order_at)}
            label="última compra"
            tone={metrics.is_at_risk ? "danger" : undefined}
          />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ------------------------------------------- seguimiento */}
        {metrics?.last_order_at && (
          <section className="card card-pad">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Ciclo de compra</h2>
              {metrics.is_at_risk && <span className="badge badge-danger">Fuera de ciclo</span>}
            </div>
            <dl className="grid gap-2 text-sm">
              <Row label="Frecuencia promedio" value={
                metrics.avg_days_between_orders
                  ? `cada ~${Math.round(metrics.avg_days_between_orders)} días`
                  : "aún sin suficiente historial"
              } />
              <Row label="Días desde la última compra" value={
                metrics.days_since_last_order != null
                  ? `${Math.round(metrics.days_since_last_order)} días`
                  : "—"
              } />
              <Row
                label="Próxima compra estimada"
                value={formatDate(metrics.estimated_next_purchase_at)}
              />
            </dl>
            <p className="mt-3 text-xs text-text-muted">
              Estimación basada en el historial real de compras — no reemplaza el criterio
              comercial.
            </p>
          </section>
        )}

        {/* ------------------------------------------------ contacto */}
        <section className="card card-pad">
          <h2 className="mb-3 text-base font-semibold">Contacto y datos fiscales</h2>
          <dl className="grid gap-2 text-sm">
            <Row
              label="Teléfono"
              value={
                customer.phone
                  ? `${customer.phone_indicative ? `(${customer.phone_indicative}) ` : ""}${customer.phone}`
                  : "—"
              }
            />
            <Row label="Correo de facturación" value={customer.email ?? "—"} />
            <Row
              label="Ciudad"
              value={
                customer.city
                  ? `${customer.city}${customer.department ? `, ${customer.department}` : ""}`
                  : "—"
              }
            />
            <Row label="Dirección" value={customer.address ?? "—"} />
            {/* Los códigos DANE son lo que Siigo exige para emitir: si faltan,
                la factura falla, así que se muestran aunque sean técnicos. */}
            <Row
              label="Códigos DANE"
              value={
                customer.state_code && customer.city_code
                  ? `${customer.state_code} · ${customer.city_code}`
                  : "⚠ faltan"
              }
            />
            <Row
              label="Responsabilidad fiscal"
              value={
                // Puede tener varias (Siigo las recibe como arreglo). Se cae a
                // la columna singular para filas anteriores a la migración 0021.
                (customer.fiscal_responsibilities?.length
                  ? customer.fiscal_responsibilities
                  : customer.fiscal_responsibility
                    ? [customer.fiscal_responsibility]
                    : []
                )
                  .map((c) => `${c} ${labelOf(FISCAL_RESPONSIBILITIES, c) ?? ""}`.trim())
                  .join(" · ") || "—"
              }
            />
            <Row
              label="Tipo de régimen IVA"
              value={
                customer.vat_responsible == null
                  ? "—"
                  : customer.vat_responsible
                    ? "Responsable de IVA"
                    : "No responsable de IVA"
              }
            />
            <Row label="Cliente desde" value={formatDate(customer.created_at)} />
          </dl>

          {contactName && (
            <div className="mt-3 border-t border-line pt-3">
              <p className="mb-2 text-xs font-medium text-text-soft">Persona de contacto</p>
              <dl className="grid gap-2 text-sm">
                <Row label="Nombre" value={contactName} />
                {customer.contact_phone && (
                  <Row label="Teléfono" value={customer.contact_phone} />
                )}
                {customer.contact_email && <Row label="Correo" value={customer.contact_email} />}
              </dl>
            </div>
          )}

          <div className="mt-3 border-t border-line pt-3">
            <p className="mb-2 text-xs font-medium text-text-soft">Clasificación comercial</p>
            <dl className="grid gap-2 text-sm">
              <Row label="Canal" value={customer.channel ?? "—"} />
              <Row
                label="Tipo de negocio"
                value={labelOf(CUSTOMER_CLASSIFICATIONS, customer.customer_type_classification) ?? "—"}
              />
              <Row
                label="Tipo de compra"
                value={labelOf(PURCHASE_TYPES, customer.purchase_type) ?? "—"}
              />
              {customer.credit_limit != null && (
                <Row label="Cupo de crédito" value={formatMoney(customer.credit_limit)} />
              )}
              {customer.website_social && (
                <Row label="Web / red social" value={customer.website_social} />
              )}
              {customer.birthday && (
                <Row label="Cumpleaños" value={formatDate(customer.birthday)} />
              )}
              {customer.branch_code && (
                <Row label="Código de sucursal" value={customer.branch_code} />
              )}
            </dl>
          </div>

          {/* doc 11 §28: se muestra el estado de Siigo, no el id técnico */}
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <span className="text-sm text-text-soft">Siigo:</span>
            {customer.siigo_customer_id ? (
              <span className="badge badge-success">Sincronizado</span>
            ) : (
              <span className="badge badge-warning">Sin sincronizar</span>
            )}
            {profile?.role === "ADMIN" && !customer.siigo_customer_id && (
              <SiigoSyncButton customerId={customer.id} />
            )}
          </div>

          {profile?.role === "ADMIN" && (
            <div className="mt-2">
              <GhlSyncStatus
                customerId={customer.id}
                status={customer.ghl_sync_status}
                error={customer.ghl_sync_error}
              />
            </div>
          )}
        </section>
      </div>

      {canFollowUp && (
        <div className="mt-5">
          <FollowUpsPanel
            customerId={customer.id}
            followUps={pendingFollowUps ?? []}
            phone={customer.phone}
          />
        </div>
      )}

      {/* --------------------------------------------------- historial */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card card-pad">
          <h2 className="mb-3 text-base font-semibold">Pedidos</h2>
          {!orders || orders.length === 0 ? (
            <p className="text-sm text-text-soft">Este cliente todavía no tiene pedidos.</p>
          ) : (
            <ul className="grid gap-2">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/orders/${o.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line p-3 hover:bg-surface-soft"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{o.order_number}</span>
                      <span className="block text-xs text-text-soft">
                        {formatDate(o.created_at)}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-medium">{formatMoney(o.grand_total)}</span>
                      <StatusBadge kind="order" status={o.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card card-pad">
          <h2 className="mb-3 text-base font-semibold">Cotizaciones</h2>
          {!quotes || quotes.length === 0 ? (
            <p className="text-sm text-text-soft">Sin cotizaciones registradas.</p>
          ) : (
            <ul className="grid gap-2">
              {quotes.map((qt) => (
                <li key={qt.id}>
                  <Link
                    href={`/quotes/${qt.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line p-3 hover:bg-surface-soft"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{qt.quote_number}</span>
                      <span className="block text-xs text-text-soft">
                        {formatDate(qt.created_at)}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-medium">{formatMoney(qt.grand_total)}</span>
                      <StatusBadge kind="quote" status={qt.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* doc 11 §68: la actividad es la memoria de la cuenta */}
      <section className="mt-5">
        <h2 className="mb-3 text-base font-semibold">Actividad</h2>
        {!activities || activities.length === 0 ? (
          <div className="card card-pad text-sm text-text-soft">
            Sin actividad todavía. Cada pedido, cotización o seguimiento quedará registrado aquí.
          </div>
        ) : (
          <ol className="card card-pad grid gap-4">
            {activities.map((a) => {
              const user = Array.isArray(a.user) ? a.user[0] : a.user;
              return (
                <li key={a.id} className="flex gap-3">
                  <span aria-hidden className="text-base leading-none">
                    {ACTIVITY_ICON[a.activity_type] ?? "•"}
                  </span>
                  <div className="min-w-0 flex-1 border-b border-line pb-3 last:border-b-0 last:pb-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium">
                        {ACTIVITY_LABEL[a.activity_type] ?? a.activity_type}
                      </span>
                      <span className="text-xs text-text-muted">
                        {formatDateTime(a.activity_at)}
                      </span>
                    </div>
                    {a.description && (
                      <p className="mt-0.5 text-sm text-text-soft">{a.description}</p>
                    )}
                    {user?.name && (
                      <p className="mt-0.5 text-xs text-text-muted">{user.name}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-text-soft">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
