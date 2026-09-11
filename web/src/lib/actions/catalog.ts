"use server";

import { getCurrentProfile } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { listAllSiigoProducts, SiigoApiError } from "@/lib/siigo/client";
import type { SiigoProduct } from "@/lib/siigo/types";
import { getIntegrationSettings } from "@/lib/actions/integrations";

export type CatalogSyncResult =
  | {
      ok: true;
      total: number;
      creados: number;
      actualizados: number;
      /** Sin ningún precio en ninguna lista. */
      sinPrecio: number;
      /** Tiene al menos un precio pero le falta alguna de las tres listas. */
      conListaIncompleta: number;
      /** Venían de Siigo sin código o sin nombre: no se pueden guardar. */
      descartados: number;
      /** Códigos repetidos en Siigo: se guardó una sola vez cada uno. */
      duplicados: number;
      listasDePrecio: string[];
    }
  | { ok: false; error: string };

// Nombres reales de las listas de precio en la cuenta de Productos WOW,
// confirmados contra 100 productos: "Publico" (sin tilde), "Profesional" y
// "Salones" (en plural). Se comparan normalizados —sin tildes y en
// minúsculas— para que un cambio de tipografía en Siigo no las rompa, y
// quedan pistas de respaldo por si algún día las renombran.
const NOMBRE_EXACTO: Record<ClaveLista, string> = {
  publico: "publico",
  profesional: "profesional",
  salon: "salones",
};

// Respaldo por si en Siigo renombran una lista. Deliberadamente NO se empareja
// por posición: si alguien reordena las listas allá, la posición cambia y los
// precios quedarían cruzados sin ningún error visible.
const PISTAS_LISTA: Record<ClaveLista, string[]> = {
  publico: ["publico", "general", "detal", "sugerido"],
  profesional: ["profesional", "estilista"],
  salon: ["salon", "mayorista", "distribuidor"],
};

type ClaveLista = "publico" | "profesional" | "salon";
const CLAVES: ClaveLista[] = ["publico", "profesional", "salon"];

/** Sin tildes y en minúsculas: "Salón" y "SALONES" caen en la misma bolsa. */
function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Confirmado contra la cuenta real (producto PW101101, `tax_included: true`,
// precio 7000): Siigo puede guardar el valor de cada lista CON el IVA ya
// sumado. `products.price_*` tiene que quedar siempre en precio BASE (sin
// IVA) — create_order/update_order/buildSiigoInvoicePayload le suman el IVA
// encima al facturar, así que si aquí ya viene con IVA, se está cobrando dos
// veces. Mismo bug que ya se había encontrado y corregido en el formulario
// HTML anterior (docs/PLAN_V2_Formulario_Retencion_Consecutivo.md §0.1).
function precios(p: SiigoProduct, taxPercent: number | null) {
  const listas = p.prices?.[0]?.price_list ?? [];
  const factor = p.tax_included && taxPercent ? 1 + taxPercent / 100 : 1;
  const sinIva = (valor: number) => Math.round((valor / factor) * 100) / 100;

  const encontrado: Record<ClaveLista, number | null> = {
    publico: null,
    profesional: null,
    salon: null,
  };

  for (const clave of CLAVES) {
    const exacta = listas.find((l) => normalizar(l.name ?? "") === NOMBRE_EXACTO[clave]);
    const aproximada = listas.find((l) => {
      const nombre = normalizar(l.name ?? "");
      return PISTAS_LISTA[clave].some((pista) => nombre.includes(pista));
    });
    const lista = exacta ?? aproximada;
    if (lista?.value != null) encontrado[clave] = sinIva(Number(lista.value));
  }

  // Si no se reconoció ninguna, se usa la primera como precio público: es
  // mejor tener un precio de partida que dejar el producto en blanco.
  if (CLAVES.every((c) => encontrado[c] == null)) {
    const primera = listas.find((l) => l.value != null);
    if (primera?.value != null) encontrado.publico = sinIva(Number(primera.value));
  }

  return {
    price_public: encontrado.publico,
    price_professional: encontrado.profesional,
    price_salon: encontrado.salon,
    nombres: listas.map((l) => l.name ?? "(sin nombre)"),
    faltantes: CLAVES.filter((c) => encontrado[c] == null).length,
  };
}

function iva(p: SiigoProduct) {
  const impuesto = p.taxes?.find((t) => String(t.type).toLowerCase().includes("iva")) ?? p.taxes?.[0];
  return {
    tax_id: impuesto ? String(impuesto.id) : null,
    tax_percent: impuesto ? Number(impuesto.percentage) : null,
  };
}

/**
 * Trae el catálogo completo desde Siigo y lo deja en `products`, emparejando
 * por código. Lo importante que instala es `siigo_product_id`: sin él un
 * producto no se puede facturar, por más que exista en la plataforma.
 */
export async function syncProductCatalogAction(): Promise<CatalogSyncResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "ADMIN") {
    return { ok: false, error: "Solo un administrador puede sincronizar el catálogo" };
  }

  const integraciones = await getIntegrationSettings();
  if (!integraciones.siigoEnabled) {
    return {
      ok: false,
      error: "La integración con Siigo está desconectada. Enciéndela arriba antes de sincronizar.",
    };
  }

  let productos: SiigoProduct[];
  const inicio = new Date().toISOString();
  try {
    productos = await listAllSiigoProducts();
  } catch (err) {
    const mensaje =
      err instanceof SiigoApiError
        ? `Siigo respondió ${err.status}: ${err.body.slice(0, 200)}`
        : err instanceof Error
          ? err.message
          : "Error desconocido";
    return { ok: false, error: `No se pudo leer el catálogo de Siigo. ${mensaje}` };
  }

  if (productos.length === 0) {
    return { ok: false, error: "Siigo no devolvió ningún producto." };
  }

  // Escritura con service role: `products` no tiene política de UPDATE, así
  // que desde el cliente un upsert sobre una fila existente no daría error —
  // simplemente no actualizaría nada. Es el mismo camino que ya usa la
  // sincronización de stock.
  const serviceClient = createServiceRoleClient();

  const { data: existentes } = await serviceClient
    .from("products")
    .select("id, code, siigo_product_id");
  const idPorCodigo = new Map((existentes ?? []).map((p) => [p.code as string, p.id as string]));
  // `siigo_product_id` también es único. Si en Siigo le cambian el código a un
  // producto, buscarlo solo por código lo daría por nuevo y el insert chocaría
  // contra products_siigo_id_uniq, tumbando el lote completo. El id de Siigo
  // es el que no cambia, así que manda.
  const idPorSiigo = new Map(
    (existentes ?? []).map((p) => [p.siigo_product_id as string, p.id as string]),
  );

  // El upsert es atómico: un solo producto inservible tumba los cien. Y Postgres
  // además falla con "ON CONFLICT DO UPDATE command cannot affect row a second
  // time" si el mismo código viene dos veces en el lote. Ninguno de los dos
  // errores dice qué producto lo causó, así que se filtran antes.
  const vistos = new Set<string>();
  let descartados = 0;
  let duplicados = 0;
  const utilizables: SiigoProduct[] = [];
  for (const p of productos) {
    if (!p.code || !p.name) {
      descartados++;
      continue;
    }
    if (vistos.has(p.code)) {
      duplicados++;
      continue;
    }
    vistos.add(p.code);
    utilizables.push(p);
  }

  if (utilizables.length === 0) {
    return {
      ok: false,
      error: `Siigo devolvió ${productos.length} productos pero ninguno tiene código y nombre.`,
    };
  }

  const listasVistas = new Set<string>();
  let sinPrecio = 0;
  let conListaIncompleta = 0;
  const filas = utilizables.map((p) => {
    const impuesto = iva(p);
    const { price_public, price_professional, price_salon, nombres, faltantes } = precios(
      p,
      impuesto.tax_percent,
    );
    nombres.forEach((n) => listasVistas.add(n));
    // Que a un producto le falte una lista NO es un fallo de la sincronización:
    // es que en Siigo ese producto no tiene ese precio cargado. Se cuentan por
    // separado para no dar a entender lo contrario en la pantalla.
    if (faltantes === 3) sinPrecio++;
    else if (faltantes > 0) conListaIncompleta++;

    return {
      // Conservar el id existente hace que el upsert sea una actualización de
      // esa fila y no una fila nueva, que rompería las referencias de pedidos.
      ...(() => {
        const existente = idPorSiigo.get(String(p.id)) ?? idPorCodigo.get(p.code);
        return existente ? { id: existente } : {};
      })(),
      siigo_product_id: String(p.id),
      code: p.code,
      name: p.name,
      active: p.active ?? true,
      ...impuesto,
      unit_code: p.unit?.code ?? p.unit_label ?? null,
      price_public,
      price_professional,
      price_salon,
      stock_cache: p.available_quantity ?? null,
      stock_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await serviceClient.from("products").upsert(filas, { onConflict: "code" });
  if (error) {
    return { ok: false, error: `No se pudo guardar el catálogo: ${error.message}` };
  }

  const creados = filas.filter((f) => !("id" in f)).length;

  await serviceClient.from("integration_logs").insert({
    system: "SIIGO",
    operation: "CATALOG_SYNC",
    entity_type: "product",
    status: "SUCCESS",
    started_at: inicio,
    finished_at: new Date().toISOString(),
  });

  // El resumen va a `audit_logs`, que sí tiene un campo libre: saber cuántos
  // productos entraron y con qué listas de precio es justo lo que se consulta
  // cuando los precios salen raros.
  await serviceClient.from("audit_logs").insert({
    user_id: profile.id,
    action: "CATALOG_SYNC",
    entity_type: "product",
    entity_id: profile.id,
    context: {
      total: filas.length,
      creados,
      actualizados: filas.length - creados,
      sin_precio: sinPrecio,
      con_lista_incompleta: conListaIncompleta,
      descartados,
      duplicados,
      listas_de_precio: [...listasVistas],
    },
  });

  return {
    ok: true,
    total: filas.length,
    creados,
    actualizados: filas.length - creados,
    sinPrecio,
    conListaIncompleta,
    descartados,
    duplicados,
    listasDePrecio: [...listasVistas],
  };
}
