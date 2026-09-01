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
```

No permitir valores fiscales arbitrarios.

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

El sistema actual contempla 0% y 2.5%.

Los códigos exactos deben mantenerse en configuración y validarse contra el catálogo real de Siigo.

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

El sistema actual tiene evidencia de:

```text
FV-1
FV-4
```

pero la regla que determina la serie queda:

```text
PENDIENTE_VALIDACION
```

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
