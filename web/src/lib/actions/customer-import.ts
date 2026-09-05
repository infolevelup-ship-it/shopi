"use server";

import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  listSiigoCustomersPage,
  SiigoApiError,
  SIIGO_ID_TYPE_TO_DOCUMENT_TYPE,
} from "@/lib/siigo/client";
import type { SiigoCustomer } from "@/lib/siigo/types";
import { getIntegrationSettings } from "@/lib/actions/integrations";

const CURSOR_KEY = "siigo_customer_import_cursor";
const PAGE_SIZE = 100;
// Presupuesto de tiempo por pulsación. Una función serverless tiene un tope
// duro, así que el import avanza lo que puede y guarda por dónde iba en vez
// de intentar traer 26.000 clientes en una sola petición y morir a la mitad.
const PRESUPUESTO_MS = 35_000;

export type ImportCursor = { page: number; imported: number; total: number | null; done: boolean };

export type CustomerImportResult =
  | {
      ok: true;
      importadosAhora: number;
      omitidos: number;
      cursor: ImportCursor;
    }
  | { ok: false; error: string };

function filaDesdeSiigo(c: SiigoCustomer) {
  const documentType = SIIGO_ID_TYPE_TO_DOCUMENT_TYPE[c.id_type?.code ?? ""];
  // Sin un tipo de documento conocido no se importa: adivinarlo sería
  // inventar un dato fiscal, y la factura lo llevaría mal.
  if (!documentType || !c.identification) return null;

  const esEmpresa = c.person_type === "Company";
  const nombres = c.name ?? [];
  const telefono = c.phones?.[0];
  const contacto = c.contacts?.[0];
  const normalizado = String(c.identification).replace(/\D/g, "");
  if (!normalizado) return null;

  return {
    siigo_customer_id: String(c.id),
    customer_type: esEmpresa ? "juridica" : "natural",
    document_type: documentType,
    document_number: String(c.identification),
    document_number_normalized: normalizado,
    check_digit: c.check_digit ?? null,
    // Siigo entrega el nombre como arreglo y nunca se debe cortar por el
    // primer espacio (doc 06 §7): para empresa es un elemento, para persona
    // vienen nombres y apellidos ya separados.
    legal_name: esEmpresa ? (nombres[0] ?? null) : null,
    first_name: esEmpresa ? null : (nombres[0] ?? null),
    last_name: esEmpresa ? null : (nombres[1] ?? null),
    commercial_name: c.commercial_name ?? null,
    address: c.address?.address ?? null,
    city: c.address?.city?.city_name ?? null,
    department: c.address?.city?.state_name ?? null,
    state_code: c.address?.city?.state_code ?? null,
    city_code: c.address?.city?.city_code ?? null,
    postal_code: c.address?.postal_code ?? null,
    phone_indicative: telefono?.indicative ?? null,
    phone: telefono?.number ?? null,
    phone_extension: telefono?.extension ?? null,
    contact_first_name: contacto?.first_name ?? null,
    contact_last_name: contacto?.last_name ?? null,
    contact_email: contacto?.email ?? null,
    contact_indicative: contacto?.phone?.indicative ?? null,
    contact_phone: contacto?.phone?.number ?? null,
    vat_responsible: c.vat_responsible ?? null,
    fiscal_responsibilities: (c.fiscal_responsibilities ?? []).map((f) => f.code).filter(Boolean),
    fiscal_responsibility: c.fiscal_responsibilities?.[0]?.code ?? null,
    status: (c.active === false ? "INACTIVE" : "ACTIVE") as "ACTIVE" | "INACTIVE",
    // El origen ("SIIGO") lo pone la función, y el responsable se deja sin
    // asignar a propósito: nadie ha atendido todavía a ese cliente en la
    // plataforma. La vendedora lo toma con "Hacerme responsable".
  };
}

export async function getImportCursor(): Promise<ImportCursor> {
  const serviceClient = createServiceRoleClient();
  const { data } = await serviceClient
    .from("app_settings")
    .select("value")
    .eq("key", CURSOR_KEY)
    .maybeSingle();
  const raw = data?.value as Partial<ImportCursor> | null;
  return {
    page: typeof raw?.page === "number" ? raw.page : 1,
    imported: typeof raw?.imported === "number" ? raw.imported : 0,
    total: typeof raw?.total === "number" ? raw.total : null,
    done: raw?.done === true,
  };
}

/**
 * Importa el maestro de terceros de Siigo por lotes. Cada pulsación avanza lo
 * que alcance dentro del presupuesto de tiempo y guarda por dónde iba, así que
 * se puede repetir hasta terminar sin perder trabajo.
 */
export async function importCustomersFromSiigoAction(
  reiniciar = false,
): Promise<CustomerImportResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "ADMIN") {
    return { ok: false, error: "Solo un administrador puede importar clientes" };
  }

  const integraciones = await getIntegrationSettings();
  if (!integraciones.siigoEnabled) {
    return { ok: false, error: "La integración con Siigo está desconectada. Enciéndela arriba." };
  }

  // La escritura va con la sesión del administrador porque la función
  // comprueba el rol; el cursor sí va con service role, que es solo estado
  // interno del proceso.
  const supabase = await createClient();
  const serviceClient = createServiceRoleClient();
  const cursor = reiniciar
    ? { page: 1, imported: 0, total: null as number | null, done: false }
    : await getImportCursor();

  if (cursor.done && !reiniciar) {
    return { ok: true, importadosAhora: 0, omitidos: 0, cursor };
  }

  const arranque = Date.now();
  let page = cursor.page;
  let importadosAhora = 0;
  let omitidos = 0;
  let total = cursor.total;
  let terminado = false;

  try {
    while (Date.now() - arranque < PRESUPUESTO_MS) {
      const { clientes, total: totalSiigo } = await listSiigoCustomersPage(page, PAGE_SIZE);
      if (totalSiigo != null) total = totalSiigo;

      if (clientes.length === 0) {
        terminado = true;
        break;
      }

      const filas = clientes.map(filaDesdeSiigo).filter((f) => f !== null);
      omitidos += clientes.length - filas.length;

      if (filas.length > 0) {
        // Va por función y no por upsert de PostgREST: el índice único de
        // documento es parcial (`where merged_into_customer_id is null`) y un
        // `on conflict (cols)` sin ese predicado lo rechaza Postgres.
        const { error } = await supabase.rpc("import_siigo_customers", {
          p_customers: filas,
        });
        if (error) {
          return { ok: false, error: `No se pudieron guardar los clientes: ${error.message}` };
        }
        importadosAhora += filas.length;
      }

      page += 1;
      if (clientes.length < PAGE_SIZE) {
        terminado = true;
        break;
      }
    }
  } catch (err) {
    const mensaje =
      err instanceof SiigoApiError
        ? `Siigo respondió ${err.status}: ${err.body.slice(0, 200)}`
        : err instanceof Error
          ? err.message
          : "Error desconocido";
    // El cursor se guarda igual: lo ya importado no se pierde y la siguiente
    // pulsación retoma donde se cortó.
    await guardarCursor(serviceClient, {
      page,
      imported: cursor.imported + importadosAhora,
      total,
      done: false,
    });
    return { ok: false, error: `Se cortó la importación. ${mensaje}` };
  }

  const nuevo: ImportCursor = {
    page,
    imported: cursor.imported + importadosAhora,
    total,
    done: terminado,
  };
  await guardarCursor(serviceClient, nuevo);

  return { ok: true, importadosAhora, omitidos, cursor: nuevo };
}

async function guardarCursor(
  serviceClient: ReturnType<typeof createServiceRoleClient>,
  cursor: ImportCursor,
) {
  await serviceClient
    .from("app_settings")
    .upsert({ key: CURSOR_KEY, value: cursor, updated_at: new Date().toISOString() }, { onConflict: "key" });
}
