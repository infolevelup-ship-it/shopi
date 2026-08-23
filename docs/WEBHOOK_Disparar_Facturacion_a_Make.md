# Webhook `WOW - Disparar Facturación` → Make (Custom Data)

Esta es la acción **Webhook** (imagen 1) que dispara la facturación en Make cuando la
oportunidad entra a "Aprobado para facturar" / "Facturado".

> **Concepto clave:** GHL manda cada par de *Custom Data* **anidado bajo `customData`**.
> Por eso en Make cada campo se lee como `1.customData.LLAVE`. La llave de la izquierda
> (abajo) es exactamente el nombre que el blueprint de Make espera.

---

## 🔴 Lo que está mal HOY en tu webhook (imagen 1)

| Estado | Campo | Problema |
|---|---|---|
| ❌ FALTA | `cliente_nuevo` | **Sin esto el router de Make no enruta NADA.** Es lo que decide crear-cliente vs facturar directo. |
| ❌ FALTA | `productos_siigo` | **Sin esto la factura sale sin items.** Hoy mandas `productos` (texto legible) que no es JSON válido. |
| ❌ FALTA | `contact_id` | Necesario para guardar el ID de Siigo de vuelta en el contacto. |
| ⚠️ MAL | `forma_pago` = `{{contact.forma_de_pago_preferida}}` | Debe salir de la oportunidad: `{{opportunity.forma_pago}}` |
| ⚠️ MAL | `cliente_ciudad` = `{{contact.country}}` | Apunta al campo nativo **Country** (vacío en B2B). Debe ser `{{contact.cliente_ciudad}}` |
| ⚠️ MAL | `cliente_direccion` = `{{contact.full_address}}` | Debe ser `{{contact.cliente_direccion}}` |
| ➕ FALTAN | fiscales | `tipo_documento`, `razon_social`, `tipo_persona`, `responsabilidad_fiscal`, `state_code`, `city_code`, contacto\_\* |

---

## ✅ Custom Data COMPLETO — reemplaza todo por esta lista

Borra los pares actuales y deja **exactamente estos 24**. La columna izquierda es la
**Key** (respétala tal cual, Make depende de ella). La derecha es el **Value** — mejor
insértalo con el icono de etiqueta 🏷️ buscando el campo por su **nombre visible**, así
GHL pone el token correcto sin que tengas que escribir los acentos raros.

| # | Key (izquierda) | Value / token GHL (derecha) | Campo visible a buscar en 🏷️ |
|---|---|---|---|
| 1 | `opportunity_id` | `{{opportunity.id}}` | Opportunity Id |
| 2 | `contact_id` | `{{contact.id}}` | Contact Id |
| 3 | **`cliente_nuevo`** ⭐ | `{{opportunity.cliente_nuevo}}` | Cliente Nuevo |
| 4 | **`productos_siigo`** ⭐ | `{{opportunity.productos_siigo}}` | Productos Siigo |
| 5 | `tipo_documento` | `{{contact.tipo_de_identificacin}}` | Tipo de Identificación |
| 6 | `nit_cliente` | `{{contact.nmero_de_identificacin}}` | Número de Identificación |
| 7 | `razon_social` | `{{contact.razn_social}}` | Razón Social |
| 8 | `nombre_comercial` | `{{opportunity.nombre_comercial}}` | Nombre Comercial |
| 9 | `tipo_persona` | `{{contact.tipo_persona}}` | Tipo Persona |
| 10 | `responsabilidad_fiscal` | `{{contact.responsabilidad_fiscal}}` | Responsabilidad Fiscal |
| 11 | `direccion` | `{{contact.cliente_direccion}}` | Cliente Direccion |
| 12 | `ciudad` | `{{contact.cliente_ciudad}}` | Cliente Ciudad |
| 13 | `state_code` | `{{contact.cliente_state_code}}` | Cliente State Code |
| 14 | `city_code` | `{{contact.cliente_city_code}}` | Cliente City Code |
| 15 | `email_facturacion` | `{{opportunity.email_facturacin}}` | Email Facturación |
| 16 | `telefono` | `{{contact.phone}}` | Phone |
| 17 | `contacto_nombre` | `{{contact.contacto_nombre}}` | Contacto Nombre |
| 18 | `contacto_apellido` | `{{contact.contacto_apellido}}` | Contacto Apellido |
| 19 | `contacto_email` | `{{contact.contacto_email}}` | Contacto Email |
| 20 | `id_cliente_siigo` | `{{contact.id_cliente_siigo}}` | ID Cliente Siigo |
| 21 | `forma_pago` | `{{opportunity.forma_pago}}` | Forma Pago |
| 22 | `vendedora` | `{{opportunity.vendedora_nombre}}` | Vendedora Nombre |
| 23 | `notas` | `{{opportunity.notas_del_pedido}}` | Notas del Pedido |
| 24 | `total` | `{{opportunity.total_pedido}}` | Total Pedido |

⭐ = **críticos**. Si solo pudieras agregar dos, son estos.

> Opcional: puedes dejar `productos` (`{{opportunity.productos_del_pedido}}`) como campo
> extra para lectura humana, pero **no reemplaza** a `productos_siigo`.

---

## ⚠️ Antes de probar — verifica el Create Opportunity

Los pares `#3 cliente_nuevo` y `#4 productos_siigo` salen de **campos de la oportunidad**.
Para que tengan valor, el paso **Create Opportunity** del workflow *Recibir Pedido B2B*
debe mapear:

| Campo oportunidad | Valor del webhook de entrada |
|---|---|
| Cliente Nuevo | `{{inboundWebhookRequest.cliente_nuevo}}` |
| Productos Siigo | `{{inboundWebhookRequest.productos_siigo}}` |

> En tu captura (imagen 3) los nodos **Create Opportunity** tienen un punto rojo ❗ —
> eso indica que aún tienen campos sin completar. Resuélvelos: sin `cliente_nuevo` y
> `productos_siigo` en la oportunidad, este webhook los mandará vacíos y Make fallará.

---

## Cómo lo lee Make (para que cuadre con el blueprint FIX)

Cada llave llega a Make como `1.customData.LLAVE`. El blueprint corregido ya apunta a:

```
1.customData.cliente_nuevo          → router (true / false)
1.customData.productos_siigo        → items de la factura
1.customData.tipo_documento         → deriva person_type (31=Company)
1.customData.razon_social           → name (array)
1.customData.state_code / city_code → dirección DANE Siigo
1.customData.opportunity_id         → PUT oportunidad (marcar facturada)
1.customData.contact_id             → PUT contacto (guardar id_cliente_siigo)
```

Todo esto ya viene resuelto en `WOW_Aprobar_y_Facturar_FIX.blueprint.json`
(acabo de corregir la URL del PUT de contacto para que use `1.customData.contact_id`).
