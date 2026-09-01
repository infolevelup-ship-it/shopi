# WOW SALES — 08. UI/UX Y PANTALLAS

## 1. Principio

La interfaz debe reducir:

```text
clics
escritura
búsquedas
errores
```

y aumentar:

```text
velocidad
contexto
acción
```

## 2. Navegación

Base:

```text
Inicio
Pedidos
Cotizaciones
Clientes
Productos
Seguimientos
Prospectos
Reportes
```

Según rol aparecen módulos adicionales.

## 3. Dashboard vendedor

Debe responder:

> ¿Qué debo hacer hoy?

Mostrar:

```text
Ventas hoy
Ventas mes
Seguimientos vencidos
Clientes en riesgo
Cotizaciones pendientes
Pedidos devueltos
```

## 4. Prioridades

Tarjeta:

```text
Cliente
Motivo
Valor
Última actividad
Acción recomendada
```

## 5. Nuevo pedido

Conservar lógica del HTML:

```text
1 Cliente
2 Productos
3 Detalles
4 Confirmación
```

## 6. Cliente

Buscar por:

```text
documento
nombre
teléfono
email
```

Mostrar:

```text
Responsable
Estado
Última compra
Valor histórico
Último contacto
Cotizaciones
Alertas
```

## 7. Página de cliente

Tabs:

```text
Resumen
Pedidos
Cotizaciones
Seguimientos
Actividad
```

## 8. Timeline

Ejemplo:

```text
31 AGO
Pedido #1548
$850.000

29 AGO
Llamada
Interesada

27 AGO
Cotización #874
```

## 9. Productos

Búsqueda instantánea:

```text
nombre
SKU
marca
```

Mostrar:

```text
precio lista
stock aproximado
estado
```

## 10. Carrito

Cada línea:

```text
producto
cantidad
precio
descuento
subtotal
```

Permitir mismo SKU en líneas separadas si las condiciones comerciales son distintas.

## 11. Pedido

Cabecera:

```text
#Pedido
Cliente
Vendedora
Estado
```

Tabs:

```text
Resumen
Productos
Pago
Comprobantes
Historial
```

## 12. Estados

Usar:

```text
icono + texto
```

No depender sólo del color.

## 13. Cola bodega

Tabla:

```text
Pedido
Cliente
Vendedora
Valor
Antigüedad
Estado
```

Filtros:

```text
Pendientes
Urgentes
Con stock
Sin stock
Contado
Crédito
```

## 14. Pantalla revisión

Todo en un solo lugar:

```text
Cliente
Productos
Stock
Pago
Comprobantes
Notas
Checklist
```

## 15. Aprobación

Botón:

```text
APROBAR PARA FACTURAR
```

Nunca etiquetar ese botón como facturar.

## 16. Facturación

Confirmación visible:

```text
Vas a generar una factura electrónica en Siigo.
Una vez emitida, no se elimina como un pedido normal.
```

## 17. Procesamiento

Mostrar estados reales:

```text
Validando
Facturando
Confirmando
```

No simular progreso inexistente.

## 18. Resultado

Éxito:

```text
✓ FV-...
```

Incierto:

```text
⚠ No vuelvas a facturar manualmente.
Estamos verificando el resultado.
```

## 19. Seguimientos

Tabs:

```text
Vencidos
Hoy
Próximos
Completados
```

## 20. Reportes

Evitar sobrecarga.

Primer nivel:

```text
Ventas
Pedidos
Clientes
Cotizaciones
Operación
```

## 21. Responsive

Desktop prioritario para bodega/admin. Tablet/móvil usable para vendedoras.

## 22. UX de errores

Nunca mostrar:

```text
500
```

Mostrar:

```text
No pudimos completar la operación.
El pedido no fue facturado.
Código de soporte: ...
```

## 23. Regla de cada pantalla

Debe responder:

```text
¿Qué estoy viendo?
¿Qué significa?
¿Qué puedo hacer?
¿Cuál es el siguiente paso?
```

## 24. Principio final

La mejor interfaz es la que hace invisible la complejidad técnica.
