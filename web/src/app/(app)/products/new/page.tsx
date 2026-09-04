import { getCurrentProfile } from "@/lib/auth";
import { NewProductForm } from "./product-form";
import { Callout, PageHeader } from "@/components/ui";

export default async function NewProductPage() {
  const profile = await getCurrentProfile();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={{ href: "/products", label: "Productos" }} title="Nuevo producto" />

      {profile?.role !== "ADMIN" ? (
        <Callout tone="danger" title="Solo administradores">
          El catálogo se sincroniza desde Siigo; crear productos a mano es una función de
          administrador mientras esa integración no esté conectada (doc 05 §5).
        </Callout>
      ) : (
        <NewProductForm />
      )}
    </div>
  );
}
