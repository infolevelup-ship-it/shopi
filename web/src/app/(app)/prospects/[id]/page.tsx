import Link from "next/link";
import { notFound } from "next/navigation";
import { getProspect } from "@/lib/actions/prospects";
import { getCurrentProfile } from "@/lib/auth";
import { ProspectActions } from "./prospect-actions";
import { Callout, PageHeader, StatusBadge } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/ui/format";
import { statusMeta } from "@/lib/ui/status";
import { PROSPECT_SOURCES, PROSPECT_VISIT_TYPES } from "@/lib/ui/prospects";
import { labelOf } from "@/lib/ui/fiscal";

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-text-soft">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

export default async function ProspectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [result, profile] = await Promise.all([getProspect(id), getCurrentProfile()]);
  if (!result) notFound();

  const { prospect, visits } = result;
  const isClosed = prospect.stage === "WON" || prospect.stage === "LOST";
  const canAct =
    !!profile &&
    (profile.id === prospect.ownerId ||
      profile.role === "SUPERVISOR" ||
      profile.role === "ADMIN");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={{ href: "/prospects", label: "Prospectos" }}
        title={prospect.commercialName ?? prospect.name}
        subtitle={
          <>
            {prospect.commercialName ? `${prospect.name} · ` : ""}
            {prospect.ownerName ? `Responsable: ${prospect.ownerName}` : ""}
          </>
        }
        actions={<StatusBadge kind="prospect" status={prospect.stage} />}
      />

      <p className="mb-5 text-sm text-text-soft">{statusMeta("prospect", prospect.stage).meaning}</p>

      <div className="grid gap-5">
        {prospect.stage === "LOST" && prospect.lostReason && (
          <Callout tone="danger" title="Prospecto perdido">
            {prospect.lostReason}
          </Callout>
        )}

        {prospect.stage === "WON" && (
          <Callout tone="success" title="Convertido en cliente">
            {prospect.convertedAt ? `El ${formatDate(prospect.convertedAt)}. ` : ""}
            {prospect.customerId && (
              <Link href={`/customers/${prospect.customerId}`} className="underline">
                Ver la ficha del cliente
              </Link>
            )}
          </Callout>
        )}

        <section className="card card-pad">
          <h2 className="mb-3 text-base font-semibold">Datos de contacto</h2>
          <dl className="grid gap-2 text-sm">
            <Row label="Teléfono" value={prospect.phone} />
            <Row label="Correo" value={prospect.email} />
            <Row label="Ciudad" value={prospect.city} />
            <Row label="Origen" value={labelOf(PROSPECT_SOURCES, prospect.source)} />
            <Row label="Registrado" value={formatDate(prospect.createdAt)} />
            <Row
              label="Primera visita"
              value={prospect.firstVisitAt ? formatDate(prospect.firstVisitAt) : "todavía ninguna"}
            />
            <Row
              label="Próximo seguimiento"
              value={prospect.nextFollowUpAt ? formatDate(prospect.nextFollowUpAt) : "sin agendar"}
            />
          </dl>
          {prospect.notes && (
            <p className="mt-3 border-t border-line pt-3 text-sm text-text-soft">
              {prospect.notes}
            </p>
          )}

          {canAct && !isClosed && (
            <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row">
              {/* El prospecto que compra se vuelve cliente con la ficha fiscal
                  completa; por eso lleva al formulario de cliente con los datos
                  que ya se conocen, y el enlace se cierra al guardar. */}
              <Link
                href={`/customers/new?prospecto=${prospect.id}`}
                className="btn btn-primary btn-block-mobile"
              >
                Convertir en cliente
              </Link>
            </div>
          )}
        </section>

        {canAct && !isClosed && (
          <ProspectActions prospectId={prospect.id} currentStage={prospect.stage} />
        )}

        <section className="card card-pad">
          <h2 className="mb-3 text-base font-semibold">Historial de visitas</h2>
          {visits.length === 0 ? (
            <p className="text-sm text-text-soft">
              Todavía no se ha registrado ninguna visita ni contacto.
            </p>
          ) : (
            <ul className="grid gap-3">
              {visits.map((v) => (
                <li key={v.id} className="border-b border-line pb-3 last:border-b-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {labelOf(PROSPECT_VISIT_TYPES, v.visitType) ?? "Contacto"}
                      {v.stageBefore && v.stageAfter && v.stageBefore !== v.stageAfter && (
                        <span className="ml-2 text-xs font-normal text-text-soft">
                          {statusMeta("prospect", v.stageBefore).label} →{" "}
                          {statusMeta("prospect", v.stageAfter).label}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-text-muted">{formatDateTime(v.visitedAt)}</span>
                  </div>
                  {v.notes && <p className="mt-1 text-sm text-text-soft">{v.notes}</p>}
                  {v.userName && <p className="mt-1 text-xs text-text-muted">{v.userName}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
