# WOW SALES — 02. MODELO DE DATOS SUPABASE

## Propósito

Definir la estructura de datos que permitirá que WOW Sales sea la fuente operativa principal de la empresa.

## 1. Principios

- UUID para IDs internos.
- IDs externos de Siigo y GHL separados de los IDs internos.
- Nunca usar nombres como claves de relación.
- Los hechos históricos importantes deben conservarse.
- Los pedidos guardan snapshots de producto/precio.
- Las facturas son registros fiscales inmutables.
- Las acciones críticas tienen historial y auditoría.
- La base debe soportar 4 vendedoras inicialmente y crecer sin rediseño.
- Las consultas de clientes/productos deben ser rápidas.
- RLS y permisos de backend son obligatorios.

## 2. Entidades principales

```text
users
customers
customer_assignments
customer_activities
prospects
products
quotes
quote_items
orders
order_items
order_status_history
order_reviews
payments
attachments
invoices
invoice_operations
follow_ups
shipments
audit_logs
integration_logs
sync_jobs
app_settings
```

## 3. Users

Campos:

```text
id uuid PK
auth_user_id uuid UNIQUE
name text
email text UNIQUE
phone text
role enum
active boolean
ghl_user_id text nullable
seller_code text nullable
branch_code text nullable
last_login_at timestamptz
created_at timestamptz
updated_at timestamptz
```

Roles:

```text
SELLER
WAREHOUSE
SUPERVISOR
ADMIN
```

Un usuario inactivo no puede ejecutar operaciones nuevas.

## 4. Customers

Campos:

```text
id
customer_type
document_type
document_number
document_number_normalized
check_digit
legal_name
first_name
last_name
commercial_name
email
phone
secondary_phone
address
department
city
state_code
city_code
postal_code
fiscal_responsibility
vat_responsible
purchase_type
customer_type_classification
channel
credit_limit
website_social
siigo_customer_id
ghl_contact_id
status
responsible_user_id
source
is_duplicate_candidate
merged_into_customer_id
last_purchase_at
last_contact_at
created_at
updated_at
```

Estados:

```text
PROSPECT
ACTIVE
INACTIVE
RECOVERY
BLOCKED
```

### Reglas

- No usar nombre como identificador.
- Normalizar documento.
- Detectar duplicados antes de insertar.
- Un cliente puede tener un responsable comercial principal.
- Un cliente puede tener apoyo temporal sin perder propietario.

## 5. Customer assignments

```text
id
customer_id
user_id
assignment_type
start_at
end_at
active
reason
assigned_by
created_at
```

Tipos:

```text
PRIMARY_OWNER
TEMPORARY_SUPPORT
```

Debe existir máximo un propietario primario activo.

## 6. Customer activities

```text
id
customer_id
user_id
activity_type
description
reference_type
reference_id
activity_at
created_at
```

Tipos:

```text
CALL
WHATSAPP
EMAIL
VISIT
NOTE
QUOTE_CREATED
QUOTE_SENT
QUOTE_WON
QUOTE_LOST
ORDER_CREATED
ORDER_UPDATED
INVOICE_CREATED
SHIPMENT
FOLLOW_UP
OTHER
```

## 7. Prospects

```text
id
customer_id nullable
name
commercial_name
phone
email
city
user_id
stage
first_visit_at
last_visit_at
next_follow_up_at
notes
source
lost_reason
converted_at
created_at
updated_at
```

Estados:

```text
NEW
CONTACTED
INTERESTED
QUOTE
NEGOTIATION
WON
LOST
```

## 8. Products

```text
id
siigo_product_id
code
name
brand
description
active
tax_id
tax_percent
unit_code
price_public
price_professional
price_salon
stock_cache
stock_updated_at
created_at
updated_at
```

Índices:

```text
code
lower(name)
lower(brand)
siigo_product_id
active
```

## 9. Quotes

```text
id
quote_number
customer_id
seller_id
status
source_type
price_list
subtotal
discount_total
tax_total
retention_total
grand_total
valid_until
notes
sent_at
accepted_at
lost_at
converted_order_id
lost_reason
created_at
updated_at
```

Estados:

```text
DRAFT
SENT
FOLLOW_UP
ACCEPTED
CONVERTED
LOST
EXPIRED
CANCELLED
```

### quote_items

```text
id
quote_id
product_id
product_code_snapshot
product_name_snapshot
quantity
unit_price
discount_percent
discount_value
tax_id
tax_percent
line_subtotal
line_tax
line_total
created_at
updated_at
```

## 10. Orders

```text
id
order_number
customer_id
seller_id
responsible_customer_owner_id
source_type
channel
status
document_type
price_list
payment_method
payment_method_detail
subtotal_gross
discount_total
subtotal_net
tax_total
retention_total
grand_total
notes
ghl_opportunity_id
siigo_invoice_id
invoice_number
warehouse_reviewed_by
approved_by
invoiced_by
dispatched_by
created_at
submitted_at
review_started_at
approved_at
invoicing_started_at
invoiced_at
dispatched_at
delivered_at
cancelled_at
updated_at
```

`source_type`:

```text
LIVE
HISTORICAL
IMPORTED
```

`status`:

```text
DRAFT
SUBMITTED
PENDING_REVIEW
IN_REVIEW
RETURNED_TO_SELLER
APPROVED_FOR_INVOICE
INVOICING
INVOICED
READY_FOR_DISPATCH
DISPATCHED
DELIVERED
CANCELLED
BLOCKED
```

## 11. Order items

```text
id
order_id
product_id
product_code_snapshot
product_name_snapshot
quantity
unit_price
discount_percent
discount_value
tax_id
tax_percent
unit_code
siigo_product_id
line_subtotal
line_tax
line_total
created_at
updated_at
```

Nunca depender del precio actual del catálogo para reconstruir un pedido antiguo.

## 12. Order status history

```text
id
order_id
from_status
to_status
changed_by
reason
metadata
created_at
```

## 13. Order reviews

```text
id
order_id
reviewed_by
customer_ok
products_ok
quantities_ok
prices_ok
inventory_ok
payment_ok
receipts_ok
fiscal_data_ok
printed_receipt
status
notes
reviewed_at
created_at
```

Estados:

```text
PENDING
APPROVED
RETURNED
```

## 14. Payments

```text
id
order_id
payment_method
amount
payment_date
reference
status
created_by
created_at
```

## 15. Attachments

```text
id
entity_type
entity_id
storage_path
original_filename
mime_type
size_bytes
checksum
uploaded_by
created_at
```

El máximo actual de comprobantes por pedido es 3.

## 16. Invoices

```text
id
order_id
customer_id
siigo_invoice_id
invoice_number
invoice_status
siigo_status
total
invoice_date
issued_by
response_reference
created_at
updated_at
```

Estados:

```text
PENDING
PROCESSING
ISSUED
UNCERTAIN
ERROR_RETRYABLE
ERROR_FINAL
```

Debe existir como máximo una factura activa por pedido.

## 17. Invoice operations

```text
id
order_id
idempotency_key UNIQUE
status
attempt_count
request_started_at
response_received_at
siigo_invoice_id
error_code
error_message
last_attempt_at
created_at
updated_at
```

Su función es proteger la operación fiscal contra duplicaciones por reintentos, doble clic y respuestas inciertas.

## 18. Follow ups

```text
id
customer_id
seller_id
type
priority
scheduled_at
completed_at
status
reason
result
notes
created_at
updated_at
```

Estados:

```text
PENDING
COMPLETED
OVERDUE
CANCELLED
```

## 19. Shipments

```text
id
order_id
status
dispatched_by
dispatched_at
delivery_confirmed_at
notes
created_at
updated_at
```

## 20. Audit logs

```text
id
user_id
action
entity_type
entity_id
before_data
after_data
context
created_at
```

Acciones críticas:

```text
APPROVE_ORDER
RETURN_ORDER
START_INVOICE
INVOICE_SUCCESS
INVOICE_ERROR
CANCEL_ORDER
ASSIGN
REASSIGN
MANUAL_OVERRIDE
```

## 21. Integration logs

```text
id
system
operation
entity_type
entity_id
external_id
status
http_status
request_id
error_code
error_message
attempt
started_at
finished_at
created_at
```

## 22. Sync jobs

```text
id
job_type
system
status
started_at
finished_at
cursor
records_processed
records_failed
error_summary
created_at
updated_at
```

## 23. Métricas

Puede existir una vista `customer_metrics` con:

```text
orders_count
lifetime_value
average_ticket
last_order_at
average_purchase_interval_days
days_since_last_order
expected_next_order_at
risk_level
open_quotes_count
open_followups_count
```

Estos valores son derivados y no deben convertirse en hechos históricos falsos.

## 24. Índices esenciales

- `customers(document_number_normalized)`
- `customers(responsible_user_id)`
- `customers(siigo_customer_id)`
- `customers(ghl_contact_id)`
- `orders(order_number)`
- `orders(status)`
- `orders(seller_id)`
- `orders(customer_id)`
- `orders(created_at)`
- `quotes(quote_number)`
- `quotes(customer_id)`
- `follow_ups(seller_id, status, scheduled_at)`
- `invoice_operations(idempotency_key)`

## 25. Regla de diseño

La BD debe permitir reconstruir la historia completa de una relación comercial sin depender de Sheets, Make o la memoria de una vendedora.
