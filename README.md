# WOW B2B — Pedidos → GHL → Make → Siigo

Automatización de pedidos B2B para **Productos WOW** (distribuidor OLAPLEX Colombia).
Las vendedoras toman pedidos en un formulario web → se crea la oportunidad en **GoHighLevel** →
al aprobar, **Make** factura en **Siigo** (facturación electrónica DIAN).

```
FORMULARIO (formulario/WOW_Pedidos_B2B_v3.html)
   │  pedido nuevo ─────────────► GHL Inbound Webhook → workflow "Recibir Pedido B2B" (crea Opp)
   │  consecutivo / buscar / editar / comprobante ──► HUB Make (escenario 5110499)
   ▼
GHL Oportunidad (base de datos del pedido: cliente, carrito, totales, retención, consecutivo)
   │  al pasar a "Aprobado para facturar" ─► Webhook "Disparar Facturación"
   ▼
MAKE "WOW - Aprobar y Facturar (FIX)" (escenario 5589725)
   │  busca-o-crea cliente Siigo · arma items con precio base + IVA + retención · payment neto
   ▼
SIIGO factura electrónica (FV-1-N) — total exacto al centavo, marca Opp "Facturada"
```

## Componentes

| Pieza | Ubicación | Estado |
|---|---|---|
| Formulario vendedoras | `formulario/WOW_Pedidos_B2B_v3.html` | ✅ Listo para pegar en GHL |
| Escenario HUB (consecutivo, buscar, editar, comprobante, clientes Siigo) | Make `5110499` "WOW - Buscar Cliente Siigo" | ✅ Activo · comprobante verificado E2E |
| Escenario Facturación | Make `5589725` "WOW - Aprobar y Facturar (FIX)" | ✅ Activo |
| Workflow crear pedido | GHL "Recibir Pedido B2B" | ✅ (mapeos en `docs/`) |
| Webhook disparar factura | GHL "Disparar Facturación" | ⚠️ faltan 2 pares (ver abajo) |

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

## Pendientes de configuración (lado GHL / Make — UI)

1. **Webhook GHL "Disparar Facturación"** → agregar 2 pares al Custom Data (para que el
   consecutivo y la URL del comprobante viajen a la factura de Siigo):
   - `consecutivo`     = `{{opportunity.consecutivo_pedido}}`
   - `comprobante_url` = `{{opportunity.comprobante_url}}`
   > Único paso manual. Es un workflow de GHL (no editable por API).
2. **Escenario Facturación (5589725)** → ✅ **ya está listo**: los módulos 6 y 7 ya incluyen
   en las `observations` de la factura `Pedido {{consecutivo}} | … | Comprobante: {{comprobante_url}}`.
   Solo falta que el webhook (#1) alimente esos dos valores.

> ✅ El **comprobante ya funciona end-to-end**: sube a la Media Library de GHL y su URL queda en
> el campo `comprobante_url` de la oportunidad (imagen visible con un clic). El módulo 34 se
> configuró en el editor visual de Make porque la subida multipart de archivos no es armable por la
> API — detalle y estructura exacta en `docs/GUIA_COMPROBANTE_MAKE.md`.

## Seguridad

Antes de producción, **rotar** todas las credenciales que se usaron en desarrollo:
PIT de GHL, `access_key` de Siigo y el API token de Make. No están en este repositorio.
