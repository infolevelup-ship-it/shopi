# WOW Sales — app web

Next.js (App Router, TypeScript, Tailwind) + Supabase. Ver `../docs/` para las reglas de negocio
y el modelo de datos completos — este README es solo cómo levantar el proyecto, no repite reglas.

## 1. Proyecto de Supabase

Ya existe y ya tiene el esquema aplicado: **"crm wow"** (ref `ibzubaspoyuwoykeghce`), conectado vía
el MCP de Supabase. El esquema completo (22 tablas, RLS, índices) se aplicó y verificó ahí
directamente — no hay que crearlo de nuevo ni volver a correr el SQL a mano.

Pendiente, solo esto (el MCP no expone esta clave, es la que salta RLS por completo):

1. Entra a [supabase.com/dashboard](https://supabase.com/dashboard) → proyecto "crm wow" →
   **Project Settings → API → Project API keys → `service_role`** (secreta).
2. Pégala en `.env.local` (ya está creado en este entorno) en `SUPABASE_SERVICE_ROLE_KEY`.
3. En **Authentication → Users**, crea los primeros usuarios de prueba (uno por rol: `SELLER`,
   `WAREHOUSE`, `SUPERVISOR`, `ADMIN` — criterio de aceptación de la Fase 1, doc 10 §4).
4. Para cada uno, inserta su fila en `public.users` (columna `auth_user_id` = el `id` que Supabase
   Auth le asignó, visible en el panel de Authentication):

   ```sql
   insert into users (auth_user_id, name, email, role)
   values ('<uuid-de-auth-users>', 'Karina', 'karina@wow.test', 'SELLER');
   ```

   Sin esta fila, la persona puede iniciar sesión pero la app le muestra "no tienes perfil
   asignado" — es la validación de backend funcionando, no un error.

Si en el futuro se crea un proyecto nuevo desde cero: `supabase/migrations/0001_init.sql` tiene el
esquema completo, listo para pegar en el SQL Editor o correr con `supabase db push`.

## 2. Variables de entorno

`.env.local` ya existe en este entorno con `NEXT_PUBLIC_SUPABASE_URL` y
`NEXT_PUBLIC_SUPABASE_ANON_KEY` reales (proyecto "crm wow"). Solo falta pegar
`SUPABASE_SERVICE_ROLE_KEY` (paso 1). En otra máquina, parte de `.env.example`:

```bash
cp .env.example .env.local
```

Las variables de `SIIGO_*` y `GHL_*` se usan más adelante (fase de integración, docs 06 y 07) —
no bloquean levantar el proyecto hoy.

## 3. Correr en local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000` — redirige a `/login`. Inicia sesión con uno de los usuarios creados
en el paso 1.4.

## 4. Conectar GitHub → Vercel

1. En [vercel.com/new](https://vercel.com/new), importa este repositorio.
2. **Root Directory**: `web` (el repo tiene `docs/` y `formulario/` fuera de esta carpeta).
3. Agrega las mismas variables del paso 2 en **Project Settings → Environment Variables**.
4. Cada push a la rama conectada hace deploy automático; cada Pull Request obtiene su propio
   preview deploy.

## Estructura

```text
src/
  app/                    rutas (App Router)
  lib/supabase/
    client.ts             cliente para Client Components (navegador)
    server.ts             cliente para Server Components (respeta RLS del usuario)
    service-role.ts        cliente que salta RLS — SOLO en server actions/API routes,
                           solo para lo que el doc 01 §18/§36 exige hacer en backend
    middleware.ts          refresca sesión y protege rutas
    database.types.ts      tipos TypeScript generados desde el esquema real de Supabase.
                           Regenerar tras cada cambio de esquema con el MCP de Supabase
                           (generate_typescript_types) o `supabase gen types typescript`.
supabase/
  migrations/0001_init.sql copia desplegable del esquema (fuente real: ../docs/SQL_MODELO_DE_DATOS_SUPABASE.sql)
```

## Qué NO hace todavía este scaffold

A propósito — es la Fase 1 (Fundación) del doc 10, no más:

- No hay páginas de negocio (pedidos, clientes, facturación). Eso son las Fases 2-7.
- No hay integración con Siigo ni GHL todavía.
- El login es solo email/contraseña; no hay alta de usuarios self-service (los crea un admin a
  mano en Supabase, por diseño — doc 01 §4.4).

Lo que sí queda probado end-to-end: autenticación real, la tabla `users` con su rol, y RLS
aplicándose de verdad (la página principal falla al leer el perfil si RLS no está bien puesta, no
es un mock).
