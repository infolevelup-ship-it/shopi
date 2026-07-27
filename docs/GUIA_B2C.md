# Switch B2C — formulario + workflow

## Lado formulario (ya implementado)
Toggle **B2B / B2C** arriba. Al elegir **B2C**:
- Precio por defecto **Público**.
- Botón **"Consumidor final"** → cliente genérico NIT `222222222222`, nombre "CONSUMIDOR FINAL",
  persona natural, precio Público (marcado como existente en Siigo).
- **Retención oculta** y forzada a "No aplica".
- **Forma de pago solo Contado** (se ocultan crédito 30/60).
- El pedido viaja con **`canal: "B2C"`** (top-level en el payload) → el workflow rutea por eso.
- `getPipelineConfig()` devuelve pipeline **"B2C"**, stage **"Pedido nuevo"**.

## Lado workflow "Recibir Pedido B2B" (pendiente en GHL — UI)
Agregar una **rama B2C** en el router (o un If/Else), con ramas mutuamente excluyentes por canal:

| Rama | Condición | Create Opportunity → Pipeline / Stage |
|---|---|---|
| **B2C** (nueva) | `{{inboundWebhookRequest.canal}}` = `B2C` | Pipeline **B2C** (`EgkKJxN1sNIZFrCsz9HG`) · Stage **Pedido nuevo** (`bab58327-7b23-459c-a24f-461a1b9dafe8`) |
| B2B nuevo | `canal` = `B2B` **Y** `cliente_nuevo` = `true` | Cliente Nuevo B2B · Prospecto nuevo |
| B2B antiguo | `canal` = `B2B` **Y** `cliente_nuevo` = `false` | Cliente Antiguo B2B · Pedido tomado |

> Importante: añadir `canal = B2B` a las 2 ramas B2B existentes para que un pedido B2C no
> caiga también en una rama B2B.

En el **Create Opportunity de la rama B2C**, usar **los mismos mapeos de campos** que las ramas
B2B (Opportunity Name, Monetary Value, Assigned To, y todos los custom fields: cliente_nuevo,
productos_siigo, consecutivo, comprobante_url, total, etc.) y **Estado Facturación = `Pendiente`**.

## Facturación B2C
No cambia nada: reusa el mismo escenario Make, doc 5491, filtro humano ("Facturado") y el
candado anti-doble-factura. El consumidor final `222222222222` debe existir en Siigo (la mayoría
de cuentas lo traen; si no, crearlo una vez).
