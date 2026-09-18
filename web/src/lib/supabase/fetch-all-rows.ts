import "server-only";

// PostgREST corta cualquier select en 1000 filas si no se pide un rango
// explícito, y lo hace en silencio: responde 200 OK con menos filas de las
// que hay, sin error ni aviso. Con una tabla de menos de 1000 filas nunca se
// nota — hasta que crece. Eso fue exactamente lo que rompió la
// sincronización del catálogo de productos: un select sin `.range()` sobre
// 1761 productos traía solo ~1000, y el resto se trataba como si no
// existiera.
//
// Cualquier lugar que necesite "todas las filas de la tabla" para construir
// un mapa de existencia (¿ya existe este código/documento/id?) antes de un
// upsert masivo tiene que pasar por aquí. Un `.select()` suelto vuelve a
// abrir la misma puerta, solo que en otra tabla y más adelante.
export async function fetchAllRows<T>(
  fetchPage: (
    desde: number,
    hasta: number,
  ) => Promise<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += pageSize) {
    const { data, error } = await fetchPage(desde, desde + pageSize - 1);
    if (error) throw new Error(error.message);
    filas.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return filas;
}
