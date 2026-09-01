# WOW SALES — 03. LÓGICA BACKEND Y API

## 1. Objetivo

El backend será el cerebro operativo.

```text
Frontend
  ↓
Backend WOW
  ├── Supabase
  ├── Siigo
  └── GHL
```

No hay secretos en el navegador.

## 2. Capas

### UI
Recoge acciones y muestra resultados.

### API
Autentica, valida, autoriza.

### Dominio
Aplica reglas.

### Persistencia
Lee/escribe Supabase.

### Integraciones
Encapsula Siigo/GHL.

### Observabilidad
Logs, auditoría y métricas.

## 3. Servicios

```text
AuthService
CustomerService
AssignmentService
ProductService
QuoteService
OrderService
WarehouseService
InvoiceService
FollowUpService
ReportingService
AuditService
SiigoService
GhlService
```

## 4. Principio

El navegador nunca decide:

- cuánto vale realmente un pedido;
- si un usuario puede facturar;
- si un pedido puede modificarse;
- si existe una factura;
- si puede reasignar un cliente.

El backend decide.

## 5. API de clientes

```text
GET /api/customers
GET /api/customers/:id
POST /api/customers
PATCH /api/customers/:id
POST /api/customers/:id/assign
GET /api/customers/:id/timeline
GET /api/customers/:id/metrics
```

## 6. API de productos

```text
GET /api/products
GET /api/products/:id
GET /api/products/search?q=
GET /api/products/:id/stock
```

## 7. API de cotizaciones

```text
POST /api/quotes
GET /api/quotes
GET /api/quotes/:id
PATCH /api/quotes/:id
POST /api/quotes/:id/send
POST /api/quotes/:id/accept
POST /api/quotes/:id/convert
POST /api/quotes/:id/lost
```

## 8. API de pedidos

```text
POST /api/orders
GET /api/orders
GET /api/orders/:id
PATCH /api/orders/:id
POST /api/orders/:id/submit
POST /api/orders/:id/review
POST /api/orders/:id/approve
POST /api/orders/:id/return
POST /api/orders/:id/invoice
POST /api/orders/:id/dispatch
POST /api/orders/:id/cancel
```

## 9. Commands vs updates

Las operaciones críticas deben ser comandos explícitos:

```text
approveOrder()
returnOrder()
invoiceOrder()
dispatchOrder()
cancelOrder()
assignCustomer()
```

No permitir que un `PATCH` genérico haga operaciones fiscales.

## 10. Cálculos

Los totales deben recalcularse en backend.

El frontend puede mostrar estimaciones, pero el backend comprueba:

```text
base
cantidad
descuento
IVA
retención
total
```

## 11. Estado válido

Antes de cada transición:

```text
estado actual
→
¿transición permitida?
```

Si no:

```text
409 CONFLICT
```

## 12. Idempotencia

Los endpoints de operaciones externas deben soportar:

```text
Idempotency-Key
```

y registrar el resultado.

## 13. Facturación

```text
POST /api/orders/:id/invoice
```

Proceso:

1. autenticar;
2. autorizar;
3. comprobar estado;
4. comprobar invoice existente;
5. comprobar operación previa;
6. bloquear concurrencia;
7. validar datos;
8. validar stock;
9. ejecutar Siigo;
10. persistir respuesta;
11. sincronizar GHL;
12. registrar auditoría.

## 14. Timeout

No interpretar timeout como ausencia de factura.

```text
TIMEOUT
→ UNCERTAIN
→ RECONCILIATION
```

## 15. GHL

Funciones:

```text
upsertContact()
createOpportunity()
updateOpportunity()
assignOpportunity()
```

IDs externos deben guardarse desde la primera respuesta exitosa.

## 16. Webhooks

```text
POST /api/webhooks/ghl
```

Deben validar:

- autenticidad;
- evento;
- payload;
- idempotencia.

## 17. Reportes

No descargar toda la BD al frontend.

Crear queries/vistas especializadas.

```text
/api/dashboard/seller
/api/dashboard/warehouse
/api/dashboard/admin
/api/reports/daily
/api/reports/monthly
/api/reports/sellers
/api/reports/customers
/api/reports/products
/api/reports/operations
```

## 18. Errores

Tipos:

```text
VALIDATION_ERROR
AUTH_ERROR
PERMISSION_ERROR
NOT_FOUND
CONFLICT
EXTERNAL_TIMEOUT
EXTERNAL_4XX
EXTERNAL_5XX
INTEGRATION_UNCERTAIN
INTERNAL_ERROR
```

## 19. Request ID

Toda request debe tener:

```text
request_id
```

El mismo ID debe aparecer en logs relacionados.

## 20. Concurrencia

Probar:

- dos usuarios editando;
- dos usuarios aprobando;
- dos usuarios facturando;
- stock que cambia durante la revisión.

## 21. Variables de entorno

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVER_SECRET
SIIGO_USERNAME
SIIGO_ACCESS_KEY
SIIGO_PARTNER_ID
GHL_PRIVATE_TOKEN
GHL_LOCATION_ID
GHL_WEBHOOK_SECRET
```

Nunca incluir secretos en Git ni frontend.

## 22. Regla final

Toda operación crítica debe ser explícita, autorizada, auditable e idempotente.
