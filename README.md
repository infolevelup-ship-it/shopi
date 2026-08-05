# WOW B2B — Pedidos → GHL → Make → Siigo

Automatización de pedidos B2B para **Productos WOW** (distribuidor OLAPLEX Colombia).
Las vendedoras toman pedidos en un formulario web → se crea la oportunidad en **GoHighLevel** →
al aprobar, **Make** factura en **Siigo** (facturación electrónica DIAN).

```
FORMULARIO (formulario/WOW_Pedidos_B2B_v3.html)   ← toggle B2B / B2C
   │  pedido nuevo ─────────────► GHL Inbound Webhook → workflow "Recibir Pedido B2B" (crea Opp)
   │  consecutivo / buscar / editar / comprobante ──► HUB Make (escenario 5110499)
   ▼
GHL Oportunidad (base de datos del pedido: cliente, carrito, totales, retención, consecutivo)
   │  revisión humana en "Revisar para facturar" → mueve manual a "Facturado"
   ▼                                                       ─► Webhook "Disparar Facturación"
MAKE "WOW - Aprobar y Facturar (FIX)" (escenario 5589725)
   │  candado: solo factura si Estado Facturación ≠ "Facturada" (evita doble factura)
   │  busca-o-crea cliente Siigo · arma items con precio base + IVA + retención · payment neto
   ▼
SIIGO factura electrónica DIAN (FV-4-N, doc 34963) — total exacto al centavo, marca Opp "Facturada"
```

## Componentes

| Pieza | Ubicación | Estado |
|---|---|---|
| Formulario vendedoras (switch B2B/B2C, combos independientes) | `formulario/WOW_Pedidos_B2B_v3.html` | ✅ Listo para pegar en GHL |
| Escenario HUB (consecutivo, buscar, editar, comprobante, clientes Siigo) | Make `5110499` "WOW - Buscar Cliente Siigo" | ✅ Activo · comprobante verificado E2E |
| Escenario Facturación | Make `5589725` "WOW - Aprobar y Facturar (FIX)" | ✅ Activo · **factura electrónica DIAN (doc 34963)** |
| Workflow crear pedido | GHL "Recibir Pedido B2B" | ✅ (mapeos en `docs/`, incluye rama B2C) |
| Webhook disparar factura | GHL "Disparar Facturación" | ✅ completo (consecutivo, comprobante_url, estado_facturacion) |

## Lógica financiera (verificada contra la API real de Siigo, al centavo)

Los precios de lista **incluyen IVA (19%)**. Siigo necesita el **precio base** y redondea por línea:

- `base   = round(precioConIVA / 1.19, 2)`
- `descuento_linea = round(base × qty × desc% / 100, 2)`  ← Siigo lee el descuento como **VALOR en pesos**, no %
- `neto   = round(base × qty − descuento_linea, 2)`
- `iva    = round(neto × 0.19, 2)`
- `retención_línea = round(neto × ret% / 100, 2)`  ← **Retefuente va en `taxes` del ítem**
- `total_a_pagar = Σ(neto + iva) − Σ retención`

El formulario calcula el **Total a pagar igual que Siigo**, así el pago siempre cuadra.
Tasas Retefuente reales en el Siigo de WOW: **1 · 2 · 2.5 · 3.5 · 4 · 6 · 7 · 10 · 11 %** (no existe 1.5%).

## Funciones del formulario v3

- **Precios base + IVA + retención** enviados en `productos_siigo` (JSON listo para Siigo).
- **Retención manual** con dropdown (solo tasas reales de Siigo).
- **Consecutivo** `WOW-YYMMDD-HHMMSS` en cada pedido (para seguimiento y búsqueda).
- **Buscar / editar pedido**: carga un pedido existente por consecutivo y permite modificarlo
  mientras NO haya pasado a facturación (bloquea si Estado=Facturada o etapa aprobada).
- **Comprobante de pago** (transferencias anticipadas): se sube como archivo real al HUB.

## Facturación electrónica DIAN — ✅ activa (doc 34963)

Desde el 05-ago-2026 el escenario de facturación usa el documento **34963 "Factura electrónica
de venta"** (antes 5491, interno/no-electrónico). Cambios aplicados en los módulos 6 y 7:
- `"document": {"id": 34963}` (antes 5491)
- `"cost_center": 86` (código `VENTAS-1` / "PUBLICO" — el mismo que usa Moship/Shopify con este
  documento; es **obligatorio** para 34963, no lo pedía el doc interno 5491).

**Verificado:** oracle-test contra Siigo (sin crear factura real) validó que este documento +
cost_center pasan todas las validaciones. Un pedido real de producción (primero en usar el nuevo
doc) generó `FV-4-36756` con matemática exacta (descuento, IVA, total al centavo).

> ⚠️ **Punto abierto a vigilar:** el sello DIAN (`stamp.status`) de esa primera factura quedó en
> **`Draft`** por más de un minuto, mientras que todas las demás facturas del día (Shopify/Moship)
> ya estaban `Accepted`. Puede ser demora normal de timbrado asíncrono, o puede requerir revisión
> manual en la interfaz de Siigo (ahí suelen verse mensajes de error DIAN más detallados que los
> que devuelve la API). **Revisar en Siigo la factura FV-4-36756 y confirmar que quede `Accepted`.**

## Comprobante de pago — ✅ funciona end-to-end

Sube a la Media Library de GHL y su URL queda en el campo `comprobante_url` de la oportunidad
(imagen visible con un clic), y viaja a las `observations` de la factura de Siigo
(`Pedido {{consecutivo}} | … | Comprobante: {{comprobante_url}}`, ya cableado en los módulos 6/7).
El módulo 34 se configuró en el editor visual de Make porque la subida multipart de archivos no
es armable por la API — detalle y estructura exacta en `docs/GUIA_COMPROBANTE_MAKE.md`.

### Filtro humano + candado anti-doble-factura
- La factura se dispara cuando una persona mueve la oportunidad a la etapa **"Facturado"**
  (revisión humana). La etapa previa "Aprobado para facturar" se usa como **cola de revisión**
  (renombrable a "Revisar para facturar").
- **Candado (ya aplicado en Make, escenario 5589725):** ambas rutas del router solo facturan si
  `estado_facturacion ≠ "Facturada"`. Verificado: un re-disparo con Estado=Facturada se bloquea
  (no crea factura). Esto evita facturas dobles si alguien reingresa la oportunidad a "Facturado".
- **Requiere (webhook GHL "Disparar Facturación"):** agregar el par de Custom Data
  `estado_facturacion` = `{{opportunity.estado_facturacin}}` (ojo: la llave nativa va sin la "ó").
  Sin ese par el candado queda inactivo (no bloquea de más, pero tampoco atrapa el re-disparo).

## Seguridad

Con la facturación electrónica ya activa, **rotar cuanto antes** todas las credenciales usadas
durante el desarrollo/pruebas: PIT de GHL, `access_key` de Siigo y el API token de Make. Ninguna
está en este repositorio, pero quedaron en texto plano dentro de los módulos HTTP de los
escenarios de Make (visibles para cualquiera con acceso a esa cuenta de Make).
