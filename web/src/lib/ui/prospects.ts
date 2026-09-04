// Catálogos del embudo de prospectos (doc 01 §12).

import type { Database } from "@/lib/supabase/database.types";

export type ProspectStage = Database["public"]["Enums"]["prospect_stage"];

// Las etapas que una visita puede fijar. WON y LOST quedan fuera a propósito:
// son cierres, y cada uno tiene su propia acción porque exige datos que una
// visita no pide (el cliente creado, el motivo de la pérdida).
export const PROSPECT_STAGE_FLOW: ProspectStage[] = [
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "QUOTE",
  "NEGOTIATION",
];

export const PROSPECT_VISIT_TYPES = [
  { value: "visita", label: "Visita presencial" },
  { value: "llamada", label: "Llamada" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "correo", label: "Correo" },
];

// doc 01 §12 fija estos motivos iniciales y dice que la lista debe ser
// configurable; por ahora vive aquí, igual que el resto de catálogos.
export const PROSPECT_LOST_REASONS = [
  "Precio",
  "Falta de presupuesto",
  "Competencia",
  "No responde",
  "Producto no disponible",
  "Otro",
];

export const PROSPECT_SOURCES = [
  { value: "visita_calle", label: "Visita en frío" },
  { value: "feria", label: "Feria o evento" },
  { value: "referido", label: "Referido" },
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "otro", label: "Otro" },
];
