# WOW Sales — app web

Next.js (App Router, TypeScript, Tailwind) + Supabase. Ver `../docs/` para las reglas de negocio
y el modelo de datos completos — este README es solo cómo levantar el proyecto, no repite reglas.

## 1. Crear el proyecto en Supabase

1. Crea un proyecto nuevo en [supabase.com](https://supabase.com).
2. En **Project Settings → API**, copia `Project URL`, `anon public key` y `service_role key`.
3. En **SQL Editor**, corre el contenido de `supabase/migrations/0001_init.sql` completo (es el
   mismo esquema validado en `docs/SQL_MODELO_DE_DATOS_SUPABASE.sql` — cualquier cambio futuro al
   esquema se hace primero ahí y se copia aquí, no al revés).
   Alternativa con la CLI de Supabase: `supabase link` y luego `supabase db push`.
4. En **Authentication → Users**, crea manualmente los primeros usuarios de prueba (uno por rol:
   `SELLER`, `WAREHOUSE`, `SUPERVISOR`, `ADMIN` — criterio de aceptación de la Fase 1, doc 10 §4).
5. Para cada uno, inserta su fila en `public.users` (columna `auth_user_id` = el `id` que Supabase
   Auth le asignó, visible en el panel de Authentication):

   ```sql
   insert into users (auth_user_id, name, email, role)
   values ('<uuid-de-auth-users>', 'Karina', 'karina@wow.test', 'SELLER');
   ```

   Sin esta fila, la persona puede iniciar sesión pero la app le muestra "no tienes perfil
   asignado" — es la validación de backend funcionando, no un error.

## 2. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Rellena `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`
con lo del paso 1. Las variables de `SIIGO_*` y `GHL_*` se usan más adelante (fase de integración,
docs 06 y 07) — no bloquean levantar el proyecto hoy.

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
