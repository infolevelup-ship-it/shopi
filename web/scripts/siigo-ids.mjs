#!/usr/bin/env node
/**
 * Lee de tu cuenta de Siigo los ids que la plataforma necesita para facturar,
 * y escribe el SQL listo para pegar en Supabase.
 *
 * No escribe nada en Siigo: solo consulta. Se puede correr las veces que
 * haga falta.
 *
 * Uso:
 *   SIIGO_USERNAME="..." SIIGO_ACCESS_KEY="..." SIIGO_PARTNER_ID="..." \
 *     node scripts/siigo-ids.mjs
 *
 * O, si ya tienes web/.env.local con esas tres variables:
 *   node --env-file=.env.local scripts/siigo-ids.mjs
 *
 * Requiere Node 18 o superior (usa fetch nativo).
 */

const BASE = "https://api.siigo.com";

// Las formas de pago que ofrece la plataforma. El script intenta emparejarlas
// con las de Siigo por nombre, pero eso es una sugerencia: hay que revisarla.
const FORMAS_DE_PAGO = [
  { clave: "contado", busca: ["contado", "efectivo", "caja"] },
  { clave: "credito_15", busca: ["15"] },
  { clave: "credito_30", busca: ["30"] },
  { clave: "credito_45", busca: ["45"] },
  { clave: "credito_60", busca: ["60"] },
  { clave: "contra_entrega", busca: ["contra entrega", "contraentrega", "contra-entrega"] },
];

function exigirVariable(nombre) {
  const v = process.env[nombre];
  if (!v) {
    console.error(`\n✖ Falta la variable ${nombre}.\n`);
    console.error("Córrelo así:\n");
    console.error(
      '  SIIGO_USERNAME="..." SIIGO_ACCESS_KEY="..." SIIGO_PARTNER_ID="..." node scripts/siigo-ids.mjs\n',
    );
    process.exit(1);
  }
  return v;
}

async function autenticar() {
  const username = exigirVariable("SIIGO_USERNAME");
  const accessKey = exigirVariable("SIIGO_ACCESS_KEY");
  exigirVariable("SIIGO_PARTNER_ID");

  let res;
  try {
    res = await fetch(`${BASE}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, access_key: accessKey }),
    });
  } catch (err) {
    console.error(`\n✖ No se pudo llegar a ${BASE}.`);
    console.error("  Revisa tu conexión a internet, o si estás detrás de una red");
    console.error("  corporativa que bloquee el acceso.");
    console.error(`  Detalle: ${err?.message ?? err}`);
    process.exit(1);
  }

  if (!res.ok) {
    const cuerpo = await res.text().catch(() => "");
    console.error(`\n✖ Siigo rechazó la autenticación (HTTP ${res.status}).`);
    if (res.status === 401) {
      console.error("  Usuario o clave de acceso incorrectos.");
    } else if (res.status === 403) {
      console.error("  Puede ser el Partner-Id, que la cuenta no tenga la API habilitada,");
      console.error("  o una red que bloquee api.siigo.com. La respuesta de abajo lo aclara.");
    }
    if (cuerpo) console.error(`  Respuesta: ${cuerpo.slice(0, 400)}`);
    process.exit(1);
  }

  const data = await res.json();
  if (!data.access_token) {
    console.error("\n✖ Siigo respondió sin access_token. Respuesta completa:");
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }
  return data.access_token;
}

async function consultar(token, ruta) {
  const res = await fetch(`${BASE}${ruta}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "Partner-Id": process.env.SIIGO_PARTNER_ID,
    },
  });
  if (!res.ok) {
    const cuerpo = await res.text().catch(() => "");
    return { error: `HTTP ${res.status}${cuerpo ? ` — ${cuerpo.slice(0, 300)}` : ""}` };
  }
  const data = await res.json();
  // Siigo devuelve unas veces un arreglo pelado y otras {results:[…]}
  return { datos: Array.isArray(data) ? data : (data.results ?? data) };
}

function titulo(texto) {
  console.log(`\n${"─".repeat(72)}\n${texto}\n${"─".repeat(72)}`);
}

function sugerirFormaDePago(formasSiigo) {
  const mapa = {};
  const sinResolver = [];

  for (const { clave, busca } of FORMAS_DE_PAGO) {
    const encontrada = formasSiigo.find((f) => {
      const nombre = String(f.name ?? "").toLowerCase();
      return busca.some((t) => nombre.includes(t));
    });
    if (encontrada) mapa[clave] = encontrada.id;
    else sinResolver.push(clave);
  }
  return { mapa, sinResolver };
}

async function main() {
  console.log("Conectando con Siigo…");
  const token = await autenticar();
  console.log("✔ Autenticación correcta.");

  const [formasPago, impuestos, centrosCosto, usuarios, tiposDocumento] = await Promise.all([
    consultar(token, "/v1/payment-types?document_type=FV"),
    consultar(token, "/v1/taxes"),
    consultar(token, "/v1/cost-centers"),
    consultar(token, "/v1/users"),
    consultar(token, "/v1/document-types?type=FV"),
  ]);

  // ---------------------------------------------------------------- informe
  titulo("FORMAS DE PAGO (facturas de venta)");
  if (formasPago.error) console.log(`No se pudo consultar: ${formasPago.error}`);
  else for (const f of formasPago.datos) console.log(`  ${String(f.id).padEnd(8)} ${f.name}`);

  titulo("IMPUESTOS");
  if (impuestos.error) console.log(`No se pudo consultar: ${impuestos.error}`);
  else
    for (const t of impuestos.datos)
      console.log(`  ${String(t.id).padEnd(8)} ${String(t.percentage).padEnd(6)} ${t.name} (${t.type})`);

  titulo("CENTROS DE COSTO");
  if (centrosCosto.error) console.log(`No se pudo consultar: ${centrosCosto.error}`);
  else
    for (const c of centrosCosto.datos)
      console.log(`  ${String(c.id).padEnd(8)} ${c.name}${c.active === false ? "  (inactivo)" : ""}`);

  titulo("VENDEDORES / USUARIOS");
  if (usuarios.error) console.log(`No se pudo consultar: ${usuarios.error}`);
  else
    for (const u of usuarios.datos)
      console.log(`  ${String(u.id).padEnd(8)} ${[u.first_name, u.last_name].filter(Boolean).join(" ")} — ${u.email ?? ""}`);

  titulo("TIPOS DE DOCUMENTO (factura de venta)");
  if (tiposDocumento.error) console.log(`No se pudo consultar: ${tiposDocumento.error}`);
  else {
    for (const d of tiposDocumento.datos)
      console.log(`  ${String(d.id).padEnd(8)} ${d.name}${d.active === false ? "  (inactivo)" : ""}`);
    // La plataforma tiene 34963 fijo en el código; si aquí sale otro, hay que cambiarlo.
    const esperado = 34963;
    const existe = tiposDocumento.datos.some((d) => Number(d.id) === esperado);
    console.log(
      existe
        ? `\n  ✔ El id ${esperado} que usa la plataforma existe en la cuenta.`
        : `\n  ⚠ La plataforma tiene fijo el id ${esperado} y NO aparece arriba. Hay que corregirlo\n    en web/src/lib/siigo/client.ts (SIIGO_INVOICE_DOCUMENT_TYPE_ID).`,
    );
  }

  // -------------------------------------------------------------------- SQL
  titulo("SQL PARA PEGAR EN SUPABASE (SQL Editor)");

  const lineas = [];

  if (!impuestos.error) {
    // Este sí se puede resolver solo: el % del impuesto es el que trae Siigo.
    const porIva = {};
    for (const t of impuestos.datos) {
      if (String(t.type).toLowerCase().includes("iva")) {
        const pct = String(Number(t.percentage));
        if (!(pct in porIva)) porIva[pct] = t.id;
      }
    }
    lineas.push(
      `insert into app_settings (key, value) values\n  ('siigo_tax_ids', '${JSON.stringify(porIva)}'::jsonb)\non conflict (key) do update set value = excluded.value;`,
    );
  }

  if (!formasPago.error) {
    const { mapa, sinResolver } = sugerirFormaDePago(formasPago.datos);
    lineas.push(
      `-- REVISA ESTE: el emparejamiento es por nombre y puede estar mal.\n` +
        (sinResolver.length
          ? `-- Sin equivalente encontrado: ${sinResolver.join(", ")} — complétalos a mano.\n`
          : "") +
        `insert into app_settings (key, value) values\n  ('siigo_payment_types', '${JSON.stringify(mapa)}'::jsonb)\non conflict (key) do update set value = excluded.value;`,
    );
  }

  if (!centrosCosto.error && centrosCosto.datos.length > 0) {
    const publico = centrosCosto.datos.find((c) => String(c.name).toUpperCase().includes("PUBLICO"));
    lineas.push(
      `-- Opcional. Si no se configura, la plataforma usa 86.\n` +
        `insert into app_settings (key, value) values\n  ('siigo_cost_center', '${publico?.id ?? centrosCosto.datos[0].id}'::jsonb)\non conflict (key) do update set value = excluded.value;`,
    );
  }

  console.log("\n" + lineas.join("\n\n") + "\n");

  titulo("FALTA POR HACER A MANO");
  console.log(`  1. Revisar el emparejamiento de formas de pago de arriba.
  2. Opcional — 'siigo_seller_map': relaciona cada vendedora de WOW con su
     id de vendedor en Siigo. Se arma con los ids de "VENDEDORES" y los de
     la tabla users de la plataforma:

     insert into app_settings (key, value) values
       ('siigo_seller_map', '{"<uuid-de-la-vendedora-en-WOW>": <id-en-siigo>}'::jsonb)
     on conflict (key) do update set value = excluded.value;
`);
}

main().catch((err) => {
  console.error("\n✖ Error inesperado:", err?.message ?? err);
  process.exit(1);
});
