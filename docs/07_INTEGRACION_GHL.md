# WOW SALES — 07. INTEGRACIÓN CON GOHIGHLEVEL

## 1. Objetivo

Mantener GHL como CRM/comunicación sin convertirlo en la fuente primaria de la operación.

## 2. Arquitectura

```text
WOW
 ↓
Backend
 ↓
GHL API
```

Los webhooks pueden existir para eventos externos, pero no deben ser necesarios para la lógica crítica de pedidos y facturación.

## 3. Contacto

Al crear/actualizar cliente:

```text
WOW customer
→ upsert GHL contact
→ guardar ghl_contact_id
```

## 4. Oportunidad

Al crear pedido:

```text
WOW order
→ create GHL opportunity
→ guardar ghl_opportunity_id
```

La API de Oportunidades de HighLevel admite crear oportunidades asociadas a contactos y gestionar pipeline/etapa/owner; el payload exacto debe verificarse con la versión vigente durante implementación.

## 5. Pipeline

GHL puede seguir reflejando:

```text
Adquisición B2B
Recompras B2B
B2C
```

pero WOW conserva el estado operativo real.

## 6. Owner

WOW:

```text
seller_id
```

GHL:

```text
ghl_user_id
```

No sustituir uno por el otro.

## 7. Custom fields

Centralizar mapping:

```text
field business key
→
GHL field ID
```

No repartir IDs de custom field por cada componente.

## 8. Sync status

Guardar:

```text
ghl_sync_status
ghl_last_synced_at
ghl_sync_error
```

## 9. Si GHL está caído

```text
WOW pedido ✓
GHL sync ✗
```

Debe existir:

```text
retry
```

sin invalidar automáticamente el pedido.

## 10. No buscar por nombre

Guardar IDs y usar IDs.

No:

```text
buscar “Salón Andrea 1548”
```

si tenemos:

```text
ghl_opportunity_id
```

## 11. Webhooks

Sólo usar cuando GHL necesite informar a WOW.

```text
POST /api/webhooks/ghl
```

Debe:

- autenticar;
- deduplicar;
- registrar;
- procesar.

## 12. Cambios manuales en GHL

Regla recomendada:

> Cambiar una etapa manualmente en GHL nunca debe crear una factura fiscal.

La facturación se ejecuta desde WOW por el rol autorizado.

## 13. Migración

Durante transición:

```text
WOW → GHL
```

y los workflows antiguos pueden mantenerse sólo cuando sean necesarios.

## 14. Objetivo

Llegar a:

```text
0 dependencia crítica de Make
```

## 15. Seguridad

Utilizar integración privada/tokens apropiados y permisos mínimos.

## 16. Pruebas

```text
upsert contact
create opportunity
update
assign owner
retry
duplicate
401
403
429
5xx
webhook duplicate
```

## 17. Principio final

GHL aporta CRM y comunicación. WOW controla el negocio.
