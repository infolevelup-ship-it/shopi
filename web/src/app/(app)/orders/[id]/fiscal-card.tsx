import Link from "next/link";

// doc 11 §64/§65: bodega debe poder verificar los datos fiscales del cliente
// sin salir del pedido, con un indicador claro de qué está completo y qué hay
// que revisar. Los checks son los datos que Siigo necesita para emitir la
// factura — si falta alguno, la facturación va a fallar, y es mejor verlo
// aquí que en el error de la API.
type FiscalCustomer = {
  id: string;
  legal_name: string | null;
  first_name: string | null;
  last_name: string | null;
  commercial_name: string | null;
  document_type: string | null;
  document_number: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  fiscal_responsibility: string | null;
  siigo_customer_id: string | null;
};

function Field({ label, value }: { label: string; value: string | null }) {
  const ok = !!value && value.trim() !== "";
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line py-2 last:border-b-0">
      <dt className="text-text-soft">{label}</dt>
      <dd className={`text-right ${ok ? "text-text" : "font-medium text-warning"}`}>
        {ok ? value : "⚠ falta"}
      </dd>
    </div>
  );
}

export function FiscalCard({ customer }: { customer: FiscalCustomer }) {
  const required = [
    customer.document_type,
    customer.document_number,
    customer.city,
    customer.address,
  ];
  const missing = required.filter((v) => !v || v.trim() === "").length;

  return (
    <section className="card card-pad">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Datos fiscales del cliente</h2>
        <span className={`badge ${missing === 0 ? "badge-success" : "badge-warning"}`}>
          {missing === 0 ? "Completo" : `Revisar (${missing})`}
        </span>
      </div>

      <dl className="text-sm">
        <Field
          label="Nombre / Razón social"
          value={
            customer.commercial_name ??
            customer.legal_name ??
            `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
          }
        />
        <Field
          label="Identificación"
          value={
            customer.document_type && customer.document_number
              ? `${customer.document_type} ${customer.document_number}`
              : null
          }
        />
        <Field label="Ciudad" value={customer.city} />
        <Field label="Dirección" value={customer.address} />
        <Field label="Correo" value={customer.email} />
        <Field label="Teléfono" value={customer.phone} />
        <Field label="Responsabilidad fiscal" value={customer.fiscal_responsibility} />
        {/* doc 11 §28: el estado de Siigo se muestra, el ID técnico no */}
        <div className="flex items-center justify-between gap-3 py-2">
          <dt className="text-text-soft">Siigo</dt>
          <dd>
            {customer.siigo_customer_id ? (
              <span className="badge badge-success">Sincronizado</span>
            ) : (
              <span className="badge badge-warning">Sin sincronizar</span>
            )}
          </dd>
        </div>
      </dl>

      <Link
        href={`/customers/${customer.id}`}
        className="btn btn-secondary btn-sm btn-block-mobile mt-3"
      >
        Ver ficha del cliente
      </Link>
    </section>
  );
}
