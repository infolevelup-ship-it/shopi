# WOW SALES — 06. INTEGRACIÓN CON SIIGO

## 1. Papel de Siigo

Siigo es la autoridad para:

- facturación electrónica;
- documento fiscal;
- número de factura;
- estado fiscal;
- inventario que se use como referencia operativa;
- datos fiscales requeridos para facturación.

WOW es la autoridad para el proceso interno y comercial.

## 2. Arquitectura

```text
WOW UI
 ↓
WOW Backend
 ↓
Siigo Adapter
 ↓
Siigo API
```

Nunca:

```text
Browser → Siigo
```

## 3. Autenticación

El sistema actual utiliza:

```text
username
access_key
Partner-Id
```

La documentación de Siigo muestra autenticación mediante `POST /auth`, token y `expires_in`. Debe manejarse en backend y cachearse mientras sea válido.

## 4. Customer lookup

Buscar principalmente por:

```text
identification
```

Si existe:

```text
guardar siigo_customer_id
```

Si existen duplicados:

```text
marcar conflicto
```

No crear un tercero automáticamente.

## 5. Creación de cliente

Secuencia:

```text
WOW busca
→ Siigo busca
→ si existe: asociar
→ si no: crear
→ guardar ID externo
```

Debe ser idempotente en la medida que lo permita el recurso.

## 6. Datos fiscales

Validar:

```text
id_type
identification
person_type
fiscal_responsibility
vat_responsible
city_code
state_code
cost_center
```

No permitir valores fiscales arbitrarios.

**Validado contra Siigo real (ver §22):** ejemplo real de un cliente jurídico ya facturando
(identidad omitida aquí a propósito, no se versiona información de clientes) —
`person_type: "Company"`, `name: ["<razón social>"]` (un solo elemento del arreglo),
`fiscal_responsibilities: [{"code":"R-99-PN"}]`, `vat_responsible: false`.

## 7. Personas naturales

Guardar nombres y apellidos por separado.

No depender del algoritmo actual:

```text
substring/indexOf primer espacio
```

para decidir datos fiscales.

Probar:

```text
María Fernanda García Pérez
Juan Carlos De La Cruz
nombres simples
apellidos compuestos
```

**Validado contra Siigo real (ver §22):** Siigo no separa nada — simplemente guarda lo que se le
mande en `name: [nombres, apellidos]` (arreglo de 2 elementos). Se confirmó con un cliente real ya
facturando con nombre compuesto en ambas partes (identidad omitida aquí a propósito). Confirma que
el problema es enteramente nuestro (cortar el nombre por el primer espacio en el HTML actual): el
formulario nuevo debe capturar "Nombres" y "Apellidos" como 2 campos separados desde el inicio (ya
así en `customers.first_name` / `customers.last_name` del doc 02/SQL) y mandarlos tal cual, sin
adivinar dónde cortar.

## 8. Productos

Guardar:

```text
siigo_product_id
code
name
tax_id
tax_percent
unit_code
```

## 9. Precios

WOW puede manejar:

```text
Publico
Profesional
Salones
```

pero el pedido guarda el precio exacto que se vendió.

## 10. Inventario

Regla:

> El inventario crítico procede de Siigo.

WOW puede tener:

```text
stock_cache
stock_updated_at
```

para velocidad.

Pero antes de aprobar:

```text
consultar stock actual según API disponible
```

**Validado contra Siigo real (ver §22):** el stock viene incluido en el mismo objeto de producto,
no en un endpoint separado — cada producto trae `available_quantity` (total) y además
`warehouses: [{id, name, quantity}]` desglosado por bodega. No hace falta un segundo endpoint de
inventario; `products.stock_cache` puede poblarse directo desde esta misma respuesta.

## 11. Sincronización

Jobs posibles:

```text
PRODUCT_SYNC
CUSTOMER_SYNC
STOCK_SYNC
RECONCILIATION
```

Cada job registra:

```text
inicio
fin
procesados
errores
```

## 12. Facturación

El backend construye el payload a partir de:

```text
customer
order
order_items
payment
taxes
retention
```

Nunca confiar en JSON fiscal armado directamente en navegador.

## 13. Cálculos

Migrar la lógica validada del HTML.

Pruebas:

- IVA;
- descuentos;
- retención;
- producto sin IVA;
- redondeos;
- múltiples líneas;
- cantidades.

## 14. Retención

**Validado contra Siigo real (ver §22):** catálogo real de Retefuente en la cuenta de WOW, con
sus IDs exactos —

| % | Nombre en Siigo | ID |
|---|---|---|
| 1% | Retefuente 1% | 2970 |
| 2% | Retefuente 2% | 2969 |
| 2.5% | Retefuente 2.5% | 2956 |
| 3.5% | Retefuente 3.5% | 2967 |
| 4% | Retefuente 4% | 2955 |
| 6% | Retefuente 6% | 2954 |
| 7% | Retefuente 7% | 2968 |
| 10% | ⚠️ no encontrada — **pendiente de confirmar antes de producción** | — |
| 11% | Comisiones 11% | 18453 |

El formulario actual ofrece 10% pero no se confirmó su ID en el catálogo real. Antes de construir
el `InvoiceService`, confirmar si existe con otro nombre o si de verdad no está configurada — si
no está, cualquier pedido con retención al 10% fallaría al facturar. También existen en la cuenta,
sin uso hoy por WOW: IVA (0%, 19%), ReteIVA 15%, Impoconsumo 8%, y varias ReteICA.

## 15. Formas de pago

Mapear internamente:

```text
contado
credito_15
credito_30
credito_45
credito_60
contra_entrega
```

a la estructura exacta que Siigo requiera.

## 16. Error

Clasificar:

```text
4xx de validación
4xx de autenticación
429
5xx
timeout
respuesta incierta
```

## 17. Timeout

Regla absoluta:

```text
timeout ≠ factura inexistente
```

Estado:

```text
UNCERTAIN
```

## 18. Reconciliación

Debe existir un servicio:

```text
SiigoReconciliationService
```

para resolver operaciones inciertas antes de permitir un nuevo intento.

## 19. Series

**Resuelto — validado contra Siigo real (ver §22):** el documento `34963 "Factura electrónica de
venta"` (código 4) es el correcto y el **único** tipo de documento electrónico ante la DIAN que
existe en la cuenta. Los demás tipos que existen ahí son de otras épocas o no-electrónicos:
"Documento de ingreso" (37934), "FACTURA DE VENTA 2018" (34804), "Factura de venta" (34018,
inactivo), "Factura de Venta" (33864, viejo/manual), "FV" (5491, no-electrónico). No hay que
elegir entre FV-1 y FV-4 en tiempo de ejecución: solo existe una serie electrónica vigente y ya es
la que usa el escenario actual — `document_type` puede quedar fijo a `34963` en el `InvoiceService`
en vez de resuelto por regla.

## 20. Pruebas obligatorias

```text
cliente nuevo empresa
cliente nuevo persona
cliente existente
cliente duplicado
producto IVA
producto sin IVA
retención
contado
crédito
stock insuficiente
timeout
4xx
5xx
doble click
dos usuarios
```

## 21. Regla final

Toda llamada a Siigo debe pasar por una capa de integración única.

No repartir URLs, tokens y reglas fiscales por el código de las pantallas.

## 22. Validación ejecutada contra Siigo real (2026-09-02)

Cierra los 5 puntos abiertos del doc 01 §68 con datos reales de la cuenta de WOW en Siigo (no
supuestos). Detalle incorporado en las secciones correspondientes arriba (§6, §7, §10, §14, §19);
aquí quedan los dos hallazgos que no encajan en ninguna sección anterior porque son decisiones,
no datos:

### Centro de costo — pendiente de decisión de negocio

`cost_center: 86` (VENTAS-1 / PUBLICO) existe y sigue activo — es el que ya usa el escenario
actual y seguirá siendo válido. Pero la cuenta tiene además:

```text
ventas-2 / SALON DE BELLEZA   (id 1048)
ventas-3 / ESTILISTA INDEPENDIENTE (id 1049)
ventas-4 / TIENDAS            (id 1050, inactivo)
```

Hoy **todo** se factura bajo "PUBLICO" sin importar el canal de venta. Esto no es un error técnico
— es una pregunta para el dueño del negocio: ¿WOW quiere reportes de Siigo separados por canal
(salón vs. estilista independiente vs. público), o el centro de costo único actual es intencional?
Si se decide separar, `orders.channel` (ya existe en el doc 02) es el campo que determinaría qué
`cost_center` usar al facturar — no requiere cambio de esquema, solo la regla de mapeo en el
`InvoiceService`.

### Evidencia real de por qué la revisión de bodega (doc 04 §10) no es opcional

La factura `FV-4-36756` (la misma que el README original dejó como "⚠️ vigilar sello DIAN") resultó
estar **anulada** (`annulled: true`), nunca llegó a la DIAN (quedó en `Draft`). Su nota interna
indica que se facturó con un descuento/precio equivocado en un pedido tomado por el sitio web, y
que alguien lo detectó y anuló la factura manualmente en Siigo por fuera de WOW — sin que quedara
registro en ningún lado del pedido original (qué pedido era, quién lo tomó, ni el motivo, quedan
solo en la nota de Siigo, no en ningún sistema de WOW). Esto es
exactamente el escenario que `order_reviews` (checklist `prices_ok`) y `audit_logs` en el doc 02
existen para prevenir y, si igual pasa, para que quede trazado en WOW en vez de resolverse a mano
y en silencio dentro de Siigo.
