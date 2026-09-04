import { listDaneLocations } from "@/lib/actions/dane";
import { PageHeader } from "@/components/ui";
import { NewCustomerForm } from "./customer-form";

// El catálogo DANE se carga en el servidor y viaja una sola vez con la
// página: son ~140 filas y el formulario las necesita completas desde el
// primer render para poder llenar los selectores de departamento y ciudad.
export default async function NewCustomerPage() {
  const locations = await listDaneLocations();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={{ href: "/customers", label: "Clientes" }}
        title="Nuevo cliente"
        subtitle="Los datos marcados como fiscales son los que Siigo exige para poder facturar."
      />
      <NewCustomerForm locations={locations} />
    </div>
  );
}
