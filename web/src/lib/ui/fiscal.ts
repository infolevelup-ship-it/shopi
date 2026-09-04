// Catálogos del formulario legado de "WOW · Pedidos B2B", traídos a la
// plataforma. Están aquí y no repetidos en cada pantalla porque el mismo
// valor lo escribe el formulario de cliente, lo lee la ficha del cliente y
// lo va a leer el servicio de facturación de Siigo: si cada pantalla usara
// su propia lista, la base terminaría con "Salón", "salon" y "SALÓN" como
// tres cosas distintas.

export type Option = { value: string; label: string };

export const DOCUMENT_TYPES: Option[] = [
  { value: "NIT", label: "NIT" },
  { value: "CC", label: "Cédula de ciudadanía" },
  { value: "CE", label: "Cédula de extranjería" },
  { value: "PAS", label: "Pasaporte" },
  { value: "TI", label: "Tarjeta de identidad" },
];

// Códigos DIAN tal como los espera Siigo en `fiscal_responsibilities`.
export const FISCAL_RESPONSIBILITIES: Option[] = [
  { value: "R-99-PN", label: "R-99-PN · No responsable de IVA" },
  { value: "O-13", label: "O-13 · Gran contribuyente" },
  { value: "O-15", label: "O-15 · Autorretenedor" },
  { value: "O-23", label: "O-23 · Agente de retención de IVA" },
  { value: "O-47", label: "O-47 · Régimen simple de tributación" },
];

export const PURCHASE_TYPES: Option[] = [
  { value: "contado", label: "De contado" },
  { value: "credito", label: "A crédito" },
];

export const CUSTOMER_CLASSIFICATIONS: Option[] = [
  { value: "salon", label: "Salón de belleza" },
  { value: "peluqueria", label: "Peluquería" },
  { value: "barberia", label: "Barbería" },
  { value: "spa", label: "Spa / centro estético" },
  { value: "estilista", label: "Estilista independiente" },
  { value: "distribuidor", label: "Distribuidor" },
  { value: "consumidor_final", label: "Consumidor final" },
];

export const CHANNELS: Option[] = [
  { value: "B2B", label: "B2B · Salones y profesionales" },
  { value: "B2C", label: "B2C · Consumidor final" },
];

// Las tres listas de precio de `products`. El `field` es la columna real,
// para que la pantalla de pedido pueda re-tarifar sin un mapa aparte.
export const PRICE_LISTS = [
  { value: "publico", label: "Público", field: "price_public" },
  { value: "profesional", label: "Profesional", field: "price_professional" },
  { value: "salon", label: "Salón", field: "price_salon" },
] as const;

export type PriceList = (typeof PRICE_LISTS)[number]["value"];

// Por dónde entró la plata. Solo tiene sentido para pagos de contado; a
// crédito todavía no ha entrado nada.
export const PAYMENT_DETAILS: Option[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia bancaria" },
  { value: "datafono", label: "Datáfono" },
  { value: "nequi", label: "Nequi" },
  { value: "daviplata", label: "Daviplata" },
  { value: "otro", label: "Otro" },
];

// De dónde salió la venta. Es solo para reportes: nunca afecta la factura.
export const SALE_ORIGINS: Option[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "llamada", label: "Llamada" },
  { value: "visita", label: "Visita presencial" },
  { value: "instagram", label: "Instagram" },
  { value: "feria", label: "Feria o evento" },
  { value: "referido", label: "Referido" },
  { value: "otro", label: "Otro" },
];

export function labelOf(options: Option[], value: string | null | undefined) {
  if (!value) return null;
  return options.find((o) => o.value === value)?.label ?? value;
}

// Dígito de verificación del NIT (algoritmo DIAN). Se calcula solo y se deja
// editar: hay NIT viejos en circulación con el DV mal impreso, y Siigo
// rechaza la factura si no coincide con el que ellos tienen registrado.
const DV_WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

export function nitCheckDigit(documentNumber: string): string | null {
  const digits = documentNumber.replace(/\D/g, "");
  if (digits.length === 0 || digits.length > DV_WEIGHTS.length) return null;

  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    // los pesos se aplican de derecha a izquierda
    sum += Number(digits[digits.length - 1 - i]) * DV_WEIGHTS[i];
  }
  const rest = sum % 11;
  return String(rest > 1 ? 11 - rest : rest);
}
