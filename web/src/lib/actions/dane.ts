"use server";

import { createClient } from "@/lib/supabase/server";

export type DaneLocation = {
  city_code: string;
  city_name: string;
  state_code: string;
  department: string;
};

// El catálogo completo son los ~1123 municipios de Colombia (DIVIPOLA,
// migración 0041) — se trae entero una vez en el servidor y el formulario
// filtra ciudades por departamento en el navegador. Pedir las ciudades al
// servidor cada vez que cambia el departamento sería una llamada de red por
// cada clic, sobre un catálogo que de todos modos cabe en unos pocos
// cientos de kilobytes.
//
// Confirmado 2026-09-29 (reportado por el equipo: no encontraban "Cartago,
// Valle del Cauca"): Supabase/PostgREST corta cualquier `select` en 1000
// filas si no se pagina explícitamente, sin importar el `.order()`. Con las
// ~140 filas del catálogo viejo nunca se notó; con las 1123 del catálogo
// completo, el corte cae a mitad del departamento "Sucre" (orden
// alfabético) — todo lo que viene después (resto de Sucre, Tolima, Valle
// del Cauca completo, Vaupés, Vichada) nunca llegaba al formulario. Por eso
// se pagina en páginas de 1000 hasta que una página vuelve incompleta.
const PAGE_SIZE = 1000;

export async function listDaneLocations(): Promise<DaneLocation[]> {
  const supabase = await createClient();
  const all: DaneLocation[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("dane_locations")
      .select("city_code, city_name, state_code, department")
      .order("department", { ascending: true })
      .order("city_name", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`No se pudo cargar el catálogo DANE: ${error.message}`);
    all.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}
