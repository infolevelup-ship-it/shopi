# Mapeos a aplicar en la UI del workflow `WOW - Recibir Pedido B2B`

> **Ejecuta esto en GHL** → Automation → Workflows → **WOW - Recibir Pedido B2B**.

## Contexto de estado actual

Después de la limpieza:
- ✅ 4 custom fields vacíos borrados (los que estaban duplicados en concepto).
- ✅ 2 custom fields nuevos creados para códigos DANE.
- ⚠️ El workflow actual solo mapea 3 de los ~20 campos que el HTML manda al webhook.
- 🐛 El campo `Tipo de Identificación` guarda `"[object Object]"` en algunos contactos — se pasa el objeto del dropdown en vez del value.

---

## Bug crítico a corregir primero

En la acción **Create/Update Contact** → mapeo del campo **Tipo de Identificación**:

**❌ Actual** (probable): apunta al select de forma cruda y GHL toma el objeto completo:
```
{{inboundWebhookRequest.cliente.id_type}}
```
que en GHL termina siendo `[object Object]` cuando el custom field es SINGLE_OPTIONS y GHL trata de convertir un objeto a texto.

**✅ Corregir a**: pasar solo el string del value. El HTML manda `id_type` como string ya (`"31"`, `"13"`, etc.). Verificar que el mapeo lea el texto directo:
- Si el campo GHL es SINGLE_OPTIONS: sus valores deben ser exactamente `31`, `13`, `22`, `42` (los códigos DIAN de tipo de documento).
- Si eso no encaja con los `Values` actuales del dropdown, **cambiar el tipo del custom field a TEXT** — así acepta cualquier código sin validación de dropdown.

---

## Mapeo completo — Create/Update Contact

Copia esta tabla al configurar el paso "Create/Update Contact". Los campos del bloque **datos nativos** son los que GHL trae por defecto. Los del bloque **custom fields** los tienes creados en tu location.

### Datos nativos GHL

| Campo en GHL | Valor desde el webhook |
|---|---|
| First Name | `{{inboundWebhookRequest.cliente.nombre}}` |
| Business Name | `{{inboundWebhookRequest.cliente.nombre_comercial}}` |
| Email | `{{inboundWebhookRequest.cliente.email}}` |
| Phone | `{{inboundWebhookRequest.cliente.telefono}}` |
| Street Address | `{{inboundWebhookRequest.cliente.direccion}}` |

### Custom fields (bloque **Clientes B2B / Datos fiscales**)

| Campo GHL | fieldKey (informativo) | Valor desde el webhook |
|---|---|---|
| Tipo de Identificación | `tipo_de_identificacin` | `{{inboundWebhookRequest.cliente.id_type}}` |
| Número de Identificación | `nmero_de_identificacin` | `{{inboundWebhookRequest.cliente.nit}}` |
| Razón Social | `razn_social` | `{{inboundWebhookRequest.cliente.nombre}}` |
| Tipo Persona | `tipo_persona` | `{{inboundWebhookRequest.cliente.tipo_persona}}` |
| Responsabilidad Fiscal | `responsabilidad_fiscal` | `{{inboundWebhookRequest.cliente.fiscal}}` |
| Cliente Direccion | `cliente_direccion` | `{{inboundWebhookRequest.cliente.direccion}}` |
| Cliente Ciudad | `cliente_ciudad` | `{{inboundWebhookRequest.cliente.ciudad}}` |
| **Cliente State Code** ★ | `cliente_state_code` | `{{inboundWebhookRequest.cliente.state_code}}` |
| **Cliente City Code** ★ | `cliente_city_code` | `{{inboundWebhookRequest.cliente.city_code}}` |
| Contacto Nombre | `contacto_nombre` | `{{inboundWebhookRequest.cliente.contact_first}}` |
| Contacto Apellido | `contacto_apellido` | `{{inboundWebhookRequest.cliente.contact_last}}` |
| Contacto Email | `contacto_email` | `{{inboundWebhookRequest.cliente.contact_email}}` |
| Tipo de Compra | `tipo_de_compra` | `{{inboundWebhookRequest.cliente.tipo_compra}}` |
| Tipo de Cliente | `tipo_de_cliente` | `{{inboundWebhookRequest.cliente.tipo_cliente}}` |
| Canal | `canal` | `{{inboundWebhookRequest.cliente.canal}}` |
| Vendedora | `vendedora` | `{{inboundWebhookRequest.vendedora}}` |
| ID Cliente Siigo (opcional) | `id_cliente_siigo` | `{{inboundWebhookRequest.cliente.id_siigo}}` |

★ Los dos nuevos custom fields para códigos DANE creados en esta sesión:
- **Cliente State Code** — id `u0AO64m1fA5ku2US9hq5`
- **Cliente City Code** — id `fhp1RsOsLaY3L3qjQhYc`

> **Nota sobre `Cliente Ciudad`**: hoy es `SINGLE_OPTIONS`. Si tu formulario manda ciudades que no están en las opciones del dropdown, el mapeo queda vacío. Recomiendo cambiar el tipo del custom field a **TEXT** en GHL → Settings → Custom Fields.

---

## Mapeo completo — Create Opportunity

Después del Router, en cada rama (Adquisición y Recompras), la acción **Create Opportunity** debe llenar:

### Datos nativos de la oportunidad

| Campo GHL | Valor |
|---|---|
| Opportunity Name | `{{inboundWebhookRequest.cliente.nombre}}` |
| Pipeline | (según rama del router) Adquisición B2B / Recompras B2B |
| Stage | Prospecto nuevo / Pedido tomado |
| Status | `open` |
| Monetary Value | `{{inboundWebhookRequest.total}}` |
| Assigned To | `{{inboundWebhookRequest.vendedora_id}}` |

### Custom fields de la oportunidad

| Campo GHL | fieldKey | Valor |
|---|---|---|
| Cliente Nuevo | `cliente_nuevo` | `{{inboundWebhookRequest.cliente_nuevo}}` |
| Productos Siigo | `productos_siigo` | `{{inboundWebhookRequest.productos_siigo}}` |
| Productos del Pedido | `productos_del_pedido` | `{{inboundWebhookRequest.productos}}` |
| Notas del Pedido | `notas_del_pedido` | `{{inboundWebhookRequest.notas}}` |
| Forma Pago | `forma_pago` | `{{inboundWebhookRequest.forma_pago}}` |
| Vendedora Nombre | `vendedora_nombre` | `{{inboundWebhookRequest.vendedora}}` |
| NIT Cliente | `nit_cliente` | `{{inboundWebhookRequest.cliente.nit}}` |
| Razón Social | `razn_social` (opp) | `{{inboundWebhookRequest.cliente.nombre}}` |
| Nombre Comercial | `nombre_comercial` | `{{inboundWebhookRequest.cliente.nombre_comercial}}` |
| Ciudad | `ciudad` | `{{inboundWebhookRequest.cliente.ciudad}}` |
| Dirección | `direccin` | `{{inboundWebhookRequest.cliente.direccion}}` |
| Email Facturación | `email_facturacin` | `{{inboundWebhookRequest.cliente.email}}` |
| Teléfono | `telfono` | `{{inboundWebhookRequest.cliente.telefono}}` |
| Lista de Precio | `lista_de_precio` | `{{inboundWebhookRequest.lista_precio}}` |
| Canal | `canal` (opp) | `{{inboundWebhookRequest.cliente.canal}}` |
| Tipo de Compra | `tipo_de_compra` (opp) | `{{inboundWebhookRequest.cliente.tipo_compra}}` |
| Tipo de Cliente | `tipo_de_cliente` (opp) | `{{inboundWebhookRequest.cliente.tipo_cliente}}` |
| Total Pedido | `total_pedido` | `{{inboundWebhookRequest.total}}` |
| Subtotal Bruto | `subtotal_bruto` | `{{inboundWebhookRequest.totales.bruto}}` |
| Subtotal Neto | `subtotal_neto` | `{{inboundWebhookRequest.subtotal}}` |
| IVA | `iva` | `{{inboundWebhookRequest.iva}}` |
| Descuentos | `descuentos` | `{{inboundWebhookRequest.descuentos}}` |
| Estado Facturación | `estado_facturacin` | `Pendiente` (valor fijo al crear) |

---

## Configurar el body del webhook en `WOW - Disparar Facturación`

Cuando la oportunidad se mueve al stage **"Aprobado para facturar"**, el workflow `WOW - Disparar Facturación` debe hacer un **Send Webhook** a Make. Ese body es lo que Make recibe como `1.customData.X`.

**URL destino:** el webhook del escenario Make → `WOW - Aprobar y Facturar (FIX)` (módulo 1). Copiar la URL del webhook Make.

**Body content type:** JSON string / Raw

**Body (renombra las llaves feas de GHL a llaves limpias):**

```json
{
  "opportunity_id":  "{{opportunity.id}}",
  "contact_id":      "{{contact.id}}",
  "customData": {
    "cliente_nuevo":         "{{opportunity.cliente_nuevo}}",
    "productos_siigo":       "{{opportunity.productos_siigo}}",

    "tipo_documento":        "{{contact.tipo_de_identificacion}}",
    "nit_cliente":           "{{contact.numero_de_identificacion}}",
    "razon_social":          "{{contact.razon_social}}",
    "nombre_comercial":      "{{opportunity.nombre_comercial}}",
    "tipo_persona":          "{{contact.tipo_persona}}",
    "responsabilidad_fiscal":"{{contact.responsabilidad_fiscal}}",

    "direccion":             "{{contact.cliente_direccion}}",
    "ciudad":                "{{contact.cliente_ciudad}}",
    "state_code":            "{{contact.cliente_state_code}}",
    "city_code":             "{{contact.cliente_city_code}}",
    "email_facturacion":     "{{opportunity.email_facturacion}}",
    "telefono":              "{{opportunity.telefono}}",

    "contacto_nombre":       "{{contact.contacto_nombre}}",
    "contacto_apellido":     "{{contact.contacto_apellido}}",
    "contacto_email":        "{{contact.contacto_email}}",

    "id_cliente_siigo":      "{{contact.id_cliente_siigo}}",
    "forma_pago":            "{{opportunity.forma_pago}}",
    "vendedora":             "{{opportunity.vendedora_nombre}}",
    "notas":                 "{{opportunity.notas_del_pedido}}",
    "total":                 "{{opportunity.total_pedido}}"
  }
}
```

> **Truco de GHL:** al escribir los tokens `{{contact.X}}` y `{{opportunity.X}}` en el editor de acciones, GHL te muestra sugerencias con los `fieldKey` reales (los que tienen los typos por los acentos, como `tipo_de_identificacin` sin la "ó"). Al pegarlos aquí quedan con esas letras raras — GHL los resuelve igual. En la salida hacia Make, las llaves nuevas (`tipo_documento`, `nit_cliente`, etc.) sí quedan limpias.

---

## Checklist rápido

- [ ] Corregir bug de `[object Object]` en el mapeo de `Tipo de Identificación` (Create/Update Contact)
- [ ] Ampliar Create/Update Contact con los 17 mapeos de la tabla superior (hoy solo tiene 3)
- [ ] Ampliar Create Opportunity con los 24 mapeos de la tabla intermedia (hoy tiene 4)
- [ ] Cambiar tipo de `Cliente Ciudad` a TEXT (o cargar el dropdown con las 300+ ciudades DANE)
- [ ] En `WOW - Disparar Facturación`, reemplazar el body del Send Webhook por el JSON de arriba
- [ ] Test end-to-end con el HTML corregido (los 5 parches) contra un cliente nuevo en una ciudad distinta a Bogotá
