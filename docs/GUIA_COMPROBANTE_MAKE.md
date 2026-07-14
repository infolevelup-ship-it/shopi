# Comprobante de pago → Media Library de GHL — ✅ FUNCIONANDO

Verificado end-to-end: el formulario sube el comprobante → Make lo guarda en la Media Library de
GHL → la URL queda en el campo `comprobante_url` de la oportunidad → la imagen abre (HTTP 200).

## Cómo quedó el flujo (escenario HUB 5110499, ruta `action = comprobante`)

```
Formulario (multipart/form-data) → Webhook Make
  1.file = { name, mime, data }        ← archivo binario real
        │
   [34] HTTP POST /medias/upload-file  (multipart) → GHL responde { url }
        │
   [38] HTTP GET  /opportunities/search?q={{consecutivo}}   → encuentra la Opp
        │
   [35] HTTP PUT  /opportunities/{id}  → guarda la url en comprobante_url
        │
   [36] Webhook response → { url, opportunity }
```

## Configuración exacta de cada módulo (la que funciona)

### Módulo 34 — subida del archivo (esto SOLO se configura en el editor visual de Make)
La subida `multipart/form-data` de un archivo **no se puede armar por la API de blueprints** de
Make (probado: envía un multipart vacío). Hay que configurarla una vez en el editor. Estructura
real que genera Make (`multipartBodyContent`):

```json
[
  { "name": "file",   "multipartFieldType": "file",
    "data": "{{1.file.data}}",
    "fileName": "{{1.consecutivo}}-{{1.file.name}}" },
  { "name": "hosted", "multipartFieldType": "text", "value": "false" }
]
```

- **Body content type:** `Multipart/form-data`
- **Field 1:** *Field type* = **File** · *Name* = `file` · *Data* = `1.file: data` ·
  *File name* = `{{1.consecutivo}}-{{1.file: name}}`
- **Field 2:** *Field type* = **Text** · *Name* = `hosted` · *Value* = `false`
- Headers: `Authorization: Bearer <PIT>`, `Version: 2021-07-28`

> ⚠️ El nombre de la parte (**Name**) debe ser `file` — GHL lo exige. Si queda vacío, GHL responde
> `400 Upload error: Unexpected end of form`. (Ese era el error: la API de Make usa la propiedad
> `name`, no `key`, y `multipartFieldType`, no `fieldType`.)

### Módulo 35 — guardar la URL en la oportunidad
- **URL:** `https://services.leadconnectorhq.com/opportunities/{{38.data.opportunities[1].id}}`
  ⚠️ Usar **corchetes** `[1].id`. `get(38.data.opportunities; 1).id` devuelve el objeto completo →
  URL inválida → `404 Opportunity not found`.
- **Method:** PUT · **Body (JSON):**
  ```json
  { "customFields": [ { "id": "zZT2qzmsEktHdV8Nlccw", "field_value": "{{34.data.url}}" } ] }
  ```
- Headers: `Authorization`, `Version: 2021-07-28`, `Accept: application/json`, `Content-Type: application/json`

## Notas importantes descubiertas

- **Lectura de custom fields de oportunidad:** GHL devuelve los valores puestos por API bajo la clave
  **`fieldValue`**, y los puestos por workflow nativo bajo `fieldValueString`. El formulario ya lee
  ambas (no requiere cambios).
- **Preparar el webhook una vez:** como el formulario ahora manda el archivo como binario real, en
  Make hay que ejecutar **"Run this module"** sobre el webhook y enviar un comprobante de prueba una
  vez, para que Make "aprenda" el campo `file`. Después el mapeo `1.file` queda disponible.
- La subida directa a GHL con `curl -F "file=@archivo" -F "hosted=false"` está verificada.

## Pendiente opcional (para que el comprobante llegue a Siigo)
El comprobante ya está en GHL. Para que su URL viaje a la factura de Siigo:
1. Webhook GHL "Disparar Facturación" → agregar par `comprobante_url` = `{{opportunity.comprobante_url}}`.
2. Escenario Facturación (5589725) → agregar la URL a las `observations` de la factura.
