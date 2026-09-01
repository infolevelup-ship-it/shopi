# WOW SALES V2 — PAQUETE DE DOCUMENTACIÓN

## Documentos

```text
01_DOCUMENTO_MAESTRO_VERDAD_Y_LOGICA.md
02_MODELO_DE_DATOS_SUPABASE.md
03_LOGICA_BACKEND_Y_API.md
04_FLUJOS_OPERATIVOS.md
05_ROLES_PERMISOS_Y_SEGURIDAD.md
06_INTEGRACION_SIIGO.md
07_INTEGRACION_GHL.md
08_UI_UX_Y_PANTALLAS.md
09_MIGRACION_DE_DATOS.md
10_PLAN_DE_IMPLEMENTACION.md
```

## Orden de lectura

01 define el negocio.

02 convierte la lógica en modelo de datos.

03 define cómo se ejecutan las reglas.

04 define los flujos.

05 define quién puede hacer qué.

06 y 07 definen integraciones.

08 convierte los procesos en interfaz.

09 define la transición desde los sistemas actuales.

10 convierte todo en etapas de construcción.

## Regla de gobierno

Si código, interfaz o integración contradice este conjunto:

1. identificar la regla de negocio;
2. corregir el documento;
3. aprobar el cambio;
4. adaptar modelo/API/UI;
5. probar;
6. desplegar.

No solucionar contradicciones mediante parches aislados.

## Arquitectura objetivo

```text
             VENDEDORAS / BODEGA / ADMIN
                       |
                       v
                  WOW SALES
                       |
                       v
                  BACKEND
                       |
             +---------+---------+
             |                   |
             v                   v
          SUPABASE            APIs externas
             |               /                         |            SIIGO           GHL
             |        Fiscal/stock       CRM
             |
             +---- Reportes / CRM interno
```

## Regla estratégica

No usar Make/n8n como dependencia del flujo crítico.

## Próximo documento técnico después de estos

Crear el SQL definitivo de Supabase a partir del documento 02, y luego el contrato OpenAPI/TypeScript de 03.

✅ `SQL_MODELO_DE_DATOS_SUPABASE.sql` — SQL ejecutable derivado del documento 02 (enums, 22 tablas,
índices, triggers, vista `customer_metrics` y RLS base). Pendiente: contrato OpenAPI/TypeScript
derivado del documento 03.
