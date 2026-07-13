# Comprobante de pago → Media Library de GHL (módulo 34 del HUB)

## Qué ya quedó listo (por API)

- El **formulario** ahora sube el comprobante como **`multipart/form-data`** (archivo binario real),
  no como base64 en JSON. Así el webhook de Make lo recibe como un archivo nativo.
- El escenario HUB (`5110499`) recibe el archivo en el módulo webhook. Al inspeccionarlo, el archivo
  llega como el objeto **`1.file`** con esta forma:

  ```
  1.file = { name, mime, data, files }
      1.file.data  → binario del archivo   ← esto va al campo "Data" de la subida
      1.file.name  → nombre original
      1.file.mime  → tipo (image/png, application/pdf, …)
  ```

- El resto de la ruta comprobante ya funciona y está probado:
  - **módulo 38** busca la oportunidad por consecutivo,
  - **módulo 35** guarda la URL devuelta por GHL en el campo `comprobante_url` de la oportunidad,
  - **módulo 36** responde.

## Lo único que falta: 1 ajuste en el editor visual de Make

**Por qué a mano:** la subida de archivos `multipart/form-data` del módulo HTTP de Make **no puede
armarse por la API de blueprints** — el binario nunca se serializa (probado exhaustivamente: Make
envía un multipart vacío). El campo de archivo solo queda funcional cuando se configura una vez en
el editor visual, que enlaza el manejo interno de archivos de Make. Es un ajuste de 1 minuto.

### Pasos

1. Make → escenario **“WOW - Buscar Cliente Siigo”** (5110499).
2. Antes de nada, en el **módulo webhook** (el primero) haz clic en **“Redetermine data structure”**
   y, desde el formulario, sube un pedido de prueba con comprobante (transferencia anticipada). Así
   Make “aprende” que llega un archivo y podrás mapearlo.
3. Abre el **módulo HTTP de la ruta `comprobante`** (filtro `action = comprobante`; es el que sube a
   `…/medias/upload-file`).
4. Configúralo así:
   - **URL:** `https://services.leadconnectorhq.com/medias/upload-file`
   - **Method:** `POST`
   - **Headers:**
     - `Authorization: Bearer <PIT de GHL>`
     - `Version: 2021-07-28`
   - **Body content type:** `Multipart/form-data`
   - **Fields:**
     - Campo 1 — **Field type: File** ·
       *Data* = el archivo del webhook (`1.file`) ·
       *File name* = `{{1.consecutivo}}-{{1.file.name}}`
     - Campo 2 — **Field type: Text** · *Key* = `hosted` · *Value* = `false`
5. **Guarda** y confirma que el escenario queda **ON**.

### Verificación

GHL responde `{ fileId, url, traceId }`. La `url` (algo como
`https://assets.cdn.filesafe.space/<location>/media/<uuid>.png`) es la que el módulo 35 escribe en
`comprobante_url` de la oportunidad → clic y se ve la imagen. Esa misma URL viaja a Siigo en las
`observations` de la factura.

## Nota

La subida directa a GHL con `curl -F "file=@archivo" -F "hosted=false"` está **verificada** y
devuelve la URL correcta, así que el endpoint y el token funcionan; el único punto es el enlace del
campo de archivo en Make (paso 4).
