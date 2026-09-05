import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { listDaneLocations } from "@/lib/actions/dane";
import { PageHeader } from "@/components/ui";
import { NewCustomerForm } from "../../new/customer-form";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: c }, profile, locations] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    getCurrentProfile(),
    listDaneLocations(),
  ]);

  if (!c) notFound();

  // Las mismas condiciones que aplica `update_customer` en la base. Si no
  // coinciden, la pantalla dejaría llenar un formulario que el servidor va a
  // rechazar al guardar.
  const puedeEditar =
    !!profile &&
    (profile.role === "SUPERVISOR" ||
      profile.role === "ADMIN" ||
      c.responsible_user_id === null ||
      c.responsible_user_id === profile.id);

  if (!puedeEditar) redirect(`/customers/${id}`);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={{ href: `/customers/${id}`, label: "Cliente" }}
        title="Editar cliente"
        subtitle="Los datos fiscales son los que Siigo usa para facturar."
      />
      <NewCustomerForm
        locations={locations}
        editing={{
          id: c.id,
          source: c.source,
          siigoCustomerId: c.siigo_customer_id,
          values: {
            customerType: c.customer_type === "juridica" ? "juridica" : "natural",
            documentType: c.document_type,
            documentNumber: c.document_number,
            checkDigit: c.check_digit ?? "",
            // El DV se muestra tal cual está guardado, sin recalcularlo: si el
            // NIT real trae uno distinto al del algoritmo, es el guardado el
            // que Siigo tiene registrado.
            checkDigitManual: true,
            legalName: c.legal_name ?? "",
            firstName: c.first_name ?? "",
            lastName: c.last_name ?? "",
            commercialName: c.commercial_name ?? "",
            branchCode: c.branch_code ?? "",
            department: c.department ?? "",
            cityCode: c.city_code ?? "",
            address: c.address ?? "",
            postalCode: c.postal_code ?? "",
            phoneIndicative: c.phone_indicative ?? "",
            phone: c.phone ?? "",
            phoneExtension: c.phone_extension ?? "",
            contactFirstName: c.contact_first_name ?? "",
            contactLastName: c.contact_last_name ?? "",
            contactEmail: c.contact_email ?? "",
            contactIndicative: c.contact_indicative ?? "",
            contactPhone: c.contact_phone ?? "",
            email: c.email ?? "",
            birthday: c.birthday ?? "",
            websiteSocial: c.website_social ?? "",
            vatResponsible: c.vat_responsible ? "true" : "false",
            fiscalResponsibilities:
              c.fiscal_responsibilities ??
              (c.fiscal_responsibility ? [c.fiscal_responsibility] : ["R-99-PN"]),
            purchaseType: c.purchase_type ?? "contado",
            customerTypeClassification: c.customer_type_classification ?? "",
            channel: c.channel ?? "B2B",
            creditLimit: c.credit_limit != null ? String(c.credit_limit) : "",
          },
        }}
      />
    </div>
  );
}
