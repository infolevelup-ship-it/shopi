import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { getProductsByIds } from "@/lib/actions/products";
import { OrderForm, type OrderFormLine } from "@/components/order-form";
import type { PriceList } from "@/lib/ui/fiscal";
import { EDITABLE_ORDER_STATUSES } from "@/lib/ui/status";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: order }, profile] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, status, seller_id, channel, price_list, payment_method, payment_method_detail, sale_origin, retention_percent, notes, customer:customers(id, customer_type, document_type, document_number, legal_name, first_name, last_name, commercial_name, phone, status, responsible_user_id)",
      )
      .eq("id", id)
      .maybeSingle(),
    getCurrentProfile(),
  ]);

  if (!order) notFound();

  // Las mismas dos condiciones que aplica `update_order` en la base. Si no
  // coinciden, la pantalla dejaría escribir un formulario que el servidor va a
  // rechazar al guardar.
  const canEdit =
    !!profile &&
    (profile.id === order.seller_id ||
      profile.role === "SUPERVISOR" ||
      profile.role === "ADMIN") &&
    EDITABLE_ORDER_STATUSES.includes(order.status);

  if (!canEdit) redirect(`/orders/${id}`);

  const { data: items } = await supabase
    .from("order_items")
    .select("product_id, product_code_snapshot, product_name_snapshot, quantity, unit_price, discount_percent")
    .eq("order_id", id)
    .order("created_at", { ascending: true });

  // `order_items` guarda el precio con el que se vendió, no las tres listas;
  // se traen los productos para que cambiar de lista siga re-tarifando.
  const productIds = (items ?? []).map((i) => i.product_id).filter((v): v is string => !!v);
  const products = await getProductsByIds([...new Set(productIds)]);
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines: OrderFormLine[] = (items ?? [])
    .filter((i) => i.product_id)
    .map((i) => {
      const p = byId.get(i.product_id!);
      return {
        productId: i.product_id!,
        name: i.product_name_snapshot ?? p?.name ?? "",
        code: i.product_code_snapshot ?? p?.code ?? "",
        stock: p?.stock_cache ?? null,
        prices: {
          publico: p?.price_public ?? null,
          profesional: p?.price_professional ?? null,
          salon: p?.price_salon ?? null,
        },
        quantity: Number(i.quantity),
        unitPrice: Number(i.unit_price),
        discountPercent: Number(i.discount_percent ?? 0),
      };
    });

  const customer = Array.isArray(order.customer) ? order.customer[0] : order.customer;

  return (
    <OrderForm
      mode="edit"
      orderId={order.id}
      initial={{
        customer: customer
          ? { ...customer, responsible_name: null }
          : null,
        lines,
        channel: order.channel === "B2C" ? "B2C" : "B2B",
        priceList: (order.price_list as PriceList | null) ?? "salon",
        paymentMethod: order.payment_method ?? "contado",
        paymentDetail: order.payment_method_detail ?? "",
        saleOrigin: order.sale_origin ?? "",
        retentionPercent: Number(order.retention_percent ?? 0),
        notes: order.notes ?? "",
      }}
    />
  );
}
