import { listDaneLocations } from "@/lib/actions/dane";
import { getProspect } from "@/lib/actions/prospects";
import { PageHeader } from "@/components/ui";
import { NewCustomerForm } from "./customer-form";

// El catálogo DANE se carga en el servidor y viaja una sola vez con la
// página: son ~140 filas y el formulario las necesita completas desde el
// primer render para poder llenar los selectores de departamento y ciudad.
export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ prospecto?: string }>;
}) {
  const [{ prospecto }, locations] = await Promise.all([searchParams, listDaneLocations()]);

  // Llegando desde un prospecto: se traen los datos que ya se conocen para no
  // pedirlos otra vez, y al guardar el prospecto queda cerrado como ganado.
  const source = prospecto ? await getProspect(prospecto) : null;
  const fromProspect = source
    ? {
        id: source.prospect.id,
        name: source.prospect.name,
        commercialName: source.prospect.commercialName,
        phone: source.prospect.phone,
        email: source.prospect.email,
        city: source.prospect.city,
      }
    : null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={
          fromProspect
            ? { href: `/prospects/${fromProspect.id}`, label: "Prospecto" }
            : { href: "/customers", label: "Clientes" }
        }
        title={fromProspect ? `Convertir “${fromProspect.commercialName ?? fromProspect.name}” en cliente` : "Nuevo cliente"}
        subtitle="Los datos marcados como fiscales son los que Siigo exige para poder facturar."
      />
      <NewCustomerForm locations={locations} fromProspect={fromProspect} />
    </div>
  );
}
