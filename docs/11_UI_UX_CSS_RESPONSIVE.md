# WOW SALES V2 — 11. ESPECIFICACIÓN COMPLETA DE UI/UX, CSS Y RESPONSIVE

## Propósito

Este documento define cómo transformar la V2 técnicamente funcional en una aplicación que las vendedoras puedan usar todo el día, especialmente desde el móvil mientras visitan clientes, y que bodega pueda utilizar con velocidad y seguridad para revisar, aprobar, facturar y despachar.

La aplicación actual ya tiene Next.js + Supabase + Auth + RLS y las principales fases funcionales construidas; por tanto, el objetivo es rediseñar la experiencia sin destruir la lógica de negocio existente. El estado del proyecto confirma que las fases 1–6 y 10–11 ya están construidas y probadas, mientras Siigo/GHL reales y la migración siguen pendientes. fileciteturn4file0L38-L58

---

# 1. Principio rector

WOW Sales no debe parecer un formulario ni un ERP genérico.

Debe sentirse como:

> **El espacio de trabajo diario de las vendedoras y el centro operativo de WOW.**

Reglas:

1. Acción antes que información.
2. Contexto antes que navegación.
3. Automatización antes que digitación.
4. Seguridad antes que velocidad en operaciones fiscales.
5. Mobile first para vendedoras.
6. Desktop first para bodega y administración.

---

# 2. Experiencias por rol

## 2.1 Vendedora

Prioridades:

- clientes;
- seguimientos;
- nuevo pedido;
- cotizaciones;
- prospectos;
- historial.

La pregunta que debe responder su dashboard es:

> **¿Qué debo hacer hoy?**

## 2.2 Bodega/despacho

Prioridades:

- pedidos pendientes;
- revisión;
- inventario;
- impresión;
- aprobación;
- facturación;
- despacho;
- errores.

Pregunta principal:

> **¿Qué pedido debo procesar ahora y está listo?**

## 2.3 Supervisor

Prioridades:

- cartera;
- vendedores;
- pedidos;
- cotizaciones;
- seguimientos;
- alertas;
- reportes.

## 2.4 Administrador

Prioridades:

- salud del sistema;
- usuarios;
- integraciones;
- auditoría;
- reportes;
- configuración.

---

# 3. Arquitectura visual desktop

Usar un App Shell permanente:

```text
┌──────────────────────────────────────────────────────────────┐
│ WOW SALES                         🔍   🔔   Ferney ▾        │
├───────────────┬──────────────────────────────────────────────┤
│ 🏠 Inicio      │                                              │
│               │                  CONTENIDO                    │
│ COMERCIAL     │                                              │
│ 👥 Clientes    │                                              │
│ 🎯 Prospectos  │                                              │
│ 📄 Cotizaciones│                                              │
│ 🛒 Pedidos     │                                              │
│               │                                              │
│ OPERACIÓN     │                                              │
│ 📦 Productos   │                                              │
│ 🏭 Bodega      │                                              │
│ 🚚 Despachos   │                                              │
│               │                                              │
│ ANÁLISIS      │                                              │
│ 📊 Reportes    │                                              │
│               │                                              │
│ ⚙ Configuración│                                             │
└───────────────┴──────────────────────────────────────────────┘
```

Sidebar recomendado: 240 px.

Topbar: 64 px.

Contenido máximo: 1440 px.

---

# 4. Arquitectura mobile

No reducir el desktop.

Construir una experiencia específica para móvil.

```text
┌──────────────────────────────┐
│ ☰  WOW SALES           🔔   │
├──────────────────────────────┤
│ Buenos días, Karina 👋       │
│                              │
│ ┌────────────┐ ┌───────────┐ │
│ │ 4          │ │ 3         │ │
│ │ Vencidos   │ │ Cotizac.  │ │
│ └────────────┘ └───────────┘ │
│                              │
│ PRIORIDADES                  │
│                              │
│ Salón Andrea                 │
│ 4 días fuera de ciclo        │
│ [Ver cliente]                │
│                              │
│ Salón Bella                  │
│ Cotización $1.2M             │
│ [Ver cotización]             │
│                              │
├──────────────────────────────┤
│ 🏠   👥   ➕   📄   ☰        │
└──────────────────────────────┘
```

La navegación inferior tendrá máximo cinco destinos.

---

# 5. Breakpoints

```css
@media (max-width: 767px) {}
@media (min-width: 768px) and (max-width: 1023px) {}
@media (min-width: 1024px) {}
@media (min-width: 1440px) {}
```

El diseño debe funcionar como mínimo en:

```text
320 px
375 px
390 px
414 px
768 px
1024 px
1280 px
1440 px
```

---

# 6. Design tokens

```css
:root {
  --bg: #f6f7f9;
  --surface: #ffffff;
  --surface-soft: #f9fafb;

  --text: #17202a;
  --text-soft: #667085;
  --text-muted: #98a2b3;

  --border: #e4e7ec;
  --border-strong: #d0d5dd;

  --primary: #171717;
  --primary-hover: #2b2b2b;

  --success: #12b76a;
  --success-bg: #ecfdf3;
  --warning: #f79009;
  --warning-bg: #fffaeb;
  --danger: #f04438;
  --danger-bg: #fef3f2;
  --info: #1570ef;
  --info-bg: #eff8ff;
  --purple: #7f56d9;
  --purple-bg: #f9f5ff;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;

  --shadow-sm: 0 1px 2px rgba(16,24,40,.05);
  --shadow-md: 0 4px 12px rgba(16,24,40,.08);

  --sidebar-width: 240px;
  --topbar-height: 64px;
  --content-max: 1440px;
}
```

Estos tokens son una base; el branding definitivo puede sustituirlos sin alterar la estructura de componentes.

---

# 7. Tipografía

Base:

```css
body {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system,
    BlinkMacSystemFont, "Segoe UI", sans-serif;
}
```

Desktop:

```text
H1 28–32 px
H2 22–24 px
H3 18–20 px
Body 14–16 px
Small 12–13 px
```

Mobile:

```text
H1 24–28 px
H2 20–22 px
Body 15–16 px
Small 12–13 px
```

No usar texto pequeño para información operativa importante.

---

# 8. Espaciado

Escala:

```text
4  8  12  16  20  24  32  40  48
```

No introducir valores arbitrarios en cada pantalla.

---

# 9. CSS base

```css
*, *::before, *::after { box-sizing: border-box; }

html { scroll-behavior: smooth; }

body {
  margin: 0;
  min-width: 320px;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  line-height: 1.5;
}

button, input, select, textarea { font: inherit; }
button { border: 0; }
img, svg { max-width: 100%; }
a { color: inherit; text-decoration: none; }

:focus-visible {
  outline: 3px solid rgba(21,112,239,.25);
  outline-offset: 2px;
}
```

---

# 10. Contenedor

```css
.main-content {
  min-width: 0;
  width: 100%;
  max-width: var(--content-max);
  margin: 0 auto;
  padding: 24px;
}

@media (max-width: 767px) {
  .main-content {
    padding: 16px;
    padding-bottom: 88px;
  }
}
```

---

# 11. App shell

```css
.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr;
}

.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  background: #101828;
  color: #fff;
}

@media (max-width: 767px) {
  .app-shell { display: block; }

  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    width: min(84vw, 320px);
    transform: translateX(-100%);
    transition: transform .2s ease;
    z-index: 1000;
  }

  .sidebar.is-open { transform: translateX(0); }
}
```

---

# 12. Backdrop mobile

```css
.sidebar-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.45);
  z-index: 999;
}
```

Cerrar drawer al tocar fuera.

---

# 13. Topbar

Desktop: 64 px.

Mobile: 56 px.

Debe mostrar:

- menú en móvil;
- búsqueda;
- notificaciones;
- usuario.

---

# 14. Navegación inferior mobile

```css
.mobile-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  min-height: 64px;
  padding-bottom: max(8px, env(safe-area-inset-bottom));
  background: rgba(255,255,255,.96);
  border-top: 1px solid var(--border);
  backdrop-filter: blur(12px);
  z-index: 500;
}
```

---

# 15. Touch targets

Todos los controles accionables en móvil deben ofrecer como mínimo aproximadamente 44 × 44 px de área táctil.

No usar iconos pequeños como única superficie clicable.

---

# 16. Botones

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid transparent;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background .15s ease, border-color .15s ease;
}

@media (max-width: 767px) {
  .btn {
    min-height: 46px;
    width: 100%;
    font-size: 15px;
  }
}
```

Jerarquía:

```text
Primary
Secondary
Tertiary
Danger
```

Nunca poner cinco botones principales con el mismo peso visual.

---

# 17. Inputs

```css
.input,
.select,
textarea {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  font-size: 14px;
  outline: none;
}

.input:focus,
.select:focus,
textarea:focus {
  border-color: var(--info);
  box-shadow: 0 0 0 3px rgba(21,112,239,.12);
}
```

En móvil preferir 15–16 px para inputs para evitar zoom involuntario en navegadores móviles.

---

# 18. Cards

```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}
```

Padding:

```text
desktop 20–24 px
mobile 16 px
```

---

# 19. Dashboard de vendedora

El dashboard no debe ser un menú.

Debe incluir:

```text
Buenos días, Karina 👋

4 seguimientos vencidos
3 cotizaciones pendientes
7 clientes próximos a comprar
$8.4M ventas del mes

PRIORIDADES DE HOY
```

Cada prioridad debe explicar por qué aparece.

Ejemplo:

```text
Salón Andrea
4 días fuera de ciclo
Ticket promedio $780.000
[Ver cliente]
```

---

# 20. Dashboard mobile de vendedora

Usar grid de 2 columnas para KPIs.

```css
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

@media (max-width: 1023px) {
  .dashboard-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 767px) {
  .dashboard-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
}
```

Después de los KPIs debe aparecer la lista de tareas, no otra colección de gráficos.

---

# 21. Quick actions

En móvil el acceso principal debe ser:

```text
+ Nuevo
```

Al abrir:

```text
Nuevo pedido
Nueva cotización
Nuevo cliente
Nuevo prospecto
Registrar seguimiento
```

---

# 22. Búsqueda global

Debe buscar:

```text
clientes
pedidos
cotizaciones
prospectos
```

Resultado agrupado:

```text
CLIENTE
Salón Luna

PEDIDO
WOW-P-0000016

COTIZACIÓN
QT-000043
```

En móvil, abrir una pantalla de búsqueda dedicada de ancho completo.

---

# 23. Clientes — desktop

Tabla recomendada:

```text
Cliente | Responsable | Última compra | Ticket | Estado | Seguimiento | Acción
```

Evitar 10+ columnas.

---

# 24. Clientes — mobile

Reemplazar tabla por cards.

```text
┌─────────────────────────────┐
│ Salón Andrea                │
│ B2B · Karina                │
│                             │
│ Última compra 28 AGO        │
│ Ticket $780.000             │
│ 🔴 4 días fuera de ciclo    │
│                             │
│ [Ver cliente]               │
└─────────────────────────────┘
```

No depender de scroll horizontal.

---

# 25. Ficha del cliente

Debe ser una pantalla central del producto.

## Capa comercial

```text
Responsable
Estado
Última compra
Valor histórico
Ticket promedio
Próxima compra estimada
Cotizaciones
Seguimientos
```

## Capa fiscal

Inspirada en el modelo mental conocido de Siigo:

```text
Datos básicos
Datos de facturación
Régimen IVA
Responsabilidad fiscal
Contacto
Dirección
```

La UI no debe copiar visualmente a Siigo; debe conservar la lógica que las usuarias ya conocen.

---

# 26. Formulario de cliente — desktop

Dos columnas cuando el espacio lo permita.

```css
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.form-field.full {
  grid-column: 1 / -1;
}

@media (max-width: 767px) {
  .form-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .form-field.full { grid-column: auto; }
}
```

---

# 27. Formulario de cliente — mobile

Una sola columna.

Orden:

```text
Tipo
Tipo de identificación
Identificación
DV
Nombres / Razón social
Apellidos
Ciudad
Dirección
Teléfono
Contacto
Correo
Régimen IVA
Responsabilidad fiscal
```

Los campos secundarios deben estar colapsados si no son obligatorios para el momento actual.

---

# 28. Prellenado y relación con Siigo

Si el cliente ya existe:

```text
Nombre ✓
Identificación ✓
Ciudad ✓
Dirección ✓
Régimen ✓
Responsabilidad ✓
```

La usuaria no debe volver a escribir información conocida.

Mostrar:

```text
Siigo
✓ Sincronizado
```

sin exponer IDs técnicos en la interfaz normal.

---

# 29. Detección de duplicados

Antes de crear un cliente:

```text
⚠ Posible cliente existente

Salón Luna SAS
NIT 900123456-7
Asignado a Karina

[Ver cliente]
[Solicitar revisión]
```

---

# 30. Productos

Búsqueda:

```text
🔍 Nombre, SKU o marca
```

Resultado:

```text
Olaplex No.4
OLX-004
$98.000
Stock aproximado 40
[+]
```

No abrir pantallas innecesarias para agregar un producto.

---

# 31. Nuevo pedido mobile

Wizard de máximo 4 pasos:

```text
1 Cliente
2 Productos
3 Pago/comprobante
4 Confirmar
```

Una acción principal por pantalla.

---

# 32. Carrito mobile

Mostrar siempre total y número de unidades.

Footer fijo:

```text
3 productos
$248.145
[Continuar]
```

---

# 33. Pedido desktop

Header:

```text
#WOW-P-0000016
Salón Luna
Ferney
[Estado]
```

Tabs:

```text
Resumen
Productos
Pago
Comprobantes
Historial
```

---

# 34. Pedido mobile

No usar tabla.

Producto como card:

```text
Olaplex No.0
OLX-BOND-0

1 unidad
Precio $98.000
Stock 40
Total $116.620
```

---

# 35. Estados

Badge:

```css
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}
```

Usar texto + icono; el color nunca será la única señal.

---

# 36. Bodega — dashboard

Debe iniciar con:

```text
12 Pendientes de revisión
5 Listos para facturar
2 Con problemas
1 Facturando
7 Por despachar
```

Luego la cola de pedidos.

---

# 37. Cola de bodega

Desktop:

```text
Pedido | Cliente | Vendedora | Valor | Antigüedad | Estado | Acción
```

Mobile:

```text
#WOW-...
Salón Luna
$248.145
Aprobado para facturar
Ferney · hace 3 min
[Ver]
```

---

# 38. Revisión de pedido

Debe estar organizada en este orden:

```text
1 Cliente
2 Datos fiscales
3 Inventario
4 Productos
5 Pago
6 Comprobantes
7 Checklist
8 Aprobación / devolución
```

No esconder información crítica en múltiples pestañas.

---

# 39. Prevalidación automática

Mostrar:

```text
LISTO PARA REVISIÓN

✓ Cliente
✓ Datos fiscales
✓ Productos
✓ Stock
✓ Cálculos
✓ Comprobante
```

Si hay fallo:

```text
⚠ Problemas encontrados

Olaplex No.4
Solicitado 10 · Disponible 6

[Devolver a vendedora]
```

---

# 40. Inventario

No hacer del botón “Actualizar stock desde Siigo” el elemento principal.

Mostrar:

```text
Inventario
Actualizado hace 2 min
```

Acción secundaria:

```text
↻ Actualizar
```

---

# 41. Impresión

Acción separada:

```text
🖨 Imprimir pedido
```

Debe estar visualmente alejada de:

```text
Facturar en Siigo
```

porque imprimir no tiene efecto fiscal.

---

# 42. Aprobar

Botón:

```text
✓ Aprobar para facturar
```

Definición:

> Bodega verificó el pedido y confirma que está listo para que se ejecute la facturación.

No crea factura.

---

# 43. Facturación

Sólo aparece a usuarios autorizados.

Confirmación:

```text
Vas a generar una factura electrónica en Siigo.

Pedido #WOW...
Cliente: Salón Luna
Total: $248.145

Esta acción genera un documento fiscal.

[Cancelar]   [Facturar]
```

---

# 44. Resultado de facturación

Éxito:

```text
✓ Factura creada
FV-4-37025
$248.145
03/09/2026 · Carlos
```

Resultado incierto:

```text
⚠ Estamos verificando la factura

No vuelvas a facturar este pedido.
```

Nunca mostrar un éxito si el backend no lo confirmó.

---

# 45. Seguimientos

Navegación:

```text
Vencidos
Hoy
Próximos
Completados
```

Item:

```text
Salón Andrea
Fuera de ciclo 4 días
Recompra

[Contactar]
[Completar]
```

---

# 46. Acciones rápidas de campo

Desde un seguimiento móvil:

```text
[WhatsApp]
[Llamar]
[Registrar actividad]
[Reprogramar]
```

La vendedora no debe navegar por cinco pantallas para registrar una llamada.

---

# 47. Reportes

## Desktop

Primer nivel:

```text
Ventas
Pedidos
Clientes
Cotizaciones
Operación
```

## Mobile

Mostrar pocos KPIs y permitir abrir el detalle.

No presentar 10 gráficos simultáneos.

---

# 48. Dashboard administrativo

Debe mostrar:

```text
Ventas
Pedidos
Clientes nuevos
Cotizaciones
Clientes en riesgo
Pedidos atrasados
Errores de integración
```

La meta es detectar cuellos de botella, no llenar de gráficas.

---

# 49. Búsqueda y navegación contextual

Desde cliente:

```text
[Crear pedido]
[Crear cotización]
[Registrar seguimiento]
```

Desde pedido:

```text
[Editar]
[Imprimir]
[Ver cliente]
```

Desde cotización:

```text
[Convertir a pedido]
[Registrar seguimiento]
[Ver cliente]
```

---

# 50. Formularios largos

Usar wizard o secciones colapsables.

No presentar 30 campos de golpe.

La regla:

> Mostrar sólo la información necesaria para la decisión actual.

---

# 51. Modales

Desktop:

```css
.modal {
  width: min(640px, calc(100vw - 32px));
  max-height: 90vh;
  overflow: auto;
  border-radius: 16px;
}
```

Mobile:

```css
@media (max-width: 767px) {
  .modal {
    width: 100%;
    max-width: none;
    height: 100dvh;
    max-height: none;
    border-radius: 0;
  }
}
```

Para acciones cortas puede usarse bottom sheet.

---

# 52. Mobile action bar

```css
.mobile-action-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 10px 16px max(10px, env(safe-area-inset-bottom));
  background: rgba(255,255,255,.96);
  border-top: 1px solid var(--border);
  backdrop-filter: blur(12px);
  z-index: 500;
}
```

Usar sólo para acciones principales.

---

# 53. Tablas responsive

No depender únicamente de `overflow-x:auto`.

```css
@media (max-width: 767px) {
  .desktop-table { display: none; }
  .mobile-list { display: block; }
}

@media (min-width: 768px) {
  .desktop-table { display: table; }
  .mobile-list { display: none; }
}
```

---

# 54. Empty states

Siempre mostrar explicación y siguiente acción.

```text
Aún no tienes seguimientos.
Cuando tengas uno, aparecerá aquí.

[Crear seguimiento]
```

---

# 55. Loading

Usar skeletons en listas y tablas.

```css
.skeleton {
  background: linear-gradient(
    90deg,
    #f2f4f7 25%,
    #eaecf0 37%,
    #f2f4f7 63%
  );
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
}

@keyframes shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}
```

---

# 56. Feedback de acciones

Toda acción debe tener:

```text
loading
success
error
```

Errores críticos además deben aparecer en el contenido de la página y no sólo como toast.

---

# 57. Errores de conexión

La vendedora trabaja en calle.

Cuando no haya conexión:

```text
⚠ Sin conexión
```

Nunca decir “guardado” si el servidor no confirmó.

Diferenciar:

```text
Borrador local
Servidor confirmado
```

---

# 58. Persistencia temporal mobile

Para formularios largos:

```text
new_customer_draft
new_order_draft
new_quote_draft
```

Se pueden conservar localmente para evitar perder lo escrito ante una mala señal.

La UI debe indicar claramente si algo sólo está guardado localmente.

---

# 59. Offline completo

No asumir que WOW será totalmente offline en V1.

La V1 debe garantizar:

- no perder el formulario fácilmente;
- no afirmar éxito sin confirmación del servidor;
- reintento seguro;
- estado claro de conexión.

Una estrategia offline completa puede plantearse después.

---

# 60. Safe area

```css
.safe-bottom {
  padding-bottom: max(12px, env(safe-area-inset-bottom));
}
```

Aplicar a barras fijas.

---

# 61. Accesibilidad

Obligatorio:

- labels reales;
- foco visible;
- navegación con teclado;
- contraste suficiente;
- textos descriptivos;
- no depender exclusivamente del color;
- botones con nombres claros.

---

# 62. Seguridad UX

La UI oculta acciones que el rol no puede realizar, pero el backend sigue siendo la autoridad.

Ejemplo:

```text
vendedora → no mostrar Facturar
```

y además:

```text
backend → rechazar POST /invoice
```

---

# 63. Integración visual con Siigo

La aplicación debe conservar el modelo mental conocido por las usuarias:

```text
Datos básicos
→ datos de facturación
→ régimen IVA
→ responsabilidad fiscal
→ contacto
```

Pero debe simplificar:

- autocompletado;
- validación;
- reutilización de datos;
- identificación de errores.

No copiar la UI de Siigo.

---

# 64. Ficha fiscal dentro del pedido

Bodega debe poder ver:

```text
Tipo
Identificación
DV
Nombre / Razón social
Ciudad
Dirección
Régimen IVA
Responsabilidad fiscal
Correo
Teléfono
Estado Siigo
```

Con indicadores:

```text
✓ Completo
⚠ Revisar
```

---

# 65. Prevalidación fiscal

Antes de facturar:

```text
Cliente ✓
Datos fiscales ✓
Productos ✓
Impuestos ✓
Inventario ✓
Forma de pago ✓
```

Si algo falla:

```text
No está listo para facturar
```

---

# 66. Prioridad comercial

La aplicación debe ayudar a decidir qué hacer primero.

Prioridad inicial:

```text
1. Seguimiento vencido de alto valor
2. Cotización importante sin respuesta
3. Cliente fuera de ciclo
4. Cliente de alto valor sin actividad
5. Seguimiento próximo
```

La fórmula debe poder explicarse.

---

# 67. Explicación de recomendaciones

Ejemplo:

```text
Este cliente aparece primero porque:

• lleva 6 días fuera de su ciclo habitual;
• su ticket promedio es $780K;
• no tiene actividad registrada en 14 días.
```

No usar recomendaciones opacas.

---

# 68. Historial visual

Timeline:

```text
31 AGO
🧾 Pedido #1548 · $850K

29 AGO
📞 Llamada

27 AGO
📄 Cotización #874 · $1.2M
```

Debe ser el centro de memoria de la cuenta.

---

# 69. Diseño para eficiencia

Cada nueva función debe responder al menos una de estas preguntas:

- ¿reduce trabajo?
- ¿reduce errores?
- ¿aumenta velocidad?
- ¿mejora información?
- ¿evita duplicación?
- ¿ayuda a vender?
- ¿mejora trazabilidad?

Si no cumple ninguna, revisar antes de añadirla.

---

# 70. No convertir la plataforma en un sistema de vigilancia

Los reportes de vendedores sirven para:

- detectar cuellos de botella;
- equilibrar carteras;
- ayudar con prioridades;
- identificar oportunidades.

No convertir cada KPI en una herramienta de castigo.

---

# 71. Reglas visuales de calidad

Evitar:

- sombras pesadas;
- exceso de tarjetas;
- demasiados colores;
- demasiadas tipografías;
- texto en mayúsculas por toda la interfaz;
- tablas gigantes;
- espacios vacíos exagerados;
- formularios interminables;
- copiar literalmente a Siigo.

Buscar:

```text
jerarquía
claridad
densidad útil
consistencia
```

---

# 72. CSS responsive de cabeceras

```css
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.page-actions {
  display: flex;
  gap: 8px;
}

@media (max-width: 767px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .page-actions {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr;
  }
}
```

---

# 73. CSS de listas mobile

```css
.mobile-card-list {
  display: grid;
  gap: 10px;
}

.mobile-card {
  padding: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
}
```

---

# 74. CSS de estado visual

```css
.status-success { color: var(--success); background: var(--success-bg); }
.status-warning { color: var(--warning); background: var(--warning-bg); }
.status-danger  { color: var(--danger); background: var(--danger-bg); }
.status-info    { color: var(--info); background: var(--info-bg); }
```

No utilizar estas clases como sustituto de texto semántico.

---

# 75. CSS para pantallas anchas

```css
@media (min-width: 1440px) {
  .main-content {
    padding-left: 32px;
    padding-right: 32px;
  }
}
```

No estirar contenido a toda la pantalla sin límite.

---

# 76. Pantalla de administración

No necesita ser la pantalla de una vendedora.

Debe presentar:

```text
Salud del sistema
Integraciones
Usuarios
Reportes
Auditoría
```

---

# 77. Centro de soporte

Sólo supervisor/admin:

```text
WOW ID
Siigo ID
GHL ID
Request ID
Última sincronización
Último error
```

No mostrar esta complejidad a las vendedoras.

---

# 78. Navegación contextual

Al volver desde pedido a cliente, conservar contexto cuando sea razonable.

Ejemplo:

```text
Cliente → Pedido → volver
```

debe regresar al cliente en la posición anterior, no a un dashboard vacío.

---

# 79. Formularios con keyboard mobile

Los campos deben usar tipos apropiados:

```html
<input type="tel">
<input type="email">
<input inputmode="numeric">
```

Para identificación, teléfono y valores numéricos usar teclado contextual.

---

# 80. Upload de comprobantes mobile

Debe permitir:

```text
Tomar foto
Elegir archivo
Vista previa
Eliminar
Reemplazar
```

Mostrar progreso y estado real.

---

# 81. Diseño del upload

```text
Comprobantes

[ + Agregar comprobante ]

✓ comprobante_1.jpg
✓ comprobante_2.pdf
```

Si no se subió al servidor:

```text
⚠ Pendiente de carga
```

---

# 82. Feedback de pedido creado

Después de guardar:

```text
✓ Pedido creado

#WOW-P-0000016

Enviado a revisión de bodega.
```

Acciones:

```text
Ver pedido
Imprimir
Volver a clientes
```

---

# 83. No redirigir innecesariamente

Después de una acción importante, mantener a la usuaria donde puede continuar su trabajo.

Ejemplo:

```text
crear cliente → continuar pedido
```

No enviar al dashboard por defecto.

---

# 84. Flujo ideal de una vendedora en calle

```text
Abrir WOW
 ↓
Ver prioridades
 ↓
Buscar cliente
 ↓
Ver contexto
 ↓
Crear pedido
 ↓
Agregar productos
 ↓
Confirmar
 ↓
Recibir número de pedido
 ↓
Continuar con siguiente visita
```

La aplicación debe minimizar escritura.

---

# 85. Flujo ideal de bodega

```text
Abrir WOW
 ↓
Ver cola
 ↓
Abrir pedido
 ↓
Prevalidación automática
 ↓
Verificar físicamente
 ↓
Imprimir
 ↓
Aprobar
 ↓
Facturar en Siigo
 ↓
Confirmar factura
 ↓
Despachar
```

---

# 86. Performance UX

La búsqueda de clientes/productos debe ser instantánea desde cache/BD local operativa siempre que sea posible.

No hacer una llamada externa por cada tecla si no es necesario.

El backend debe manejar las integraciones externas fuera del flujo visual cuando la operación lo permita.

---

# 87. Regla de estado real

No mostrar:

```text
Guardado ✓
```

hasta que el servidor confirme.

Para operaciones externas:

```text
Confirmado
Pendiente
Incierto
Error
```

deben ser estados distintos.

---

# 88. Pruebas visuales

Cada pantalla se debe revisar en:

```text
320
375
390
414
768
1024
1280
1440
```

Y además con:

```text
texto largo
nombre largo
cliente sin historial
10+ productos
error de red
sin resultados
usuario sin permisos
```

---

# 89. Pruebas de campo

Antes de producción, una vendedora debe usar la aplicación desde:

- teléfono real;
- red móvil;
- exteriores;
- una mano;
- señal irregular.

Medir:

```text
tiempo para encontrar cliente
tiempo para crear pedido
taps
errores
dificultades
```

---

# 90. Métricas de UX

Registrar internamente, cuando sea apropiado:

```text
tiempo_crear_pedido
tiempo_crear_cliente
tiempo_buscar_cliente
tiempo_crear_cotizacion
tiempo_registrar_seguimiento
tiempo_revisión_bodega
tiempo_facturación
```

No sólo medir errores; medir fricción.

---

# 91. Reutilización del HTML actual

Conservar del HTML actual:

- reglas de cálculo;
- lógica de listas de precio;
- comportamiento del carrito;
- datos fiscales;
- campos;
- comprobantes;
- estructura del pedido;
- reglas ya probadas.

No conservar como arquitectura:

- Make webhooks;
- delays;
- búsqueda por nombre como integración;
- estado global del navegador como fuente de verdad;
- errores silenciosos;
- serialización de pedido como texto.

---

# 92. Regla de implementación

No reescribir backend para cada cambio visual.

Separar:

```text
DOMINIO
API
COMPONENTES
ESTILOS
```

La UI consume contratos estables.

---

# 93. Orden de rediseño

```text
1. AppShell
2. Sidebar/topbar
3. navegación mobile
4. dashboard seller
5. dashboard warehouse
6. detalle/revisión pedido
7. ficha cliente
8. nuevo pedido mobile
9. cotizaciones
10. seguimientos
11. reportes
12. admin
```

---

# 94. Regla de consistencia

Un mismo concepto debe verse igual en toda la app.

Ejemplo:

```text
Cliente
Estado
Pedido
Responsable
Factura
```

No cambiar el significado visual de un badge de una pantalla a otra.

---

# 95. Estados que deben tener tratamiento visual propio

```text
DRAFT
SUBMITTED
PENDING_REVIEW
IN_REVIEW
RETURNED_TO_SELLER
APPROVED_FOR_INVOICE
INVOICING
INVOICED
READY_FOR_DISPATCH
DISPATCHED
DELIVERED
CANCELLED
BLOCKED
```

Cada estado debe indicar:

```text
qué significa
qué se puede hacer
qué no se puede hacer
quién es responsable
```

---

# 96. Acción principal de cada pantalla

Cada pantalla debe tener una sola acción primaria.

Ejemplos:

```text
Clientes → Nuevo cliente / seleccionar cliente
Pedidos → Nuevo pedido
Bodega → Revisar pedido
Pedido aprobado → Facturar
Seguimientos → Completar seguimiento
```

---

# 97. Densidad visual

Desktop de bodega puede ser más denso que mobile vendedor.

No aplicar exactamente el mismo padding a ambos.

Bodega necesita ver muchos pedidos.

Vendedora necesita leer una cosa y actuar rápido.

---

# 98. Diseño para solapamiento comercial

En cliente mostrar siempre:

```text
Responsable: Karina
```

Si otra vendedora intenta interactuar:

```text
⚠ Este cliente está asignado a Karina.
```

Esto debe ser visible antes de iniciar una acción comercial.

---

# 99. Diseño para conocimiento histórico

El cliente debe actuar como expediente comercial:

```text
Resumen
Pedidos
Cotizaciones
Seguimientos
Actividad
Ficha fiscal
```

La vendedora no debería preguntar internamente:

> “¿Qué había comprado este cliente?”

La aplicación debe responderlo.

---

# 100. Regla final de UX

La interfaz no tiene como objetivo ser “bonita”.

Tiene como objetivo que WOW sea:

```text
más rápida
más clara
más segura
más confiable
más útil
más fácil de usar
```

Especialmente:

> **La vendedora debe poder trabajar desde la calle sin sentir que está usando un ERP. Bodega debe poder revisar y facturar sin perder contexto. Administración debe poder obtener información confiable sin pedirle a nadie que arme un Excel.**

La complejidad técnica debe quedar detrás de una experiencia simple.

---

# 101. Criterio de aceptación final

Una pantalla está lista sólo cuando cumple:

### Funcional
- acción correcta;
- permisos correctos;
- estados correctos;
- errores claros.

### Visual
- jerarquía clara;
- sin exceso de elementos;
- consistencia;
- responsive.

### Mobile
- no requiere zoom;
- controles cómodos;
- formulario de una columna;
- sin tablas ilegibles;
- acción principal accesible.

### Operativa
- reduce tiempo;
- reduce clics;
- reduce errores;
- conserva contexto.

### Técnica
- no mueve la lógica al frontend;
- no expone secretos;
- respeta el backend;
- mantiene auditoría.

---

# 102. Resultado objetivo

```text
               WOW SALES
                    |
       +------------+------------+
       |            |            |
    VENDEDORA      BODEGA       ADMIN
       |            |            |
       +------------+------------+
                    |
                 SUPABASE
                 /       \
              SIIGO       GHL
```

La interfaz debe ocultar esta complejidad y ofrecer una sola experiencia coherente.

**La aplicación no debe parecer tres sistemas conectados. Debe parecer un solo sistema que sabe hablar con Siigo y GHL por detrás.**

---

# 103. Próximo paso técnico

Una vez aprobada esta guía visual, implementar en este orden:

```text
AppShell
→ Design Tokens
→ navegación por rol
→ Dashboard Seller
→ Dashboard Bodega
→ Pedido/Revisión
→ Cliente/Ficha fiscal
→ Nuevo pedido mobile
→ Cotizaciones
→ Seguimientos
→ Reportes
→ Admin
```

No rehacer la lógica de negocio ya validada sólo para cambiar el diseño.

---

# 104. Regla para futuras mejoras

Toda nueva función debe documentarse antes de implementarse si cambia:

- flujo;
- estado;
- permisos;
- dato importante;
- facturación;
- inventario;
- propiedad de cliente.

Así la interfaz no volverá a convertirse en una colección de parches.
