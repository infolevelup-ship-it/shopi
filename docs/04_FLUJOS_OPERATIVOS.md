# WOW SALES — 04. FLUJOS OPERATIVOS Y ESTADOS

## 1. Ciclo completo

```text
Prospecto
 ↓
Cliente
 ↓
Cotización
 ↓
Pedido
 ↓
Revisión
 ↓
Aprobación
 ↓
Factura
 ↓
Despacho
 ↓
Entrega
 ↓
Seguimiento
 ↓
Próxima compra
```

## 2. Nuevo cliente

```text
Buscar documento
→ detectar existente
→ detectar posible duplicado
→ crear/reutilizar
→ asignar responsable
→ sincronizar Siigo/GHL
```

## 3. Cliente existente

La vendedora puede buscar por:

- documento;
- nombre;
- teléfono;
- email.

La interfaz debe mostrar inmediatamente:

- responsable;
- estado;
- última compra;
- próxima compra estimada;
- cotizaciones abiertas;
- alertas.

## 4. Solapamiento

Si el cliente pertenece a otra vendedora:

```text
Cliente asignado a Karina
Última actividad: hoy 10:42
```

La segunda vendedora puede solicitar apoyo/reasignación, según permiso.

## 5. Cotización

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

Toda cotización importante genera timestamps.

## 6. Pedido

Estados:

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

## 7. Crear pedido

```text
Cliente
→ lista de precio
→ productos
→ cantidades
→ descuentos
→ detalles
→ pago
→ comprobantes
→ confirmar
```

Primero se guarda en WOW.

Luego se sincroniza GHL.

## 8. Edición

Editable normalmente en:

```text
DRAFT
SUBMITTED
PENDING_REVIEW
RETURNED_TO_SELLER
```

No editable por vendedora en:

```text
APPROVED_FOR_INVOICE
INVOICING
INVOICED
DISPATCHED
DELIVERED
```

## 9. Devolución

Bodega puede devolver por:

- falta de producto;
- cantidad;
- precio;
- cliente;
- documentación;
- pago/comprobante;
- error comercial.

Siempre con motivo.

## 10. Revisión de bodega

Checklist:

```text
Cliente correcto
Productos correctos
Cantidades correctas
Precios correctos
Stock disponible
Forma de pago correcta
Comprobantes revisados
Datos fiscales correctos
Recibo impreso/verificado
```

## 11. Aprobar

La aprobación significa:

> Este pedido está listo para que el rol autorizado lo facture.

No crea factura.

## 12. Facturar

Solo el rol autorizado.

```text
APROBADO
→ validar de nuevo
→ comprobar factura
→ comprobar idempotencia
→ Siigo
→ guardar resultado
```

## 13. Factura exitosa

```text
invoice_status = ISSUED
order_status = INVOICED
```

Guardar:

```text
Siigo ID
Número
Fecha
Total
Usuario
```

## 14. Timeout

```text
resultado incierto
→ no repetir ciegamente
→ reconciliar
```

## 15. Despacho

```text
INVOICED
→ READY_FOR_DISPATCH
→ DISPATCHED
→ DELIVERED
```

Facturar no significa entregar.

## 16. Seguimiento postventa

Después de entrega puede crearse un seguimiento sugerido.

## 17. Próxima compra

Calcular como estimación:

```text
última compra + intervalo histórico
```

Mostrar:

```text
Próxima compra estimada
```

Nunca como certeza.

## 18. Cliente fuera de ciclo

```text
días desde compra
>
frecuencia habitual + tolerancia
```

→ cliente en riesgo.

## 19. Prioridad comercial

Orden inicial:

1. Seguimiento vencido de alto valor.
2. Cotización importante sin respuesta.
3. Cliente fuera de ciclo.
4. Cliente de alto valor sin contacto.
5. Seguimiento próximo.

## 20. Prospecto

Primera visita:

```text
crear prospect
```

Segunda:

```text
actualizar prospect por ID
```

No buscar por nombre como método técnico.

## 21. Pedido histórico

```text
source_type = HISTORICAL
```

Nunca puede facturarse desde la ruta de pedidos live.

## 22. Cancelación

No borrar:

```text
CANCELLED
cancelled_by
cancelled_at
reason
```

## 23. Reglas imposibles

El sistema debe impedir:

- facturar pedido histórico;
- facturar pedido cancelado;
- doble facturación;
- editar factura emitida;
- cambiar dueño sin permiso;
- cambiar etapa y disparar factura automáticamente;
- facturar sin validación de rol.
