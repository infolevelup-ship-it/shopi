"use server";

import { createClient } from "@/lib/supabase/server";

export type CompanyProfile = {
  name: string;
  document: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
};

// Datos de la empresa para el encabezado de los documentos impresos. Viven en
// `app_settings` (clave `company_profile`), que todavía no está configurada:
// mientras tanto se imprime solo el nombre, que es honesto — es preferible una
// hoja sin NIT a una hoja con un NIT inventado.
const FALLBACK: CompanyProfile = {
  name: "Productos WOW",
  document: null,
  address: null,
  city: null,
  phone: null,
  email: null,
};

export async function getCompanyProfile(): Promise<CompanyProfile> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "company_profile")
    .maybeSingle();

  const raw = data?.value;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return FALLBACK;

  const v = raw as Record<string, unknown>;
  const text = (k: string) => (typeof v[k] === "string" && v[k] ? (v[k] as string) : null);

  return {
    name: text("name") ?? FALLBACK.name,
    document: text("document"),
    address: text("address"),
    city: text("city"),
    phone: text("phone"),
    email: text("email"),
  };
}
