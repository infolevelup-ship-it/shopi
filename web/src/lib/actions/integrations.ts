"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { GhlApiError, listGhlPipelines, listGhlUsers } from "@/lib/ghl/client";
import {
  INTEGRATION_KEYS,
  parseIntegrationSettings,
  sufijoEmbudo,
  type GhlEmbudo,
  type IntegrationSettings,
} from "@/lib/integrations/settings";

export async function getIntegrationSettings(): Promise<IntegrationSettings> {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("key, value").in("key", INTEGRATION_KEYS);
  const map = new Map<string, unknown>((data ?? []).map((r) => [r.key as string, r.value]));
  return parseIntegrationSettings(map);
}

export type SettingResult = { ok: true } | { ok: false; error: string };

async function write(key: string, value: boolean | number | string): Promise<SettingResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_app_setting", { p_key: key, p_value: value });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function setSiigoEnabledAction(enabled: boolean): Promise<SettingResult> {
  return write("siigo_integration_enabled", enabled);
}

export async function setStockSyncEnabledAction(enabled: boolean): Promise<SettingResult> {
  return write("siigo_stock_sync_enabled", enabled);
}

export async function setInvoiceDocumentAction(documentId: number): Promise<SettingResult> {
  return write("siigo_invoice_document_id", documentId);
}

export async function setGhlEnabledAction(enabled: boolean): Promise<SettingResult> {
  return write("ghl_integration_enabled", enabled);
}

/**
 * Guarda el embudo y la etapa donde caen los pedidos. Los dos van juntos
 * a propósito: una etapa pertenece a un embudo, y guardar uno sin el otro
 * dejaría una combinación que GHL rechaza al crear la oportunidad.
 */
export async function setGhlPipelineAction(
  embudo: GhlEmbudo,
  pipelineId: string,
  stageId: string,
): Promise<SettingResult> {
  const sufijo = sufijoEmbudo(embudo);
  const primero = await write(`ghl_pipeline_id${sufijo}`, pipelineId);
  if (!primero.ok) return primero;
  return write(`ghl_pipeline_stage_id${sufijo}`, stageId);
}

export type GhlPipelinesResult =
  | {
      ok: true;
      locationId: string;
      pipelines: { id: string; name: string; stages: { id: string; name: string }[] }[];
      users: { id: string; name: string; email: string | null }[];
    }
  | { ok: false; error: string };

/**
 * Lee los embudos, sus etapas y los usuarios de la subcuenta. Es solo lectura:
 * no crea ni cambia nada en GHL, así que sirve igual con la integración
 * apagada — que es justo cuando hace falta, para saber si ya se puede
 * encender y con qué ids.
 */
export async function loadGhlConfigOptionsAction(): Promise<GhlPipelinesResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "ADMIN") {
    return { ok: false, error: "Solo un administrador puede leer la configuración de GHL" };
  }

  const token = process.env.GHL_PRIVATE_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!token || !locationId) {
    return {
      ok: false,
      error:
        "Faltan GHL_PRIVATE_TOKEN o GHL_LOCATION_ID en el servidor. Se agregan en Vercel y solo aplican a despliegues nuevos.",
    };
  }

  try {
    // En paralelo: son dos lecturas independientes y así la pantalla no
    // espera una detrás de la otra.
    const [pipelines, users] = await Promise.all([
      listGhlPipelines(locationId),
      listGhlUsers(locationId),
    ]);
    return { ok: true, locationId, pipelines, users };
  } catch (err) {
    const mensaje =
      err instanceof GhlApiError
        ? `GHL respondió ${err.status}: ${err.body.slice(0, 300)}`
        : err instanceof Error
          ? err.message
          : "Error desconocido";
    return { ok: false, error: mensaje };
  }
}

export type VinculacionResult =
  | { ok: true; vinculadas: { nombre: string; correo: string }[]; sinPareja: string[] }
  | { ok: false; error: string };

/**
 * Empareja las usuarias de la app con las de GHL POR CORREO y guarda su
 * `ghl_user_id`, que es lo que hace que la oportunidad quede asignada a quien
 * tomó el pedido.
 *
 * Por correo y no por nombre, y leyendo el id de la API y no de una lista
 * escrita a mano, por dos razones distintas que llevan al mismo error:
 * en esta cuenta conviven "Karina Ríos" (demo) y "Karina Noriega" (jefa
 * comercial); y los ids de GHL mezclan 1 con l y 0 con O, así que copiarlos de
 * una captura es una lotería. Las dos formas terminan asignándole las
 * oportunidades de una persona a otra, sin ningún error visible.
 */
export async function vincularUsuariasConGhlAction(): Promise<VinculacionResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "ADMIN") {
    return { ok: false, error: "Solo un administrador puede vincular las usuarias" };
  }

  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) {
    return { ok: false, error: "Falta GHL_LOCATION_ID en el servidor." };
  }

  let usuariosGhl;
  try {
    usuariosGhl = await listGhlUsers(locationId);
  } catch (err) {
    const mensaje =
      err instanceof GhlApiError
        ? `GHL respondió ${err.status}: ${err.body.slice(0, 300)}`
        : err instanceof Error
          ? err.message
          : "Error desconocido";
    return { ok: false, error: mensaje };
  }

  const porCorreo = new Map(
    usuariosGhl
      .filter((u) => u.email)
      .map((u) => [u.email!.trim().toLowerCase(), u.id] as const),
  );

  const supabase = await createClient();
  const { data: usuarias, error } = await supabase.from("users").select("id, name, email");
  if (error) return { ok: false, error: error.message };

  const vinculadas: { nombre: string; correo: string }[] = [];
  const sinPareja: string[] = [];

  for (const u of usuarias ?? []) {
    const correo = (u.email ?? "").trim().toLowerCase();
    const ghlId = correo ? porCorreo.get(correo) : undefined;
    if (!ghlId) {
      sinPareja.push(u.email ?? u.name);
      continue;
    }
    // `users` no tiene política de UPDATE para el propio usuario, pero sí para
    // ADMIN; si algún día deja de tenerla, esto afectaría 0 filas en silencio,
    // así que el resultado se comprueba con la fila devuelta.
    const { data: fila } = await supabase
      .from("users")
      .update({ ghl_user_id: ghlId, updated_at: new Date().toISOString() })
      .eq("id", u.id)
      .select("id")
      .maybeSingle();
    if (fila) vinculadas.push({ nombre: u.name, correo: u.email ?? "" });
    else sinPareja.push(`${u.email ?? u.name} (no se pudo guardar)`);
  }

  return { ok: true, vinculadas, sinPareja };
}

export type EquipoResult =
  | { ok: true; filas: { correo: string; estado: string }[] }
  | { ok: false; error: string };

/**
 * Crea la ficha de cada integrante del equipo con su rol, para quien ya tenga
 * login en Supabase. Devuelve también a quién le falta, que es la mitad útil:
 * sin login no hay ficha, y sin ficha esa persona no puede entrar.
 */
export async function sincronizarEquipoAction(): Promise<EquipoResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sync_equipo_real");
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    filas: (data ?? []).map((f) => ({ correo: f.correo as string, estado: f.estado as string })),
  };
}

// Prueba de conexión: solo autentica y pide el catálogo de tipos de documento.
// No escribe nada en Siigo, así que se puede correr con la integración
// apagada — de hecho es justo cuando más sirve, para saber si ya se puede
// volver a encender.
export type ConnectionTest =
  | { ok: true; documentTypes: { id: number; name: string; electronic: boolean }[] }
  | { ok: false; error: string };

export async function testSiigoConnectionAction(): Promise<ConnectionTest> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "ADMIN") {
    return { ok: false, error: "Solo un administrador puede probar la conexión" };
  }

  const username = process.env.SIIGO_USERNAME;
  const accessKey = process.env.SIIGO_ACCESS_KEY;
  const partnerId = process.env.SIIGO_PARTNER_ID;
  if (!username || !accessKey || !partnerId) {
    return {
      ok: false,
      error:
        "Faltan las credenciales de Siigo en el servidor (SIIGO_USERNAME, SIIGO_ACCESS_KEY, SIIGO_PARTNER_ID). Recuerda que solo aplican a despliegues nuevos.",
    };
  }

  try {
    const auth = await fetch("https://api.siigo.com/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, access_key: accessKey }),
    });
    if (!auth.ok) {
      return { ok: false, error: `Siigo rechazó la autenticación (HTTP ${auth.status}).` };
    }
    const { access_token: token } = (await auth.json()) as { access_token?: string };
    if (!token) return { ok: false, error: "Siigo respondió sin token de acceso." };

    const res = await fetch("https://api.siigo.com/v1/document-types?type=FV", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Partner-Id": partnerId,
      },
    });
    if (!res.ok) {
      return { ok: false, error: `Autenticó, pero falló al leer los tipos de documento (HTTP ${res.status}).` };
    }
    const raw = (await res.json()) as unknown;
    const lista = Array.isArray(raw) ? raw : ((raw as { results?: unknown[] })?.results ?? []);

    return {
      ok: true,
      documentTypes: (lista as Record<string, unknown>[]).map((d) => ({
        id: Number(d.id),
        name: String(d.name ?? ""),
        // Siigo marca los no electrónicos con electronic_type "NoElectronic".
        electronic: String(d.electronic_type ?? "").toLowerCase() !== "noelectronic",
      })),
    };
  } catch (err) {
    return {
      ok: false,
      error: `No se pudo llegar a api.siigo.com desde el servidor: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
