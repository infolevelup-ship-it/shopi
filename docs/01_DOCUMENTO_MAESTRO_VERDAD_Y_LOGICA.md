# WOW SALES — Documento Maestro de Verdad y Lógica de Construcción
## Versión 1.0 — Documento funcional, operativo y arquitectónico

> **Propósito:** definir antes de programar cómo debe funcionar la nueva plataforma de WOW, qué reglas de negocio son obligatorias, cuál sistema es fuente de verdad para cada dato, cómo deben trabajar las vendedoras y bodega, cómo se relacionan clientes, cotizaciones, pedidos, inventario y facturación, y qué responsabilidades tendrá cada componente.
>
> Este documento es la **fuente de verdad del proyecto**. La interfaz, base de datos, APIs y código deben construirse alrededor de estas reglas y no al revés.

---

# 0. Principio rector

La nueva plataforma no debe ser una copia visual del HTML actual ni una migración mecánica de Make.

Debe reconstruir el proceso comercial y operativo de WOW de forma que:

1. Las vendedoras trabajen más rápido.
2. Los clientes no se dupliquen ni se solapen entre vendedoras.
3. Los pedidos tengan trazabilidad completa.
4. El inventario utilizado para decidir si se puede despachar provenga de Siigo.
5. Solo el rol autorizado pueda convertir un pedido en factura electrónica.
6. Una factura no pueda generarse dos veces accidentalmente.
7. Los errores de integración sean visibles y recuperables.
8. Toda acción importante quede registrada.
9. La empresa conserve el conocimiento aunque cambien las personas.
10. La plataforma sea la fuente principal de información comercial y operativa de WOW.
11. GoHighLevel y Siigo se integren con la plataforma, pero no dicten toda la lógica interna.
12. Las automatizaciones no sean parches: las reglas deben vivir en el backend y la base de datos.

## Regla principal

> **La vendedora trabaja; la plataforma registra, calcula, organiza, valida, recuerda y alerta.**

---

# 1. Problema que estamos resolviendo

El sistema actual fue construido incrementalmente con:

- HTML/JavaScript.
- GoHighLevel.
- Make.
- Google Apps Script / Google Sheets.
- API de Siigo.

El sistema funciona, pero la lógica está distribuida.

Actualmente:

```text
HTML
  ↓
Make
  ↓
GHL
  ↓
Make
  ↓
Siigo
  ↓
GHL
```

Esto genera:

- condiciones de carrera;
- búsquedas frágiles;
- errores silenciosos;
- dependencias de delays;
- dificultad para modificar procesos;
- riesgo de duplicar facturas;
- duplicación de clientes;
- dificultad para saber cuál es el estado real;
- lógica repartida entre varias plataformas;
- dependencia de escenarios de Make;
- dificultad para crear reportes confiables;
- imposibilidad de tener una verdadera auditoría centralizada.

La nueva aplicación debe resolver estos problemas mediante un backend y una base de datos propios.

---

# 2. Arquitectura conceptual

La arquitectura objetivo es:

```text
                         ┌───────────────────────┐
                         │       WOW SALES       │
                         │       Frontend        │
                         └───────────┬───────────┘
                                     │
                                     ▼
                         ┌───────────────────────┐
                         │       BACKEND         │
                         │ Reglas de negocio     │
                         │ Seguridad             │
                         │ Permisos              │
                         │ Integraciones         │
                         │ Auditoría             │
                         └───────────┬───────────┘
                                     │
                                     ▼
                         ┌───────────────────────┐
                         │       SUPABASE        │
                         │ Base de datos         │
                         │ Auth                  │
                         │ Storage               │
                         │ Logs                  │
                         └───────────┬───────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
                 SIIGO              GHL          Reportes
              Fiscal/Inventario   CRM/Marketing   Internos
```

## 2.1 Responsabilidad de cada sistema

### WOW Sales / Supabase

Será la fuente principal para:

- usuarios;
- roles;
- clientes comerciales;
- asignación de clientes;
- prospectos;
- cotizaciones;
- pedidos;
- estados;
- seguimientos;
- actividades;
- métricas;
- auditoría;
- relación pedido ↔ factura;
- relación cliente ↔ pedidos;
- información operacional.

### Siigo

Será la fuente de verdad para:

- facturación electrónica;
- documento fiscal;
- número de factura;
- identificación fiscal del documento;
- estado fiscal de la factura;
- información de inventario que WOW utilice para validación de disponibilidad;
- clientes y productos cuando estos deban consultarse contra Siigo.

La aplicación puede almacenar una copia sincronizada/caché para velocidad, pero **no debe inventar stock ni asumir que un dato local es fiscalmente definitivo**.

### GoHighLevel

Inicialmente continuará siendo:

- CRM existente;
- comunicación;
- automatizaciones que todavía sean necesarias;
- pipelines existentes mientras dure la transición;
- destino de información que WOW necesite mantener sincronizada.

Pero GHL deja de ser el motor central del proceso de pedidos.

### Make / n8n

La arquitectura objetivo **no los necesita para el funcionamiento normal**.

Podrán existir temporalmente durante la migración o para procesos secundarios que todavía no se hayan reemplazado, pero el flujo crítico:

```text
pedido → revisión → inventario → aprobación → factura
```

debe poder funcionar sin Make ni n8n.

---

# 3. Fuentes de verdad

Esta sección es obligatoria.

Nunca debe existir la pregunta:

> "¿Cuál dato debo creer?"

Debe existir una definición previa.

| Dato | Fuente principal |
|---|---|
| Usuario / rol | WOW / Supabase |
| Responsable comercial del cliente | WOW / Supabase |
| Historial comercial | WOW / Supabase |
| Cotizaciones | WOW / Supabase |
| Pedidos | WOW / Supabase |
| Estado operacional del pedido | WOW / Supabase |
| Seguimientos | WOW / Supabase |
| Actividades | WOW / Supabase |
| Inventario fiscal/operativo de Siigo | Siigo |
| Factura electrónica | Siigo |
| Número de factura | Siigo |
| ID de factura Siigo | Siigo |
| Estado fiscal | Siigo |
| Integración con GHL | WOW controla qué se envía; GHL conserva su información CRM |
| Reportes comerciales | WOW / Supabase |
| Auditoría de acciones | WOW / Supabase |

## Regla

Un dato externo se puede copiar a WOW para facilitar búsquedas y reportes, pero debe quedar identificado como:

- dato sincronizado;
- fecha de sincronización;
- sistema de origen;
- identificador externo.

---

# 4. Roles del sistema

Inicialmente se contemplan cuatro roles.

## 4.1 Vendedora

Puede:

- iniciar sesión;
- consultar clientes;
- consultar productos;
- crear clientes;
- solicitar/crear cotizaciones;
- crear pedidos;
- editar pedidos mientras el estado lo permita;
- registrar seguimientos;
- consultar historial comercial;
- consultar sus métricas;
- consultar información de clientes asignados;
- registrar actividades.

No puede:

- facturar directamente en Siigo desde el flujo normal;
- modificar una factura emitida;
- eliminar una factura;
- cambiar arbitrariamente la responsable comercial de un cliente;
- editar pedidos que ya estén bloqueados para facturación;
- alterar registros históricos críticos;
- modificar información de auditoría.

## 4.2 Responsable de bodega / despacho

Es un rol crítico.

Puede:

- ver pedidos pendientes de revisión;
- revisar pedidos;
- consultar inventario actualizado;
- verificar productos;
- verificar cantidades;
- verificar precios;
- verificar comprobantes;
- imprimir recibos;
- aprobar pedidos para facturación;
- ejecutar la facturación;
- consultar resultado de Siigo;
- registrar despacho;
- consultar pedidos facturados;
- ver errores de facturación;
- reintentar operaciones seguras cuando corresponda.

No puede:

- modificar libremente el contenido comercial del pedido sin trazabilidad;
- cambiar la vendedora responsable;
- eliminar pedidos;
- borrar facturas;
- volver a facturar un pedido que ya tiene una factura registrada.

## 4.3 Supervisor

Puede:

- ver todas las vendedoras;
- ver todas las carteras;
- reasignar clientes según reglas;
- revisar pedidos;
- revisar cotizaciones;
- revisar seguimientos;
- consultar métricas;
- revisar clientes en riesgo;
- consultar auditoría;
- corregir determinados datos operativos con registro de auditoría.

## 4.4 Administrador

Puede:

- administrar usuarios;
- activar/desactivar usuarios;
- definir permisos;
- configurar catálogos;
- configurar reglas;
- administrar integraciones;
- revisar logs;
- revisar errores;
- ejecutar procesos de sincronización;
- acceder a auditoría completa.

---

# 5. Regla fundamental de propiedad del cliente

Cada cliente debe tener un:

```text
responsable_comercial_id
```

La plataforma debe impedir que dos vendedoras trabajen simultáneamente el mismo cliente sin saberlo.

## Ejemplo

```text
Cliente: Salón Andrea
Responsable: Karina
```

Si Ivonne encuentra el cliente:

```text
⚠ Cliente asignado a Karina
Última actividad: hace 2 horas
```

Puede consultar la información, pero para asumir la gestión debe existir una acción controlada:

```text
Solicitar reasignación
```

o un permiso especial.

## No confundir:

### Responsable comercial

Persona que administra la relación.

### Vendedora de la operación

Persona que realizó una venta concreta.

Ejemplo:

```text
Cliente
Responsable: Karina

Pedido #1548
Vendedora de la operación: Melissa
```

Esto permite vacaciones, reemplazos y apoyo sin destruir la propiedad de la cartera.

---

# 6. Prevención de solapamiento

La plataforma debe detectar:

- cliente asignado a otra vendedora;
- cotización activa de otra vendedora;
- pedido abierto;
- seguimiento pendiente;
- contacto reciente;
- oportunidad comercial activa.

Antes de permitir una nueva acción comercial, puede mostrar:

```text
Este cliente ya está siendo gestionado.

Responsable: Karina
Última actividad: hoy 10:42
Cotización activa: #874

[Ver cliente]
[Solicitar gestión]
```

El sistema debe favorecer colaboración controlada, no duplicación.

---

# 7. Identidad única del cliente

La plataforma debe tratar la identificación fiscal como dato crítico.

Para personas jurídicas:

```text
tipo_identificacion
identificacion
```

Para personas naturales:

```text
tipo_identificacion
identificacion
```

Debe existir una estrategia de normalización para evitar:

```text
90.123.456-7
901234567
901234567-0
```

como clientes independientes cuando representan la misma identificación según las reglas de negocio.

## Regla

Antes de crear un cliente:

1. buscar identificación normalizada;
2. buscar teléfono;
3. buscar correo cuando aplique;
4. revisar coincidencias;
5. advertir posibles duplicados;
6. evitar creación automática si existe una coincidencia fuerte.

---

# 8. Clientes y sincronización con Siigo

La plataforma debe diferenciar:

### Cliente comercial WOW

La entidad utilizada para gestionar la relación.

### Cliente fiscal Siigo

El registro utilizado por Siigo para facturación.

La relación será:

```text
wow_customer.id
       │
       └── siigo_customer_id
```

Nunca se debe guardar solamente el nombre como relación.

## Al crear cliente

Flujo conceptual:

```text
Vendedora crea cliente
       ↓
WOW valida duplicados
       ↓
¿Existe cliente WOW?
   ├── Sí → reutilizar
   └── No
       ↓
¿Existe cliente Siigo?
   ├── Sí → asociar
   └── No → crear en Siigo
       ↓
Guardar siigo_customer_id
```

La creación debe ser idempotente.

---

# 9. Productos

Actualmente existe un catálogo de aproximadamente 1.600 productos.

La aplicación debe disponer de una tabla propia de productos sincronizados.

Ejemplo conceptual:

```text
products

id
siigo_product_id
codigo
nombre
descripcion
precio
activo
stock_cache
stock_updated_at
```

## Importante

El catálogo local existe para:

- búsqueda rápida;
- filtros;
- autocompletado;
- selección de productos;
- construcción de pedidos;
- reportes.

Pero el inventario definitivo para aprobar un pedido debe validarse contra Siigo.

---

# 10. Inventario

La regla es:

> **Siigo es la fuente de verdad del inventario utilizado para aprobar/despachar.**

Puede existir:

```text
stock_cache
```

para mostrar rápidamente una cantidad aproximada.

Pero al momento crítico:

```text
APROBAR PARA FACTURAR
```

se debe consultar el inventario actual según las capacidades reales de la API de Siigo.

## Ejemplo

Pedido:

```text
Olaplex Nº4
Solicitado: 10
```

Siigo:

```text
Disponible: 6
```

Resultado:

```text
❌ No se puede aprobar

Solicitado: 10
Disponible: 6
Faltante: 4
```

La plataforma debe impedir continuar hasta que:

- se modifique el pedido;
- se resuelva el inventario;
- o un rol autorizado aplique una excepción explícita y auditada.

---

# 11. Ciclo de vida del cliente

El cliente no debe confundirse con el pedido.

Un cliente puede tener:

- muchos pedidos;
- muchas cotizaciones;
- muchas actividades;
- múltiples seguimientos;
- diferentes periodos de inactividad.

Estados posibles:

```text
PROSPECTO
   ↓
ACTIVO
   ↓
INACTIVO
   ↓
RECUPERACIÓN
   ↓
ACTIVO
```

Los estados deben definirse mediante reglas claras, no por interpretación personal.

---

# 12. Ciclo de vida del prospecto

Un prospecto puede tener:

```text
PROSPECTO
↓
CONTACTADO
↓
INTERESADO
↓
COTIZACIÓN
↓
NEGOCIACIÓN
↓
GANADO
↓
CLIENTE
```

También:

```text
PERDIDO
```

y debe registrar:

```text
motivo_perdida
fecha_perdida
usuario
```

Motivos iniciales:

- precio;
- falta de presupuesto;
- competencia;
- no responde;
- producto no disponible;
- otro.

La lista debe ser configurable.

---

# 13. Ciclo de vida de una cotización

Una cotización debe tener identidad propia.

```text
BORRADOR
   ↓
ENVIADA
   ↓
EN SEGUIMIENTO
   ↓
ACEPTADA
   ↓
CONVERTIDA EN PEDIDO
```

o:

```text
PERDIDA
EXPIRADA
CANCELADA
```

Debe registrar:

```text
created_at
sent_at
follow_up_at
accepted_at
lost_at
converted_at
```

No se deben calcular fechas históricas retroactivamente si no existe evidencia.

---

# 14. Ciclo de vida de un pedido

Propuesta base:

```text
BORRADOR
   ↓
ENVIADO
   ↓
PENDIENTE DE REVISIÓN
   ↓
REVISIÓN
   ↓
APROBADO PARA FACTURAR
   ↓
FACTURANDO
   ↓
FACTURADO
   ↓
DESPACHADO
   ↓
ENTREGADO
```

Estados de excepción:

```text
DEVUELTO A VENDEDORA
CANCELADO
ERROR DE FACTURACIÓN
BLOQUEADO
```

## Importante

No todos los estados deben ser editables manualmente.

---

# 15. Estado de pedido vs estado de facturación

No deben ser el mismo campo.

Ejemplo:

```text
order_status = APROBADO_PARA_FACTURAR

invoice_status = PENDIENTE
```

Después:

```text
order_status = FACTURANDO

invoice_status = PROCESANDO
```

Después:

```text
order_status = FACTURADO

invoice_status = FACTURADA
```

Esto evita mezclar operación comercial con estado fiscal.

---

# 16. Revisión de bodega

La revisión es una etapa formal.

Al abrir el pedido:

```text
PEDIDO #1548

Cliente
Vendedora
Fecha
Total

PRODUCTOS
Código | Producto | Cantidad | Stock

PAGO
Forma de pago
Comprobantes

DOCUMENTACIÓN
Datos fiscales
Dirección
Ciudad
Responsabilidad fiscal
```

Checklist:

```text
☐ Cliente correcto
☐ Productos correctos
☐ Cantidades correctas
☐ Precios correctos
☐ Inventario disponible
☐ Forma de pago correcta
☐ Comprobante verificado
☐ Datos fiscales correctos
```

Cuando todo esté correcto:

```text
[APROBAR PARA FACTURAR]
```

---

# 17. Impresión del recibo

El proceso físico actual se conserva.

```text
Pedido
 ↓
Generar recibo
 ↓
Imprimir
 ↓
Verificación física
 ↓
Aprobación
 ↓
Facturación
```

La impresión debe poder generar una representación consistente del pedido.

Debe incluir:

- consecutivo;
- cliente;
- identificación;
- vendedora;
- productos;
- cantidades;
- precios;
- descuentos;
- total;
- forma de pago;
- observaciones;
- fecha;
- estado.

---

# 18. Facturación: regla crítica

Solo el rol autorizado de bodega/despacho puede iniciar la facturación.

No debe existir un botón equivalente para vendedoras.

## Flujo

```text
APROBADO PARA FACTURAR
        ↓
Validación final
        ↓
¿Pedido ya facturado?
   ├── Sí → mostrar factura existente
   └── No
        ↓
Crear operación de facturación
        ↓
Siigo
        ↓
Respuesta
   ├── Éxito → guardar factura
   └── Error → registrar error
```

---

# 19. Protección contra factura duplicada

Este es uno de los requisitos más importantes.

Debe existir una restricción única conceptual:

```text
un pedido operativo
        ↓
máximo una factura fiscal activa asociada
```

La tabla de facturas debe tener como mínimo:

```text
id
order_id
siigo_invoice_id
invoice_number
status
created_at
created_by
```

Y una restricción de unicidad apropiada sobre `order_id` para la factura activa.

## Nunca confiar solamente en:

```text
estado_facturacion = pendiente
```

La protección debe estar en la base de datos y en el backend.

---

# 20. Idempotencia

Una operación de facturación puede ser repetida por:

- doble clic;
- timeout;
- pérdida de conexión;
- reintento;
- error de frontend;
- error de respuesta.

Por eso debe existir una clave de idempotencia interna.

Ejemplo:

```text
invoice_operation_key = WOW-ORDER-1548
```

Si se intenta ejecutar dos veces:

```text
Intento 1 → crea operación
Intento 2 → detecta operación existente
```

El sistema no debe generar dos facturas.

---

# 21. Problema del timeout actual

En el sistema actual existe este riesgo:

```text
POST Siigo /invoices
       ↓
Factura creada
       ↓
timeout
       ↓
actualización GHL no ejecutada
```

La nueva arquitectura no debe asumir que:

```text
timeout = factura no creada
```

Un timeout significa:

> **resultado desconocido**

Por eso la operación debe pasar por un estado como:

```text
FACTURACIÓN_INCIERTA
```

y luego ejecutar una estrategia de reconciliación.

Nunca se debe simplemente volver a crear una factura porque la respuesta HTTP no llegó.

---

# 22. Estados de una operación de facturación

Propuesta:

```text
PENDIENTE
↓
PROCESANDO
↓
CONFIRMADA
```

Errores:

```text
ERROR_REINTENTABLE
ERROR_NO_REINTENTABLE
RESULTADO_INCIERTO
```

Solo una operación confirmada debe producir:

```text
invoice_status = FACTURADA
```

---

# 23. Reconciliación con Siigo

Cuando una operación termina con resultado incierto:

```text
¿Siigo creó factura?
```

La aplicación debe intentar determinarlo mediante los identificadores y datos disponibles antes de crear otra.

Esto debe diseñarse específicamente contra la API real de Siigo durante la fase técnica.

La regla de negocio ya queda definida:

> **Ante una respuesta ambigua, investigar antes de crear otra factura.**

---

# 24. Facturas: documento legal

Una factura electrónica no debe tratarse como un registro normal editable.

Una vez emitida:

- no se edita como un pedido;
- no se elimina desde WOW;
- no se reemplaza silenciosamente;
- queda vinculada al pedido;
- conserva número e identificador Siigo;
- cualquier proceso posterior debe respetar los mecanismos fiscales correspondientes.

La aplicación puede permitir acciones administrativas relacionadas, pero nunca fingir que una factura emitida desapareció.

---

# 25. Pedidos históricos/importados

Debe existir una diferencia estructural entre:

### Pedido operativo

Pedido creado para facturación real mediante WOW.

### Pedido histórico/importado

Registro de una venta que ya ocurrió/fue facturada por otro proceso.

Nunca deben compartir exactamente el mismo flujo de facturación.

Campo:

```text
source_type

LIVE
HISTORICAL
IMPORTED
```

Los históricos:

```text
NO disparan facturación
```

aunque su estado comercial termine mostrando algo equivalente a "facturado".

---

# 26. Eliminar el concepto peligroso de "mover una tarjeta = facturar"

En la plataforma nueva:

```text
cambiar estado
```

no debe ser suficiente para crear una factura.

Debe existir una acción explícita:

```text
FACTURAR EN SIIGO
```

y debe estar protegida por:

- rol;
- permisos;
- estado válido;
- existencia de inventario;
- ausencia de factura;
- validación de datos;
- idempotencia.

---

# 27. Historial de actividades

Cada cliente debe tener una línea de tiempo:

```text
31 AGO
🧾 Pedido #1548
$850.000

29 AGO
📞 Llamada
Interesada en nueva línea

27 AGO
📄 Cotización #874
$1.200.000

10 AGO
🧾 Pedido #1490
$640.000
```

Tipos de actividad:

- llamada;
- WhatsApp;
- correo;
- visita;
- cotización;
- pedido;
- factura;
- despacho;
- nota;
- seguimiento.

---

# 28. Seguimiento inteligente

El sistema debe registrar:

```text
última compra
frecuencia histórica
ticket promedio
días desde última compra
próxima compra estimada
último contacto
próximo seguimiento
```

Ejemplo:

```text
Última compra: 28/08
Frecuencia promedio: 21 días
Próxima compra estimada: 18/09
Hoy: 21/09

Estado:
🔴 Fuera de ciclo
```

Esto no debe reemplazar el criterio comercial de la vendedora. Es una recomendación basada en datos.

---

# 29. Clientes en riesgo

Regla conceptual:

```text
días desde última compra
>
frecuencia habitual + tolerancia
```

Resultado:

```text
CLIENTE EN RIESGO
```

Debe priorizarse según:

- valor histórico;
- ticket promedio;
- frecuencia;
- días fuera de ciclo;
- última interacción;
- cotizaciones abiertas.

---

# 30. Panel diario de la vendedora

La primera pantalla debe responder:

> ¿Qué tengo que hacer hoy?

Ejemplo:

```text
BUENOS DÍAS, KARINA 👋

4 seguimientos vencidos
7 clientes próximos a comprar
3 cotizaciones abiertas
2 pedidos pendientes

VENTAS DEL MES
$42.500.000
```

Prioridades:

```text
1. Cliente fuera de ciclo
2. Cotización de alto valor sin respuesta
3. Cliente de alto valor sin contacto
4. Pedido pendiente de información
```

---

# 31. Dashboard de bodega

Debe responder:

> ¿Qué pedidos puedo procesar ahora?

```text
PENDIENTES DE REVISIÓN       12

APROBADOS                    7

LISTOS PARA FACTURAR         5

FACTURANDO                   1

ERRORES                      2
```

Cada pedido debe indicar:

- antigüedad;
- vendedora;
- cliente;
- valor;
- cantidad de productos;
- disponibilidad;
- estado.

---

# 32. Dashboard administrativo

Debe permitir:

### Ventas

- ventas diarias;
- ventas mensuales;
- ventas por vendedora;
- ventas por cliente;
- ventas por producto.

### Comercial

- clientes nuevos;
- clientes activos;
- clientes inactivos;
- clientes en riesgo;
- cotizaciones;
- conversión;
- motivos de pérdida.

### Operación

- pedidos;
- tiempo de revisión;
- tiempo hasta facturación;
- errores;
- pedidos devueltos;
- facturas procesadas.

### Inventario

- productos con bajo stock;
- productos sin disponibilidad;
- diferencias detectadas.

---

# 33. Métricas de eficiencia

No solamente medir ventas.

Medir también:

```text
Tiempo desde pedido hasta revisión
Tiempo desde aprobación hasta factura
Tiempo desde factura hasta despacho
Porcentaje de pedidos con corrección
Porcentaje de facturación fallida
Porcentaje de cotizaciones convertidas
```

Ejemplo:

```text
Pedido creado
10:20

Revisión
10:32

Aprobación
10:35

Factura
10:37
```

Tiempo total:

```text
17 minutos
```

Estos tiempos deben salir de timestamps reales, no de cálculos manuales.

---

# 34. Auditoría

Las acciones críticas deben quedar registradas.

Ejemplo:

```text
31/08/2026 14:42
Carlos
APROBÓ PEDIDO #1548

31/08/2026 14:44
Carlos
INICIÓ FACTURACIÓN

31/08/2026 14:45
Sistema
FACTURA FV-4-37025 CREADA EN SIIGO
```

También:

```text
Quién
Qué hizo
Sobre qué entidad
Cuándo
Valor anterior
Valor nuevo
Resultado
IP/sesión si aplica
```

No se debe permitir que usuarios normales borren auditoría.

---

# 35. Errores

Se elimina el patrón actual:

```javascript
catch(e){}
```

Los errores importantes deben tener:

```text
estado
mensaje
código
entidad afectada
operación
fecha
usuario
respuesta externa
intentos
```

La interfaz debe mostrar algo útil.

Ejemplo:

```text
⚠ No fue posible consultar Siigo.

El pedido NO fue facturado.

Puedes reintentar de forma segura.
```

Nunca:

```text
Pedido enviado ✔
```

si el sistema no sabe realmente qué ocurrió.

---

# 36. Regla de comunicación con Siigo

Toda integración debe pasar por una capa de integración del backend.

No:

```text
Frontend → Siigo
```

Sí:

```text
Frontend
   ↓
Backend WOW
   ↓
Servicio Siigo
   ↓
Siigo
```

Las credenciales nunca deben estar en:

- HTML;
- JavaScript del navegador;
- Git público;
- variables expuestas al frontend;
- blueprints de automatización.

---

# 37. Autenticación de Siigo

El token de Siigo tiene duración limitada según la documentación actual del sistema existente.

La nueva implementación debe:

- solicitar token;
- almacenarlo temporalmente de forma segura;
- reutilizarlo mientras sea válido;
- renovarlo cuando expire;
- evitar pedirlo en cada operación;
- nunca exponerlo al navegador.

---

# 38. Integración con GHL

Durante la transición puede mantenerse:

```text
WOW
 ↓
API GHL
```

para sincronizar:

- contacto;
- oportunidad;
- datos necesarios;
- estado comercial;
- responsable;
- información de pedido.

Pero la lógica principal debe vivir en WOW.

## Principio

Si GHL está temporalmente caído:

> WOW debe poder seguir operando los procesos que no dependan directamente de GHL.

La integración debe quedar en una cola/reintento cuando sea posible.

---

# 39. Sincronización con GHL

No utilizar delays arbitrarios como:

```text
esperar 7 segundos
```

para garantizar consistencia.

En su lugar:

```text
crear entidad
 ↓
guardar ID real
 ↓
usar ID directamente
```

Cuando una API externa responda con un ID, ese ID debe guardarse.

No volver a buscar una oportunidad por:

```text
nombre
```

si existe un identificador estable.

---

# 40. No usar nombres como identificadores técnicos

El sistema actual sufrió problemas por buscar oportunidades mediante nombre/consecutivo.

En la nueva arquitectura:

```text
customer_id
order_id
quote_id
opportunity_id
siigo_customer_id
siigo_invoice_id
```

son las relaciones técnicas.

Los nombres son para humanos.

Nunca:

```text
buscar "Salón Andrea 1548"
```

como mecanismo principal de integridad.

---

# 41. Consecutivos

WOW debe generar identificadores internos propios.

Ejemplo:

```text
WOW-P-0001548
WOW-C-0000874
```

El formato final debe definirse antes de producción.

El consecutivo debe ser:

- único;
- secuencial según la regla de negocio;
- generado en backend;
- no editable por vendedoras.

---

# 42. Productos en pedidos

Un pedido debe guardar una fotografía histórica de la venta.

Aunque el precio del producto cambie mañana:

```text
Pedido #1548
Olaplex Nº4
Precio vendido: $85.000
```

no debe cambiar retroactivamente porque el catálogo ahora diga:

```text
$90.000
```

Por eso `order_items` debe guardar:

```text
product_id
product_code
product_name_snapshot
unit_price
quantity
discount
tax
subtotal
```

según las necesidades fiscales/comerciales.

---

# 43. Clientes: historial, no sobrescritura ciega

Un cambio de teléfono puede ser válido.

Pero una modificación crítica debe poder auditarse.

Ejemplo:

```text
Teléfono anterior: 3001234567
Teléfono nuevo: 3017654321
Modificado por: Karina
Fecha: 31/08/2026
```

No queremos perder el conocimiento histórico.

---

# 44. Pedidos editables

Un pedido puede editarse mientras esté en:

```text
BORRADOR
ENVIADO
PENDIENTE DE REVISIÓN
```

Puede requerir permisos especiales durante:

```text
REVISIÓN
```

Una vez:

```text
APROBADO PARA FACTURAR
```

queda bloqueado para edición comercial normal.

Si hay un error:

```text
Bodega → DEVOLVER A VENDEDORA
```

La devolución debe exigir motivo.

---

# 45. Pedido devuelto

Ejemplo:

```text
Pedido #1548

Estado:
DEVUELTO A VENDEDORA

Motivo:
"Producto Olaplex Nº4 agotado"

Responsable:
Carlos

Fecha:
31/08/2026 14:45
```

La vendedora recibe:

```text
⚠ Pedido devuelto para corrección
```

y puede editarlo.

---

# 46. Cancelaciones

No borrar pedidos.

Siempre:

```text
CANCELADO
```

con:

```text
cancelled_at
cancelled_by
cancellation_reason
```

Esto es importante para reportes y auditoría.

---

# 47. Eliminación de datos

La aplicación debe preferir:

```text
soft delete
```

cuando la eliminación física pueda destruir trazabilidad.

Especialmente para:

- clientes;
- pedidos;
- cotizaciones;
- facturas;
- actividades.

Una factura nunca debe desaparecer de WOW simplemente porque alguien pulse "Eliminar".

---

# 48. Permisos

No basta con ocultar botones.

Ejemplo:

```text
Frontend:
ocultar botón Facturar
```

NO es seguridad.

El backend también debe verificar:

```text
usuario.role == BODEGA
```

antes de ejecutar.

La seguridad real está en backend/RLS/permisos.

---

# 49. Base de datos conceptual

No es todavía el esquema SQL definitivo, pero las entidades principales serán:

```text
users
roles
customers
customer_assignments
customer_activities
prospects
products
product_sync
quotes
quote_items
orders
order_items
order_status_history
order_reviews
invoices
invoice_operations
shipments
follow_ups
attachments
payments
audit_logs
integration_logs
sync_jobs
settings
```

Las tablas exactas se definirán en el documento técnico posterior.

---

# 50. Relaciones principales

```text
USER
 │
 ├──────── CUSTOMER_ASSIGNMENT ─────── CUSTOMER
 │                                      │
 │                                      ├── QUOTES
 │                                      ├── ORDERS
 │                                      ├── ACTIVITIES
 │                                      └── FOLLOW_UPS
 │
 └──────── ORDERS
              │
              ├── ORDER_ITEMS ─── PRODUCTS
              │
              ├── REVIEW
              │
              ├── INVOICE
              │
              └── SHIPMENT
```

---

# 51. Pedido y factura

Relación:

```text
1 pedido
   ↓
0 o 1 factura activa
```

No:

```text
1 pedido
   ↓
muchas facturas accidentales
```

Si existe una corrección fiscal posterior, debe existir una entidad/relación explícita para documentarla.

---

# 52. Reportes diarios

El sistema debe poder responder:

```text
¿Cuánto vendimos hoy?
¿Cuántos pedidos?
¿Cuántos clientes nuevos?
¿Cuántas cotizaciones?
¿Cuántas conversiones?
¿Cuánto vendió cada vendedora?
¿Cuántos pedidos están pendientes?
¿Cuántos están bloqueados?
¿Cuántos fueron facturados?
¿Cuántos tuvieron error?
```

---

# 53. Reportes mensuales

Debe poder responder:

```text
Ventas del mes
Ventas por vendedora
Ventas por cliente
Ventas por producto
Ticket promedio
Número de pedidos
Clientes nuevos
Clientes recurrentes
Clientes perdidos
Clientes recuperados
Cotizaciones creadas
Cotizaciones ganadas
Tasa de conversión
Valor de cotizaciones perdidas
Motivos de pérdida
Tiempo promedio de facturación
Errores de facturación
```

---

# 54. Conocimiento acumulativo de WOW

El sistema debe construir memoria empresarial.

Para un cliente:

```text
Quién lo atiende
Desde cuándo
Qué compra
Cuánto compra
Cada cuánto compra
Cuánto gasta
Qué cotiza
Qué productos repite
Cuándo fue contactado
Qué problemas tuvo
Qué seguimiento tiene pendiente
```

Para la empresa:

```text
Qué productos venden más
Qué vendedora convierte más
Qué clientes están cayendo
Qué meses venden más
Qué razones provocan pérdidas
Dónde se generan errores
Dónde está el cuello de botella
```

---

# 55. Diseño orientado a eficiencia

Cada pantalla debe justificar su existencia.

Antes de añadir una función preguntar:

1. ¿Reduce trabajo?
2. ¿Reduce errores?
3. ¿Aumenta velocidad?
4. ¿Mejora información?
5. ¿Evita duplicación?
6. ¿Ayuda a vender?
7. ¿Aumenta trazabilidad?

Si no cumple ninguna, probablemente no necesita estar en V1.

---

# 56. Principio de automatización

Automatizar:

- fechas;
- estados derivados;
- cálculos;
- alertas;
- asignaciones según reglas;
- detección de clientes en riesgo;
- métricas;
- sincronizaciones;
- logs;
- validaciones.

No automatizar de forma ciega:

- facturación;
- decisiones fiscales;
- cambios irreversibles;
- eliminación de datos.

Las acciones irreversibles deben requerir una acción explícita del rol autorizado.

---

# 57. Notificaciones

La plataforma puede generar:

### Vendedora

```text
Pedido devuelto
Cotización sin respuesta
Cliente fuera de ciclo
Seguimiento vencido
Pedido facturado
```

### Bodega

```text
Nuevo pedido para revisar
Pedido bloqueado
Stock insuficiente
Error de facturación
Factura confirmada
```

### Supervisor

```text
Pedidos atrasados
Clientes en riesgo
Errores
Cotizaciones importantes sin seguimiento
```

---

# 58. Prioridad de trabajo

La aplicación puede asignar una prioridad calculada.

Conceptualmente:

```text
prioridad =
valor_cliente
+
urgencia
+
días_vencidos
+
probabilidad_compra
+
valor_cotización
```

La fórmula exacta se definirá después de observar datos reales.

Nunca debe ser una caja negra sin explicación.

La interfaz debe poder explicar:

> "Este cliente aparece primero porque lleva 6 días fuera de su ciclo habitual y su ticket promedio es $780.000."

---

# 59. Seguridad

Principios:

- autenticación;
- autorización por rol;
- Row Level Security cuando corresponda;
- secretos solamente en backend;
- logs;
- auditoría;
- validación de inputs;
- protección de endpoints;
- rate limiting donde corresponda;
- backups;
- recuperación.

Las vendedoras deben ver únicamente lo que necesitan.

---

# 60. Rendimiento

Con aproximadamente:

- 1.600 productos;
- 12.000 clientes actuales, con duplicados;
- crecimiento continuo de pedidos;
- 4 vendedoras inicialmente;

la arquitectura propuesta no necesita una infraestructura compleja.

El diseño debe priorizar:

- índices;
- búsquedas por identificación;
- búsqueda por nombre;
- paginación;
- caché de productos;
- consultas agregadas;
- evitar llamadas innecesarias a Siigo.

---

# 61. Migración de los 12.000 clientes

No importar ciegamente.

Proceso:

```text
Google Sheet / GHL / Siigo
          ↓
Extracción
          ↓
Normalización
          ↓
Detección de duplicados
          ↓
Consolidación
          ↓
Revisión de conflictos
          ↓
Importación
          ↓
Asignación de responsables
```

Debe conservarse, cuando sea posible:

- identificación;
- nombre;
- teléfono;
- correo;
- dirección;
- ciudad;
- información fiscal;
- IDs externos;
- historial.

---

# 62. Migración de productos

Los aproximadamente 1.600 productos deben normalizarse.

Identificador principal:

```text
siigo_product_id
```

y/o código de producto según lo que confirme la API.

No utilizar exclusivamente el nombre.

---

# 63. Migración de pedidos históricos

Los pedidos históricos deben entrar como:

```text
HISTORICAL
```

y no deben activar:

- facturación;
- creación de factura;
- acciones fiscales.

Si existe número de factura histórico:

```text
historical_invoice_number
```

puede almacenarse como referencia.

---

# 64. Transición GHL → WOW

No apagar GHL de un día para otro.

Fase inicial:

```text
WOW
 ↓
GHL
 ↓
Siigo
```

pero WOW comienza a ser la fuente principal.

Después:

```text
WOW
 ├── Siigo
 └── GHL
```

Finalmente, si se determina que GHL ya no es necesario para alguna función:

```text
WOW
 └── Siigo
```

La decisión de eliminar partes de GHL debe tomarse después de validar qué funciones de CRM/marketing siguen siendo útiles.

---

# 65. Fases de construcción

## Fase 0 — Definición

Crear:

- este documento;
- reglas de negocio;
- roles;
- estados;
- fuentes de verdad;
- permisos;
- arquitectura.

## Fase 1 — Fundación técnica

Construir:

- proyecto;
- autenticación;
- usuarios;
- roles;
- base de datos;
- auditoría;
- estructura backend.

## Fase 2 — Clientes

Construir:

- búsqueda;
- creación;
- edición;
- asignación;
- historial;
- duplicados.

## Fase 3 — Productos e inventario

Construir:

- catálogo;
- búsqueda;
- sincronización;
- stock;
- consulta Siigo.

## Fase 4 — Cotizaciones

Construir:

- creación;
- edición;
- seguimiento;
- conversión a pedido;
- estados.

## Fase 5 — Pedidos

Construir:

- carrito;
- cálculo;
- comprobantes;
- consecutivo;
- edición;
- estados;
- historial.

## Fase 6 — Bodega

Construir:

- cola de revisión;
- checklist;
- impresión;
- aprobación;
- devolución.

## Fase 7 — Facturación

Construir:

- integración Siigo;
- idempotencia;
- estados;
- reconciliación;
- factura;
- bloqueo de duplicados.

## Fase 8 — CRM comercial

Construir:

- actividades;
- seguimientos;
- clientes en riesgo;
- prioridades;
- cartera.

## Fase 9 — Reportes

Construir:

- diarios;
- mensuales;
- vendedores;
- clientes;
- productos;
- operación.

## Fase 10 — GHL

Construir:

- sincronización;
- contactos;
- oportunidades;
- compatibilidad con procesos actuales.

## Fase 11 — Migración

Migrar:

- clientes;
- productos;
- históricos;
- relaciones.

## Fase 12 — Salida de Make

Eliminar gradualmente:

- búsqueda por webhook;
- delays;
- routers;
- escenarios críticos;
- lógica duplicada.

---

# 66. Qué NO debemos hacer

No construir primero:

- dashboard bonito;
- animaciones;
- funciones secundarias;
- automatizaciones;
- integraciones sin modelo de datos.

No copiar:

```text
HTML actual
→
hacerlo más bonito
```

La nueva plataforma debe partir de:

```text
REGLAS
→
DATOS
→
PROCESOS
→
PERMISOS
→
API
→
INTERFAZ
```

---

# 67. Orden correcto de desarrollo

El orden recomendado es:

```text
1. Modelo de negocio
2. Fuente de verdad
3. Roles
4. Estados
5. Reglas
6. Modelo de datos
7. API/backend
8. Integraciones
9. Seguridad
10. Frontend
11. Reportes
12. Optimización
```

No al revés.

---

# 68. Decisiones que todavía deben validarse antes de producción

Este documento define la lógica general, pero existen aspectos que deben verificarse técnicamente antes de cerrar la implementación:

1. ✅ Endpoints exactos de inventario de Siigo — **resuelto** (2026-09-02): viene embebido en `GET /v1/products`, no en un endpoint separado. Ver `docs/06_INTEGRACION_SIIGO.md` §10.
2. ✅ Cómo consultar stock por producto — **resuelto**: mismo objeto de producto trae `available_quantity` y `warehouses: [{id, name, quantity}]`. Ver §10.
3. Cómo identificar correctamente productos en Siigo — pendiente (usar `siigo_product_id` + `code`, ya así en el doc 02; no requirió llamada adicional).
4. Cómo consultar/reconciliar facturas después de un timeout — pendiente. `GET /v1/invoices?document.id=...` sirve para localizar una factura por documento (usado para validar el punto 5), falta definir la estrategia completa de reconciliación.
5. ✅ Reglas exactas de numeración FV-1 vs FV-4 — **resuelto**: solo existe un tipo de documento electrónico vigente (`34963`, código 4). No hay que elegir serie en tiempo de ejecución. Ver §19.
6. ✅ Regla correcta de `vat_responsible` — **resuelto parcialmente**: confirmado el valor real en un cliente jurídico existente (`false`, ver ejemplo en doc 06 §6). Falta la regla general (cuándo es `true`).
7. Catálogo completo de responsabilidades fiscales — parcialmente resuelto: se vio un ejemplo real (`R-99-PN`), falta el catálogo completo.
8. ✅ Estructura definitiva para nombres de personas naturales — **resuelto**: `name: [nombres, apellidos]`, Siigo no separa nada — el corte automático por espacio era un bug nuestro, no una limitación de Siigo. Ver §7 del doc 06.
9. Campos fiscales obligatorios — parcialmente resuelto vía el ejemplo de cliente real; falta confirmar cuáles son estrictamente obligatorios vs. opcionales.
10. Límites/rate limits de las APIs — pendiente.
11. Estrategia exacta de sincronización con GHL — pendiente.
12. Qué funciones actuales de GHL deben permanecer — pendiente.
13. Qué información histórica debe migrarse — pendiente.
14. Qué datos deben conservarse por razones legales/contables — pendiente.
15. Política de backups y recuperación — pendiente.

**Hallazgo adicional no listado originalmente:** el centro de costo (`cost_center`) usado en
facturación es una decisión de negocio pendiente, no solo técnica — ver `docs/06_INTEGRACION_SIIGO.md`
§22 ("Centro de costo — pendiente de decisión de negocio"). Y la retención al 10% que ofrece el
formulario actual no se encontró en el catálogo real de Siigo — ver doc 06 §14.

Estos puntos **no deben inventarse**. Los ya marcados ✅ se verificaron contra la API y datos reales
de la cuenta de WOW en Siigo el 2026-09-02 (ver `docs/06_INTEGRACION_SIIGO.md` §22); el resto sigue
pendiente de verificar antes de convertirlos en código productivo.

---

# 69. Criterios de aceptación de la V1

La primera versión será considerada funcional cuando:

### Vendedora

- pueda entrar;
- pueda buscar cliente;
- pueda crear cliente;
- pueda consultar productos;
- pueda crear cotización;
- pueda crear pedido;
- pueda consultar historial;
- pueda hacer seguimiento;
- no pueda facturar.

### Bodega

- pueda ver pedidos pendientes;
- pueda revisar;
- pueda consultar stock;
- pueda imprimir;
- pueda aprobar;
- pueda facturar;
- pueda ver el resultado;
- no pueda duplicar una factura accidentalmente.

### Administración

- pueda consultar información;
- pueda ver reportes;
- pueda administrar usuarios;
- pueda auditar operaciones.

### Integración

- Siigo funcione sin Make;
- GHL pueda sincronizarse sin ser el motor del pedido;
- los errores queden registrados;
- las operaciones críticas sean recuperables.

---

# 70. Definición de éxito

La plataforma no se considera exitosa porque:

> "funciona técnicamente".

Se considera exitosa si:

### La vendedora

tarda menos en tomar un pedido.

### Bodega

tarda menos en revisar y facturar.

### Administración

tiene información confiable sin reconstruirla manualmente.

### WOW

puede saber:

- qué está pasando;
- qué pasó;
- qué clientes están en riesgo;
- qué productos se venden;
- qué vendedoras necesitan apoyo;
- dónde existen errores;
- cuánto se vende;
- cuánto se cotiza;
- cuánto se convierte.

Y todo esto sin depender de:

- Sheets como base principal;
- Make como cerebro;
- delays;
- búsquedas por nombre;
- memoria de las personas;
- procesos manuales frágiles.

---

# 71. Regla final del proyecto

> **La plataforma debe ser diseñada para que el proceso correcto sea el proceso más fácil de ejecutar.**

Si una vendedora necesita recordar cinco pasos para hacer algo que debería ser automático, el diseño está mal.

Si bodega puede facturar un pedido dos veces, el diseño está mal.

Si un cliente puede quedar simultáneamente asignado a dos vendedoras sin una razón explícita, el diseño está mal.

Si una factura puede crearse en Siigo y WOW no sabe qué ocurrió, el diseño está mal.

Si un reporte depende de que alguien haya llenado manualmente una hoja, el diseño está mal.

Si cambiar una etapa accidentalmente puede crear una factura fiscal, el diseño está mal.

La nueva plataforma debe convertir estas situaciones en **imposibilidades técnicas o excepciones controladas y auditadas**.

---

# 72. Próximo documento

Este documento NO es todavía el documento de programación.

El siguiente documento debe ser:

## `02_MODELO_DE_DATOS_SUPABASE.md`

Y debe definir extremadamente detalladamente:

- cada tabla;
- cada campo;
- tipo de dato;
- obligatoriedad;
- índices;
- claves;
- relaciones;
- constraints;
- enums;
- estados;
- historial;
- auditoría;
- RLS;
- triggers;
- funciones;
- vistas;
- relaciones con Siigo;
- relaciones con GHL;
- estrategia de sincronización;
- idempotencia;
- manejo de errores.

Después:

## `03_API_Y_LOGICA_BACKEND.md`

Después:

## `04_FLUJOS_OPERATIVOS.md`

Después:

## `05_PERMISOS_Y_SEGURIDAD.md`

Después:

## `06_INTEGRACION_SIIGO.md`

Después:

## `07_INTEGRACION_GHL.md`

Después:

## `08_UI_UX_Y_PANTALLAS.md`

Después:

## `09_MIGRACION_DATOS.md`

Después:

## `10_PLAN_DE_IMPLEMENTACION.md`

La regla será que **ningún documento contradiga este documento maestro**. Si aparece una contradicción, se actualiza primero la lógica de negocio y luego la implementación.
