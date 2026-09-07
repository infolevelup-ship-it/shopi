// Al sincronizar el catálogo real aparecieron 450 productos con precio
// profesional de $1 y 458 en salón: marcadores que nadie actualizó en Siigo.
// 293 de ellos tienen existencias, o sea que se pueden vender hoy.
//
// Venderlos a $1 emite una factura electrónica por un peso, y una factura
// electrónica no se corrige: hay que anularla con una nota crédito. Por eso
// la app avisa, aunque no bloquea: puede haber productos que de verdad valgan
// poco, y decidir eso no le toca al software.
export const PRECIO_MINIMO_CREIBLE = 1000;

export function precioSospechoso(precio: number | null | undefined): boolean {
  return precio != null && precio < PRECIO_MINIMO_CREIBLE;
}

type ListasDePrecio = {
  price_public: number | null;
  price_professional: number | null;
  price_salon: number | null;
};

/**
 * El mismo criterio que `catalog_unit_price` en la base, que es quien manda:
 * si la lista elegida no tiene precio, se cae a la pública.
 *
 * Tiene que ser idéntico a propósito. Si la pantalla mostrara un precio y el
 * servidor guardara otro, la vendedora vería un total y el cliente recibiría
 * una factura distinta, sin ningún error de por medio.
 */
export function precioDeLista(p: ListasDePrecio, lista: string | null | undefined): number | null {
  if (lista === "profesional") return p.price_professional ?? p.price_public;
  if (lista === "salon") return p.price_salon ?? p.price_public;
  return p.price_public;
}
