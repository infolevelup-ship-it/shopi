"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setInvoiceDocumentAction,
  setSiigoEnabledAction,
  setStockSyncEnabledAction,
  testSiigoConnectionAction,
  type ConnectionTest,
} from "@/lib/actions/integrations";
import { syncProductCatalogAction, type CatalogSyncResult } from "@/lib/actions/catalog";
import {
  importCustomersFromSiigoAction,
  type CustomerImportResult,
  type ImportCursor,
} from "@/lib/actions/customer-import";
import {
  SIIGO_DOC_ELECTRONIC,
  SIIGO_DOC_TEST,
  type IntegrationSettings,
} from "@/lib/integrations/settings";
import { Callout } from "@/components/ui";

function Switch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${
        checked ? "bg-success" : "bg-line-strong"
      }`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
          checked ? "left-6" : "left-1"
        }`}
      />
    </button>
  );
}

export function IntegrationPanel({
  settings,
  importCursor,
}: {
  settings: IntegrationSettings;
  importCursor: ImportCursor;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<ConnectionTest | null>(null);
  const [catalogo, setCatalogo] = useState<CatalogSyncResult | null>(null);
  const [importe, setImporte] = useState<CustomerImportResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await action();
      if (!r.ok) {
        setError(r.error ?? "No se pudo guardar");
        return;
      }
      router.refresh();
    });
  }

  const [cursorActual, setCursorActual] = useState(importCursor);
  const enPruebas = settings.isTestDocument;

  return (
    <div className="grid gap-5">
      {/* doc 11 §87: un estado peligroso no se insinúa, se grita. Olvidar el
          modo de pruebas encendido significa ventas reales que nunca llegan a
          la DIAN, y nadie se entera hasta la declaración. */}
      {enPruebas && (
        <Callout tone="danger" title="⚠ MODO DE PRUEBAS ACTIVO">
          Las facturas se están emitiendo como <strong>documento de ingreso</strong> (no
          electrónico): <strong>no llegan a la DIAN</strong> y no sirven como factura legal.
          Antes de vender de verdad hay que volver a “Factura electrónica”.
        </Callout>
      )}

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger-bg p-3 text-sm text-[#b42318]">
          {error}
        </div>
      )}

      {/* ------------------------------------------------- corte de emergencia */}
      <section className="card card-pad">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Conexión con Siigo</h2>
            <p className="mt-1 text-sm text-text-soft">
              Con esto apagado <strong>no sale nada</strong> hacia Siigo: ni clientes, ni
              inventarios, ni facturas. Es el corte de emergencia.
            </p>
          </div>
          <Switch
            label="Conexión con Siigo"
            checked={settings.siigoEnabled}
            disabled={isPending}
            onChange={(v) => run(() => setSiigoEnabledAction(v))}
          />
        </div>
        <p className="mt-3 border-t border-line pt-3 text-sm">
          Estado:{" "}
          <span className={`badge ${settings.siigoEnabled ? "badge-success" : "badge-danger"}`}>
            {settings.siigoEnabled ? "Conectado" : "Desconectado"}
          </span>
        </p>
      </section>

      {/* ---------------------------------------------------------- inventarios */}
      <section className="card card-pad">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Actualización de inventarios</h2>
            <p className="mt-1 text-sm text-text-soft">
              El botón de bodega que trae el stock desde Siigo. Se puede apagar solo, dejando la
              facturación funcionando.
            </p>
          </div>
          <Switch
            label="Actualización de inventarios"
            checked={settings.stockSyncEnabled}
            disabled={isPending || !settings.siigoEnabled}
            onChange={(v) => run(() => setStockSyncEnabledAction(v))}
          />
        </div>
        {!settings.siigoEnabled && (
          <p className="mt-3 text-xs text-text-muted">
            La conexión general está apagada, así que el inventario tampoco se actualiza sin
            importar cómo esté este interruptor.
          </p>
        )}
      </section>

      {/* ------------------------------------------------- tipo de documento */}
      <section className="card card-pad">
        <h2 className="text-base font-semibold">Tipo de documento al facturar</h2>
        <p className="mt-1 mb-3 text-sm text-text-soft">
          Siigo no tiene un modo de pruebas propio. Para probar sin ensuciar la contabilidad se
          emite contra un documento que no es electrónico y por lo tanto no llega a la DIAN.
        </p>

        <div className="grid gap-2">
          {[
            {
              id: SIIGO_DOC_ELECTRONIC,
              titulo: "Factura electrónica de venta",
              detalle: "La real. Llega a la DIAN. Es la que se usa para vender.",
              tono: "success" as const,
            },
            {
              id: SIIGO_DOC_TEST,
              titulo: "Documento de ingreso (pruebas)",
              detalle: "No es electrónico, no llega a la DIAN. Se puede crear y borrar sin ruido fiscal.",
              tono: "danger" as const,
            },
          ].map((opcion) => {
            const activo = settings.invoiceDocumentId === opcion.id;
            return (
              <button
                key={opcion.id}
                type="button"
                disabled={isPending}
                onClick={() => run(() => setInvoiceDocumentAction(opcion.id))}
                className={`rounded-xl border p-3 text-left transition disabled:opacity-60 ${
                  activo
                    ? opcion.tono === "danger"
                      ? "border-danger bg-danger-bg"
                      : "border-success bg-success-bg"
                    : "border-line hover:border-line-strong"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{opcion.titulo}</span>
                  {activo && (
                    <span className={`badge badge-${opcion.tono === "danger" ? "danger" : "success"}`}>
                      En uso
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-text-soft">{opcion.detalle}</p>
                <p className="mt-1 text-xs text-text-muted">Id en Siigo: {opcion.id}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------ catálogo de productos */}
      <section className="card card-pad">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Catálogo de productos</h2>
            <p className="mt-1 text-sm text-text-soft">
              Trae desde Siigo todos los productos con su código, impuesto, precios e inventario.
              Un producto sin sincronizar <strong>no se puede facturar</strong>.
            </p>
          </div>
          <button
            type="button"
            disabled={isPending || !settings.siigoEnabled}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                setCatalogo(await syncProductCatalogAction());
              })
            }
            className="btn btn-primary btn-block-mobile"
          >
            {isPending ? "Sincronizando…" : "Sincronizar catálogo"}
          </button>
        </div>

        {!settings.siigoEnabled && (
          <p className="mt-2 text-xs text-text-muted">
            Enciende la conexión con Siigo para poder sincronizar.
          </p>
        )}

        {catalogo && !catalogo.ok && (
          <div className="mt-3 rounded-xl border border-danger/30 bg-danger-bg p-3 text-sm text-[#b42318]">
            {catalogo.error}
          </div>
        )}

        {catalogo && catalogo.ok && (
          <div className="mt-3 rounded-xl border border-success/30 bg-success-bg p-3 text-sm">
            <p className="font-medium text-[#05834b]">
              ✔ {catalogo.total} productos sincronizados — {catalogo.creados} nuevos,{" "}
              {catalogo.actualizados} actualizados.
            </p>
            {catalogo.listasDePrecio.length > 0 && (
              <p className="mt-1 text-text-soft">
                Listas de precio encontradas en Siigo: {catalogo.listasDePrecio.join(", ")}.
              </p>
            )}
            {/* Dos cosas distintas, y confundirlas haría pensar que la
                sincronización falló: que a un producto le falte una lista es un
                dato de Siigo, no un error de aquí. */}
            {catalogo.conListaIncompleta > 0 && (
              <p className="mt-1 text-text-soft">
                {catalogo.conListaIncompleta} productos no tienen las tres listas cargadas en
                Siigo. No es un fallo de la sincronización: ese precio no existe allá. Al armar un
                pedido con esa lista, la pantalla lo avisa.
              </p>
            )}
            {catalogo.sinPrecio > 0 && (
              <p className="mt-1 text-[#b54708]">
                ⚠ {catalogo.sinPrecio} entraron sin ningún precio. Se pueden facturar igual — el
                precio se escribe en el pedido.
              </p>
            )}
          </div>
        )}
      </section>

      {/* ------------------------------------------------- clientes de Siigo */}
      <section className="card card-pad">
        <h2 className="text-base font-semibold">Clientes de Siigo</h2>
        <p className="mt-1 mb-3 text-sm text-text-soft">
          Trae el maestro de terceros. Puede ser muy grande, así que{" "}
          <strong>avanza por tandas</strong>: cada vez que pulses importa lo que alcance y guarda
          por dónde iba, sin repetir trabajo.
        </p>

        <div className="mb-3 rounded-xl border border-line bg-surface-soft p-3 text-sm">
          {cursorActual.done ? (
            <p className="text-success">
              ✔ Importación terminada: {cursorActual.imported} clientes.
            </p>
          ) : cursorActual.imported > 0 ? (
            <p>
              Importados <strong>{cursorActual.imported}</strong>
              {cursorActual.total ? ` de ~${cursorActual.total}` : ""} — falta continuar.
            </p>
          ) : (
            <p className="text-text-soft">Todavía no se ha importado ningún cliente.</p>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={isPending || !settings.siigoEnabled}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const r = await importCustomersFromSiigoAction(false);
                setImporte(r);
                if (r.ok) setCursorActual(r.cursor);
                router.refresh();
              })
            }
            className="btn btn-primary btn-block-mobile"
          >
            {isPending
              ? "Importando…"
              : cursorActual.done
                ? "Ya está al día"
                : cursorActual.imported > 0
                  ? "Continuar importación"
                  : "Importar clientes"}
          </button>

          {cursorActual.imported > 0 && (
            <button
              type="button"
              disabled={isPending || !settings.siigoEnabled}
              onClick={() => {
                if (!confirm("¿Volver a empezar desde el primer cliente? No borra nada, solo reinicia el recorrido.")) return;
                startTransition(async () => {
                  setError(null);
                  const r = await importCustomersFromSiigoAction(true);
                  setImporte(r);
                  if (r.ok) setCursorActual(r.cursor);
                  router.refresh();
                });
              }}
              className="btn btn-secondary btn-block-mobile"
            >
              Empezar de nuevo
            </button>
          )}
        </div>

        {!settings.siigoEnabled && (
          <p className="mt-2 text-xs text-text-muted">
            Enciende la conexión con Siigo para poder importar.
          </p>
        )}

        {importe && !importe.ok && (
          <div className="mt-3 rounded-xl border border-danger/30 bg-danger-bg p-3 text-sm text-[#b42318]">
            {importe.error}
            <p className="mt-1 text-text-soft">
              Lo ya importado se conservó. Puedes volver a pulsar para continuar.
            </p>
          </div>
        )}

        {importe && importe.ok && (
          <div className="mt-3 rounded-xl border border-success/30 bg-success-bg p-3 text-sm">
            <p className="font-medium text-[#05834b]">
              ✔ {importe.importadosAhora} clientes en esta tanda.
              {importe.cursor.done ? " Importación completa." : " Pulsa de nuevo para continuar."}
            </p>
            {/* Un tipo de documento que no reconocemos no se adivina: sería
                inventar un dato fiscal y la factura saldría mal. */}
            {importe.omitidos > 0 && (
              <p className="mt-1 text-[#b54708]">
                ⚠ {importe.omitidos} se omitieron por tener un tipo de documento que no
                reconocemos. Revísalos en Siigo.
              </p>
            )}
          </div>
        )}

        <p className="s-note mt-3">
          Los importados llegan <strong>sin vendedora asignada</strong> y marcados como “antiguo de
          Siigo”: al editarlos, la app pide confirmación y envía los cambios de vuelta a Siigo.
        </p>
      </section>

      {/* --------------------------------------------------- prueba de conexión */}
      <section className="card card-pad">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Probar la conexión</h2>
            <p className="mt-1 text-sm text-text-soft">
              Solo autentica y lee el catálogo de documentos. No escribe nada en Siigo, así que se
              puede usar con la integración apagada.
            </p>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                setTest(await testSiigoConnectionAction());
              })
            }
            className="btn btn-secondary btn-block-mobile"
          >
            {isPending ? "Probando…" : "Probar"}
          </button>
        </div>

        {test && !test.ok && (
          <div className="mt-3 rounded-xl border border-danger/30 bg-danger-bg p-3 text-sm text-[#b42318]">
            {test.error}
          </div>
        )}

        {test && test.ok && (
          <div className="mt-3">
            <p className="mb-2 text-sm text-success">
              ✔ El servidor se conectó con Siigo. Documentos de venta de la cuenta:
            </p>
            <ul className="grid gap-1 text-sm">
              {test.documentTypes.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 border-b border-line py-1.5 last:border-b-0">
                  <span>
                    <span className="font-mono text-xs text-text-muted">{d.id}</span> {d.name}
                  </span>
                  <span className={`badge ${d.electronic ? "badge-success" : "badge-neutral"}`}>
                    {d.electronic ? "Electrónico" : "No llega a la DIAN"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
