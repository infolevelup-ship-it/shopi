# WOW SALES — 10. PLAN DE IMPLEMENTACIÓN

## 1. Objetivo

Construir una V2 robusta sin detener la operación actual y reduciendo progresivamente la dependencia de Make.

## 2. Orden

```text
Reglas
→ datos
→ seguridad
→ backend
→ clientes
→ productos
→ pedidos
→ bodega
→ facturación
→ GHL
→ CRM
→ reportes
→ migración
→ retiro Make
```

## 3. Fase 0 — Documentación

Completar:

```text
01 Maestro
02 Datos
03 Backend
04 Flujos
05 Seguridad
06 Siigo
07 GHL
08 UI
09 Migración
10 Plan
```

## 4. Fase 1 — Fundación

Construir:

- repositorio;
- Next.js;
- Supabase;
- Auth;
- roles;
- RLS;
- auditoría;
- estructura base.

Criterio:

```text
4 usuarios de prueba
4 roles
políticas verificadas
```

## 5. Fase 2 — Clientes

Construir:

```text
buscar
crear
editar
duplicados
asignación
timeline
```

## 6. Fase 3 — Productos

Construir:

```text
catálogo
búsqueda
listas
impuestos
Siigo ID
stock cache
```

## 7. Fase 4 — Cotizaciones

Construir:

```text
crear
editar
enviar
seguimiento
ganar/perder
convertir
```

## 8. Fase 5 — Pedidos

Migrar lógica actual:

```text
cliente
carrito
precios
descuentos
IVA
retención
formas de pago
comprobantes
PDF
```

## 9. Fase 6 — Bodega

Construir:

```text
cola
detalle
stock
checklist
impresión
aprobar
devolver
```

## 10. Fase 7 — Siigo

Primero lectura:

```text
auth
customers
products
stock
```

Después:

```text
create customer
```

Finalmente:

```text
invoice
```

## 11. Fase 8 — Seguridad fiscal

Implementar y probar:

```text
idempotency
invoice_operations
constraints
timeouts
uncertain
reconciliation
audit
```

## 12. Fase 9 — GHL

Implementar:

```text
contact upsert
opportunity
owner
sync
webhooks necesarios
```

## 13. Fase 10 — CRM

Construir:

```text
timeline
follow ups
risk
next purchase
priorities
```

## 14. Fase 11 — Reportes

Construir:

```text
seller
warehouse
supervisor
admin
daily
monthly
```

## 15. Fase 12 — Migración

```text
staging
cleaning
dedupe
mapping
batch
validation
delta
```

## 16. Fase 13 — Shadow

Durante transición:

```text
V2 registra/compara
V1 sigue operando según política
```

No permitir dos caminos de facturación simultáneos.

## 17. Fase 14 — Piloto

Usuarios:

```text
1 vendedora
1 bodega
1 supervisor
```

Medir:

```text
tiempo
errores
confusión
velocidad
```

## 18. Fase 15 — Cuatro vendedoras

Activar los 4 usuarios.

Los usuarios deben vivir en BD, no hardcodeados.

## 19. Fase 16 — Facturación oficial

Sólo después de:

```text
idempotencia probada
timeouts probados
reconciliación probada
auditoría lista
```

## 20. Fase 17 — Retiro Make

Eliminar en orden:

```text
búsqueda clientes
productos
pedidos
comprobantes
GHL sync
facturación
```

El objetivo final:

```text
0 Make en flujo crítico
```

## 21. Fase 18 — Legacy

Mantener HTML viejo sólo como contingencia/consulta durante ventana definida.

Luego:

```text
solo lectura
→ retiro
```

## 22. Pruebas de regresión

Cada release crítico prueba:

```text
cliente
producto
pedido
cotización
IVA
descuento
retención
stock
aprobación
facturación
despacho
reportes
```

## 23. Definición de terminado

Una función sólo está terminada si tiene:

```text
UI
backend
permisos
validación
error handling
auditoría
tests
documentación
```

## 24. Regla

Nunca agregar una nueva automatización externa sólo porque resulta más rápida de implementar.

Primero preguntar:

> ¿Esta regla pertenece al dominio de WOW?

Si sí, debe vivir en WOW.

## 25. Objetivo final

```text
              WOW SALES
          /       |              SELLER   WAREHOUSE  ADMIN
             \    |     /
               SUPABASE
                /                  SIIGO     GHL
```

La plataforma debe ser la memoria operacional y comercial de WOW.
