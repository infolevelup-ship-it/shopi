# WOW SALES — 09. MIGRACIÓN DE DATOS

## 1. Objetivo

Migrar el conocimiento actual sin producir duplicados ni facturación accidental.

Volumen conocido:

```text
~1.600 productos
~12.000 clientes
```

El HTML/documentación también menciona un catálogo de Apps Script de aproximadamente 26.000 clientes; ese universo exacto debe definirse antes de la migración.

## 2. Fuentes

Posibles:

```text
Siigo
GHL
Google Sheets
Apps Script
```

## 3. Estrategia

```text
EXTRACT
→ STAGING
→ NORMALIZE
→ DEDUPE
→ MAP
→ VALIDATE
→ IMPORT
→ RECONCILE
```

## 4. Productos

Fuente preferida:

```text
Siigo
```

El Sheet puede servir como fuente auxiliar para precios/listas si Siigo no contiene toda la lógica comercial requerida.

## 5. Clientes

Crear staging:

```text
customer_import_staging
```

No cargar directo a producción.

## 6. Normalización

Normalizar:

```text
documento
teléfono
email
nombre
ciudad
```

## 7. Duplicados

Prioridad:

```text
1 documento
2 Siigo ID
3 GHL ID
4 teléfono + nombre
5 email
6 similitud de nombre
```

Nunca fusionar sólo por nombre.

## 8. Candidatos

Tabla:

```text
customer_merge_candidates
```

Campos:

```text
customer_a
customer_b
reason
confidence
status
reviewed_by
reviewed_at
```

## 9. Merge

Conservar referencias antiguas:

```text
merged_into_customer_id
```

No destruir IDs externos históricos.

## 10. Relación Siigo

Por cada cliente:

```text
buscar identificación en Siigo
```

Si existen varios:

```text
NEEDS_REVIEW
```

## 11. GHL

Relacionar:

```text
customer → ghl_contact_id
order → ghl_opportunity_id
```

## 12. Pedidos históricos

Convertir el campo serializado de productos a:

```text
orders
+
order_items
```

Guardar snapshots.

## 13. Facturas históricas

No emitir.

Guardar:

```text
historical_invoice_number
historical_siigo_invoice_id
```

cuando estén disponibles.

## 14. Cotizaciones antiguas

Si se conoce el estado real, mapearlo.

Si no:

```text
LEGACY_IMPORTED
```

## 15. Prospectos

Migrar:

```text
nombre
negocio
teléfono
ciudad
vendedora
visitas
notas
```

No inventar fechas.

## 16. Responsables

Asignar sólo con evidencia.

Casos ambiguos:

```text
REQUIERE_REVISION
```

No repartir aleatoriamente.

## 17. Conteos

Antes:

```text
records source
```

Después:

```text
records imported
```

Comparar.

## 18. Migración por lotes

Ejemplo:

```text
lote 1 = 50
lote 2 = 500
lote 3 = completo
```

Cada lote tiene `batch_id`.

## 19. Rollback

Registrar:

```text
created
updated
skipped
failed
```

## 20. Freeze

Corte:

```text
freeze
→ extract final
→ import delta
→ validate
→ activate
```

## 21. Coexistencia

Durante transición:

```text
V1 + V2
```

pero sólo una ruta de facturación puede estar activa.

## 22. Prueba manual

Antes de volumen completo:

```text
50 clientes
50 productos
50 pedidos
```

comparados contra fuente.

## 23. Regla

Importar datos nunca debe ejecutar operaciones fiscales.

## 24. Criterio de éxito

La migración es correcta cuando:

- clientes están identificados;
- duplicados están controlados;
- productos son utilizables;
- pedidos históricos son reconstruibles;
- facturas históricas no se vuelven a emitir;
- responsables son correctos.
