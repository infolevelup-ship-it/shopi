# Plan V2 — Formulario con retención, consecutivo, edición de pedidos y comprobante
### WOW B2B · GHL + Make + Siigo · 12 jul 2026

---

## 0. Hallazgos de la investigación (todo verificado contra APIs reales)

### 0.1 La matemática de precios quedó resuelta (probada contra Siigo)
- Siigo **rechaza** precios con más de 2 decimales.
- Con precio base a 2 decimales: qty 1 → total exacto (104.900 ✓).
- Con qty 3 → Siigo calcula 854.699,98 (no 854.700): **redondea por línea**.
- **Conclusión:** el formulario debe enviar `price = round(precioIVA/1.19, 2)` y calcular el
  total a pagar **igual que Siigo**: `total = Σ round(base×qty×1.19, 2)`. Así el pago siempre cuadra.

### 0.2 Retenciones — formato confirmado contra la API
- **Retefuente** va **dentro de `taxes` del ítem**, junto al IVA:
  `"taxes":[{"id":2950},{"id":2969}]` → Siigo restó exactamente 2% de la base ✓ (probado: total 103.136,97).
- **ReteIVA** va a nivel factura: `"retentions":[{"id":2964}]` ✓ (probado: total 102.387,69).
- El `payments.value` debe ser el **total neto después de retenciones**.
- Tasas Retefuente disponibles en tu Siigo: **1% · 2% · 2.5% · 3.5% · 4% · 6% · 7% · 10% · 11%**
  (⚠️ **no existe 1.5%** — si la necesitan, crearla primero en Siigo → Impuestos).
- **Decisión de diseño:** el campo de retención en el formulario debe ser un **dropdown con esas
  tasas reales** (no texto libre) — si la vendedora escribe 1.5 y no existe en Siigo, la factura fallaría.

### 0.3 Moship (la plataforma que usan para Shopify)
Moship hace exactamente el mismo patrón que construimos: busca-o-crea el cliente en Siigo,
mapea cada método de pago de Shopify a una forma de pago de Siigo, y factura al llegar a un
estado ("pagado", "empacado"). Lecciones que adoptamos:
1. **Mapeo forma de pago → id Siigo** (tabla fija, no adivinar): contado→Efectivo(1261),
   crédito 30/60→Crédito(1262), anticipado→Bancolombia(1264) *(confirmar cuál banco)*.
2. **Consecutivo visible** (ellos usan FV-4-XXXXX) para seguimiento — lo replicamos con `WOW-XXXX`.
3. Factura al llegar a un estado del pipeline (ya lo tenemos: "Aprobado para facturar").
4. Moship NO sirve para el flujo B2B directamente (solo ingesta pedidos de Shopify y consume
   su cupo de 500 facturas/periodo) — pero valida que nuestra arquitectura es la correcta.

### 0.4 Comprobante de pago — por qué no llega hoy y qué se puede
- **Por qué no llega:** el formulario mete la imagen en base64 dentro del JSON del webhook
  (hasta ~6,7 MB). El inbound webhook de GHL la descarta/trunca, y aunque llegara, ningún
  custom field la mapea ni GHL puede mostrar base64 como imagen.
- **Fix:** subir la imagen a la **Media Library de GHL** vía Make (server-side) y guardar la
  **URL** en el campo nuevo `Comprobante URL` de la oportunidad → clic y se ve.
- **Siigo:** la API pública **no tiene endpoint para adjuntar archivos a facturas** (los adjuntos
  de 2MB son función de la interfaz web). Solución práctica: la **URL del comprobante viaja en
  las `observations` de la factura** — contabilidad hace clic desde Siigo.

---

## 1. Arquitectura objetivo

```
FORMULARIO v3
 ├─ Pedido NUEVO ──────────────► GHL Inbound Webhook → workflow crea Opp
 │    · pide consecutivo al HUB      (nombre = "WOW-0042 · Salón X")
 │    · precios BASE (sin IVA)
 │    · retención elegida (dropdown)
 │    · total neto calculado como Siigo
 │
 ├─ Comprobante (imagen) ──────► HUB Make → sube a GHL Media → URL → PUT Opp
 │
 └─ BUSCAR/EDITAR pedido ──────► HUB Make → GHL search q="WOW-0042"
      · carga el pedido en el form     → si Estado=Pendiente permite editar
      · reenvía cambios                → PUT Opportunity (campos actualizados)

HUB Make = escenario "WOW - Buscar Cliente Siigo" (id 5110499) ampliado:
  action=buscar        (ya existe — clientes Siigo)
  action=consecutivo   (NUEVO — Data Store contador → "WOW-0042")
  action=comprobante   (NUEVO — base64 → GHL Media → PUT Opp)
  action=buscar_pedido (NUEVO — GHL opportunities/search por consecutivo)
  action=editar_pedido (NUEVO — valida Pendiente → PUT Opp con nuevos campos)

FACTURACIÓN (id 5589725, ya corregido) — pequeños ajustes:
  items del form ya vienen con precio base → pasan directo ✓
  retención: se inyecta en taxes del ítem (el form la manda en productos_siigo) ✓
  payment.value = total neto del form ✓
  observations += URL comprobante
  ⚠️ reactivar el escenario (quedó en OFF)
```

**Principio clave:** la oportunidad de GHL **es la base de datos del pedido**. No se duplica
almacenamiento: buscar/editar lee y escribe los custom fields de la Opp. El Data Store de Make
solo guarda el contador del consecutivo.

---

## 2. Paso a paso de ejecución

### FASE A — Hub de Make (lo implemento yo vía API) · ~1 h
- [ ] A1. Crear Data Store `wow_consecutivo` (1 registro: `counter`)
- [ ] A2. Ruta `action=consecutivo`: lee contador, +1, responde `{"consecutivo":"WOW-0042"}`
- [ ] A3. Ruta `action=comprobante`: recibe base64+consecutivo → busca Opp en GHL por nombre →
      sube imagen a GHL Media Library → PUT `Comprobante URL` en la Opp
- [ ] A4. Ruta `action=buscar_pedido`: GHL `opportunities/search?q=WOW-XXXX` → responde la Opp
      completa con custom fields
- [ ] A5. Ruta `action=editar_pedido`: verifica `Estado Facturación = Pendiente` y stage ≠
      Aprobado/Facturado → PUT Opp (productos, totales, notas, retención) → responde ok/error

### FASE B — Formulario v3 (te entrego el HTML completo) · ~2 h
- [ ] B1. **Precios base:** `productos_siigo` con `price = round(iva/1.19, 2)` y la retención
      elegida agregada al array `taxes` de cada ítem
- [ ] B2. **Total como Siigo:** `Σ round(base×qty×1.19,2) − round(Σbase×ret%,2)` → ese es el
      `total` del payload y el "Total a pagar" del resumen
- [ ] B3. **Campo Retención:** dropdown (Sin retención / 1% / 2% / 2.5% / 3.5% / 4% / 6% / 7% /
      10% / 11%) en el Paso 3 · se ve en el resumen igual que el descuento
- [ ] B4. **Consecutivo:** al enviar, el form pide `action=consecutivo` al hub y lo incluye en
      el payload (`consecutivo`) y el nombre → GHL crea "WOW-0042 · Cliente"
- [ ] B5. **Comprobante:** ya NO va en el webhook a GHL — tras enviar el pedido, el form lo sube
      al hub (`action=comprobante`) con el consecutivo
- [ ] B6. **Pestaña "Buscar pedido":** input consecutivo → carga cliente+carrito desde la Opp →
      editar → botón "Actualizar pedido" (`action=editar_pedido`). Si ya está facturado,
      muestra "Pedido ya facturado — crear pedido nuevo"

### FASE C — GHL (tú en la UI, 15 min)
- [ ] C1. Workflow "Recibir Pedido B2B" → Create Opportunity:
      · Opportunity Name = `{{inboundWebhookRequest.consecutivo}} · {{...cliente.nombre}}`
      · Consecutivo Pedido = `{{inboundWebhookRequest.consecutivo}}`
      · Retencion Porcentaje = `{{inboundWebhookRequest.retencion_pct}}`
      · Retencion Valor = `{{inboundWebhookRequest.retencion_valor}}`
- [ ] C2. Webhook "Disparar Facturación" → agregar 3 pares al Custom Data:
      `consecutivo`, `retencion_pct`, `comprobante_url` (tokens de los campos nuevos)

### FASE D — Facturación Make (lo hago yo vía API, 10 min)
- [ ] D1. `observations` += `| Comprobante: {{comprobante_url}} | Pedido: {{consecutivo}}`
- [ ] D2. Verificación: items ya traen retención desde el form → nada más que tocar
- [ ] D3. **Reactivar el escenario** (quedó OFF)

### FASE E — Prueba end-to-end (juntos, 20 min)
- [ ] E1. Pedido nuevo con retención 2% y comprobante → verificar consecutivo en GHL,
      comprobante visible, totales correctos
- [ ] E2. Buscar el consecutivo → editar (agregar producto) → verificar Opp actualizada
- [ ] E3. Aprobar → factura en Siigo con retención y total neto exacto
- [ ] E4. Intentar editar el pedido ya facturado → debe rechazarlo

### FASE F — Producción y seguridad
- [ ] F1. Cambiar doc 5491 → **34963** (factura electrónica DIAN) — puede requerir reponer
      `cost_center` (34963 lo usa; Moship factura FV-4 con centros de costo)
- [ ] F2. Rotar TODO: PIT GHL, access_key Siigo, API token Make · borrar clientes de prueba

---

## 3. Decisiones que necesito de ti antes de arrancar

| # | Decisión | Mi recomendación |
|---|---|---|
| 1 | Retención: ¿dropdown con tasas reales de Siigo o texto libre? | **Dropdown** (texto libre rompería la factura). Si necesitan 1.5%, crearla primero en Siigo |
| 2 | Forma de pago "anticipado" → ¿qué cuenta Siigo? (Bancolombia 1264 / Davivienda 11168 / Efectivo 1261) | La cuenta donde reciben las transferencias |
| 3 | Formato consecutivo | `WOW-0001` (corto, buscable) |
| 4 | ¿Empezar el contador en un número específico? (ej. 100) | Como prefieran |
