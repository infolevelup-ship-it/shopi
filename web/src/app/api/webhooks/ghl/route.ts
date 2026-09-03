import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Json } from "@/lib/supabase/database.types";

// doc 07 §11: "solo usar cuando GHL necesite informar a WOW" — debe
// autenticar, deduplicar, registrar, procesar. doc 07 §12: "cambiar una
// etapa manualmente en GHL nunca debe crear una factura fiscal" — a
// propósito, este endpoint SOLO registra el evento por ahora, ningún
// procesamiento de negocio pasa por aquí (ver docs/PENDIENTES.md § Fase 9).
//
// Autenticación: GHL no documenta una firma HMAC estándar para webhooks de
// automatización — se usa un secreto compartido en la URL, configurado al
// crear el webhook en GHL: .../api/webhooks/ghl?secret=<GHL_WEBHOOK_SECRET>.
export async function POST(request: NextRequest) {
  const secret = process.env.GHL_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook no configurado" }, { status: 503 });
  }

  const provided = request.nextUrl.searchParams.get("secret") ?? "";
  const expected = Buffer.from(secret);
  const got = Buffer.from(provided);
  const authorized = expected.length === got.length && timingSafeEqual(expected, got);
  if (!authorized) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rawBody = await request.text();
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // Deduplicar: GHL no confirma un id de evento estable en el payload —
  // se usa un hash del cuerpo crudo como llave única.
  const eventKey = createHash("sha256").update(rawBody).digest("hex");
  const eventType =
    payload && typeof payload === "object" && "type" in payload
      ? String((payload as { type?: unknown }).type)
      : null;

  const serviceClient = createServiceRoleClient();
  const { error } = await serviceClient
    .from("ghl_webhook_events")
    .insert({ ghl_event_key: eventKey, event_type: eventType, payload: payload as Json });

  if (error) {
    if (error.code === "23505") {
      // Mismo evento recibido antes — dedup funcionando, no es un error.
      return NextResponse.json({ ok: true, duplicate: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
