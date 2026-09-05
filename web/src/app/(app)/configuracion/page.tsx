import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getIntegrationSettings } from "@/lib/actions/integrations";
import { PageHeader } from "@/components/ui";
import { IntegrationPanel } from "./integration-panel";

export default async function ConfiguracionPage() {
  const profile = await getCurrentProfile();
  // Estos interruptores cortan la facturación de toda la empresa: solo admin.
  if (!profile || profile.role !== "ADMIN") redirect("/");

  const settings = await getIntegrationSettings();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Configuración"
        subtitle="Control de la integración con Siigo. Los cambios tienen efecto de inmediato, sin redesplegar."
      />
      <IntegrationPanel settings={settings} />
    </div>
  );
}
