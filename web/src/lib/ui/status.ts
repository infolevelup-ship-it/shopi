// Fuente única de verdad de cómo se ve y qué significa cada estado en toda la
// app (doc 11 §94: un mismo concepto se ve igual en todas las pantallas; §95:
// cada estado de pedido debe decir qué significa y quién es el responsable).
// Antes cada pantalla pintaba los estados a su manera y con textos distintos.

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "purple";

export type StatusMeta = {
  label: string;
  tone: Tone;
  /** Qué significa en una frase — se usa como title/tooltip y en el detalle. */
  meaning?: string;
  /** De quién es la pelota ahora mismo. */
  owner?: string;
};

const ORDER: Record<string, StatusMeta> = {
  DRAFT: {
    label: "Borrador",
    tone: "neutral",
    meaning: "Todavía no se envió a bodega. Solo lo ve quien lo está armando.",
    owner: "Vendedora",
  },
  SUBMITTED: {
    label: "Enviado a bodega",
    tone: "info",
    meaning: "Está en la cola de bodega, nadie lo ha abierto todavía.",
    owner: "Bodega",
  },
  PENDING_REVIEW: {
    label: "Pendiente de revisión",
    tone: "info",
    meaning: "En espera de que bodega lo revise.",
    owner: "Bodega",
  },
  IN_REVIEW: {
    label: "En revisión",
    tone: "warning",
    meaning: "Bodega lo abrió y está verificando cliente, productos y stock.",
    owner: "Bodega",
  },
  RETURNED_TO_SELLER: {
    label: "Devuelto a vendedora",
    tone: "danger",
    meaning: "Bodega encontró algo que corregir. No avanza hasta que se corrija.",
    owner: "Vendedora",
  },
  APPROVED_FOR_INVOICE: {
    label: "Aprobado para facturar",
    tone: "success",
    meaning: "Bodega lo verificó. Listo para que se genere la factura en Siigo.",
    owner: "Bodega / Admin",
  },
  INVOICING: {
    label: "Facturando",
    tone: "warning",
    meaning:
      "Se está generando la factura fiscal. No lo vuelvas a facturar: puede terminar en una factura duplicada.",
    owner: "Sistema",
  },
  INVOICED: {
    label: "Facturado",
    tone: "success",
    meaning: "La factura electrónica ya existe en Siigo.",
    owner: "Bodega",
  },
  READY_FOR_DISPATCH: {
    label: "Listo para despacho",
    tone: "info",
    meaning: "Facturado y listo para empacar/enviar.",
    owner: "Bodega",
  },
  DISPATCHED: {
    label: "Despachado",
    tone: "info",
    meaning: "Salió de bodega hacia el cliente.",
    owner: "Transportadora",
  },
  DELIVERED: {
    label: "Entregado",
    tone: "success",
    meaning: "El cliente recibió el pedido. Estado final.",
    owner: "—",
  },
  CANCELLED: {
    label: "Cancelado",
    tone: "neutral",
    meaning: "Se canceló con motivo registrado. Nunca se borra, queda la traza.",
    owner: "—",
  },
  BLOCKED: {
    label: "Bloqueado",
    tone: "danger",
    meaning: "No puede avanzar hasta que alguien resuelva el bloqueo.",
    owner: "Supervisor",
  },
};

const QUOTE: Record<string, StatusMeta> = {
  DRAFT: { label: "Borrador", tone: "neutral" },
  SENT: { label: "Enviada", tone: "info" },
  FOLLOW_UP: { label: "En seguimiento", tone: "warning" },
  ACCEPTED: { label: "Aceptada", tone: "success" },
  CONVERTED: { label: "Convertida en pedido", tone: "purple" },
  LOST: { label: "Perdida", tone: "danger" },
  EXPIRED: { label: "Vencida", tone: "neutral" },
  CANCELLED: { label: "Cancelada", tone: "neutral" },
  LEGACY_IMPORTED: { label: "Importada del sistema anterior", tone: "neutral" },
};

const CUSTOMER: Record<string, StatusMeta> = {
  PROSPECT: { label: "Prospecto", tone: "purple" },
  ACTIVE: { label: "Activo", tone: "success" },
  INACTIVE: { label: "Inactivo", tone: "neutral" },
  RECOVERY: { label: "En recuperación", tone: "warning" },
  BLOCKED: { label: "Bloqueado", tone: "danger" },
};

const INVOICE: Record<string, StatusMeta> = {
  PENDING: { label: "Pendiente", tone: "neutral" },
  PROCESSING: { label: "Procesando", tone: "warning" },
  ISSUED: { label: "Emitida", tone: "success" },
  // doc 11 §44/§87: "incierto" es un estado propio y visible, nunca se
  // muestra como éxito ni como error.
  UNCERTAIN: { label: "Verificando", tone: "warning" },
  ERROR_RETRYABLE: { label: "Error (reintentable)", tone: "danger" },
  ERROR_FINAL: { label: "Error", tone: "danger" },
  HISTORICAL: { label: "Histórica", tone: "neutral" },
};

const FOLLOW_UP: Record<string, StatusMeta> = {
  PENDING: { label: "Pendiente", tone: "info" },
  COMPLETED: { label: "Completado", tone: "success" },
  OVERDUE: { label: "Vencido", tone: "danger" },
  CANCELLED: { label: "Cancelado", tone: "neutral" },
};

// doc 01 §12: el embudo del prospecto, con el mismo criterio de color que el
// resto de la app.
const PROSPECT: Record<string, StatusMeta> = {
  NEW: { label: "Nuevo", tone: "neutral", meaning: "Todavía no se ha contactado." },
  CONTACTED: { label: "Contactado", tone: "info", meaning: "Ya hubo un primer contacto." },
  INTERESTED: { label: "Interesado", tone: "info", meaning: "Mostró interés real en comprar." },
  QUOTE: { label: "Cotizado", tone: "warning", meaning: "Se le pasó una cotización." },
  NEGOTIATION: { label: "En negociación", tone: "warning", meaning: "Discutiendo precio o condiciones." },
  WON: { label: "Ganado", tone: "success", meaning: "Se convirtió en cliente." },
  LOST: { label: "Perdido", tone: "danger", meaning: "No va a comprar; queda el motivo registrado." },
};

const REGISTRY = {
  order: ORDER,
  quote: QUOTE,
  customer: CUSTOMER,
  invoice: INVOICE,
  followUp: FOLLOW_UP,
  prospect: PROSPECT,
} as const;

export type StatusKind = keyof typeof REGISTRY;

export function statusMeta(kind: StatusKind, status: string): StatusMeta {
  return REGISTRY[kind][status] ?? { label: status, tone: "neutral" };
}

export const ROLE_LABEL: Record<string, string> = {
  SELLER: "Vendedora",
  WAREHOUSE: "Bodega",
  SUPERVISOR: "Supervisor",
  ADMIN: "Administrador",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  contado: "Contado",
  credito_15: "Crédito 15 días",
  credito_30: "Crédito 30 días",
  credito_45: "Crédito 45 días",
  credito_60: "Crédito 60 días",
  contra_entrega: "Contra entrega",
};
