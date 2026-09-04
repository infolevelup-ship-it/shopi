"use server";

import { createClient } from "@/lib/supabase/server";

export type DaneLocation = {
  city_code: string;
  city_name: string;
  state_code: string;
  department: string;
};

// El catálogo completo son ~140 filas: se trae entero una vez en el servidor
// y el formulario filtra ciudades por departamento en el navegador. Pedir las
// ciudades al servidor cada vez que cambia el departamento sería una llamada
// de red por cada clic, sobre un catálogo que cabe en un par de kilobytes.
export async function listDaneLocations(): Promise<DaneLocation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dane_locations")
    .select("city_code, city_name, state_code, department")
    .order("department", { ascending: true })
    .order("city_name", { ascending: true });

  if (error) throw new Error(`No se pudo cargar el catálogo DANE: ${error.message}`);
  return data ?? [];
}
