# WOW SALES — 05. ROLES, PERMISOS Y SEGURIDAD

## 1. Roles

```text
SELLER
WAREHOUSE
SUPERVISOR
ADMIN
```

## 2. Seller

Puede:

- crear pedidos;
- crear cotizaciones;
- consultar clientes;
- crear clientes;
- hacer seguimiento;
- ver cartera;
- consultar productos.

No puede:

- facturar;
- editar factura;
- cambiar propietario;
- modificar pedidos bloqueados;
- borrar registros críticos.

## 3. Warehouse

Puede:

- revisar;
- validar stock;
- imprimir;
- aprobar;
- facturar;
- despachar;
- ver errores operativos.

No puede borrar facturas.

## 4. Supervisor

Puede:

- consultar equipo;
- consultar carteras;
- reasignar;
- revisar pedidos;
- ver reportes;
- corregir ciertos datos con auditoría.

## 5. Admin

Puede:

- administrar usuarios;
- configurar sistema;
- gestionar integraciones;
- ejecutar sincronizaciones;
- reconciliar;
- auditar.

## 6. Matriz

| Acción | Seller | Warehouse | Supervisor | Admin |
|---|---:|---:|---:|---:|
| Crear pedido | ✓ | — | ✓ | ✓ |
| Editar pedido editable | ✓ | — | ✓ | ✓ |
| Revisar pedido | — | ✓ | ✓ | ✓ |
| Aprobar | — | ✓ | ✓ | ✓ |
| Facturar | — | ✓ | según política | ✓ |
| Despachar | — | ✓ | ✓ | ✓ |
| Reasignar cliente | — | — | ✓ | ✓ |
| Usuarios | — | — | — | ✓ |
| Auditoría global | — | — | ✓ | ✓ |

## 7. RLS

Cada tabla expuesta debe tener políticas de acceso.

Vendedora:

```text
su cartera
sus operaciones
su actividad
```

Bodega:

```text
pedidos operativos necesarios
```

Supervisor/Admin:

```text
acceso ampliado
```

Supabase recomienda RLS para autorización de filas y que las claves privilegiadas permanezcan del lado servidor.

## 8. Backend authorization

Siempre volver a comprobar el rol en backend.

Ejemplo:

```text
POST /orders/:id/invoice
```

requiere:

```text
WAREHOUSE o ADMIN
```

y condiciones de estado.

## 9. Secretos

Nunca exponer:

```text
SIIGO_ACCESS_KEY
GHL_PRIVATE_TOKEN
SUPABASE_SERVER_SECRET
```

## 10. Auditoría

Auditar:

```text
crear
editar
aprobar
devolver
facturar
cancelar
reasignar
override
```

## 11. Sesiones

Cada usuario:

- cuenta individual;
- logout;
- sesión controlada;
- usuario desactivable;
- tokens seguros.

## 12. Archivos

Validar:

```text
MIME
tamaño
nombre
checksum
```

Los comprobantes deben tener acceso controlado.

## 13. Webhooks

Un webhook entrante debe:

```text
validar
deduplicar
registrar
procesar
```

Nunca ejecutar una acción fiscal sólo porque llegó un POST.

## 14. Concurrencia

Facturación:

```text
lock / condición de estado / idempotency
```

Dos usuarios nunca pueden crear dos facturas para el mismo pedido.

## 15. Backups

Producción debe contar con:

- backup de DB;
- backup de archivos;
- procedimiento de restore;
- pruebas periódicas de recuperación.

## 16. Staging

Debe existir:

```text
development
staging
production
```

La facturación real no se prueba a la ligera en producción.

## 17. Principio

El diseño de seguridad debe seguir:

> mínimo privilegio + trazabilidad + recuperación.
