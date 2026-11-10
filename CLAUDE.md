# CLAUDE.md — guía del proyecto para Claude (y para el equipo)

App web que reemplaza el Excel de control de producción y stock de **cajas de instrumental quirúrgico**.
Producción: https://cajas-instrumental-eta.vercel.app · Repo: codeCorde/cajas-instrumental

## Stack
Next.js 15 (App Router, Server Actions) + TypeScript · Supabase (Postgres, Auth, RLS, Storage) · Tailwind 4 · Vercel.
Sin librerías de UI: componentes propios en `components/`, estilos base en `app/globals.css` (`.card`, `.btn`, `.campo`, `.etiqueta`, `.titulo`, `.tabla`).

## Comandos
```bash
npm run dev        # http://localhost:3000 (necesita .env.local)
npm test           # Vitest: lib/calculos.ts, lib/armado.ts, lib/planos.ts
npm run test:sql   # migraciones + RLS + RPC sobre Postgres en memoria (PGlite)
npm run typecheck
npm run build
```
Antes de abrir un PR: `npm run typecheck && npm test && npm run test:sql`. El CI de GitHub corre lo mismo.
En Windows, si PowerShell bloquea `npm`/`npx`, usar `npm.cmd` / `npx.cmd`.

## Reglas que no se rompen
1. **Idioma**: toda la interfaz en español rioplatense (vos, tocá, cargá). Código, variables y comentarios también en español.
2. **Cálculos solo en `lib/calculos.ts`** (stock completo, estados, cajas que alcanza, qué fabricar). Funciones puras con tests.
   Cualquier cambio de cálculo lleva su test en `tests/calculos.test.ts`.
3. **El stock solo cambia por RPC** (`ajustar_stock`, `armar_caja`, `entregar_caja` en `supabase/migrations/0003_rpc.sql`).
   Las columnas de stock no tienen permiso de UPDATE para nadie. Nunca hacer `update ... set stock = ...` desde la app.
4. **Regla de armado duplicada a propósito**: `armar_caja` (SQL) y `lib/armado.ts` (vista previa). Si cambia una, cambia la otra;
   `tests/calculos.test.ts` y `scripts/probar-sql.mjs` prueban el mismo caso.
5. **Permisos en la base, no solo en pantalla**: RLS + grants por columna. Admin = todo; operario = ver y cargar stock.
   Si agregás una tabla: `enable row level security`, `revoke all ... from anon`, políticas con `es_usuario()` / `es_admin()`,
   y tests en `scripts/probar-sql.mjs`.
6. **Migraciones**: nunca editar una migración ya aplicada. Crear la siguiente (`0005_...sql`), agregarla a la lista de
   `scripts/probar-sql.mjs` y al README. **Vercel no corre migraciones**: hay que pegarlas en el SQL Editor de Supabase
   (avisarle al admin en el PR).
7. **Secretos**: nunca commitear `.env*` (salvo `.env.example`) ni pegar claves en código, issues o PRs.
   `SUPABASE_SERVICE_ROLE_KEY` solo en servidor (`lib/supabase/admin.ts`, con `server-only`).
8. **Planos**: bucket privado `planos` de Supabase Storage. Se abren con `/planos/archivo/<id>` (link firmado de 10 min).
   El navegador sube directo a Storage (Vercel limita a 4,5 MB lo que pasa por el servidor).
9. Mobile-first para operarios (botones grandes, `+ / −`), tablas para el admin. Estados siempre con color **e** ícono (✓ ◐ ✕ ○).

## Mapa
```
app/(app)/            páginas con sesión: resumen, cajas/[id], cargar, fabricar, planos, tareas, novedades, historial, admin/*
app/(app)/admin/acciones.ts   todas las Server Actions de administración
app/auth/, app/login/ login, invitaciones, nueva contraseña
lib/calculos.ts       ★ lógica de negocio      lib/armado.ts  ★ regla de armado (vista previa)
lib/datos.ts          lecturas de Supabase     lib/planos.ts  utilidades de planos
lib/supabase/         clientes (navegador, servidor, service role)
supabase/migrations/  0001 tablas · 0002 RLS · 0003 RPC · 0004 planos · 0005 novedades y tareas       supabase/seed.sql  datos de ejemplo
scripts/              crear-admin, importar-cajas (planos), probar-sql
```
Más contexto: `README.md` (instalación y funcionamiento) y `DECISIONES.md` (por qué se hizo cada cosa).

## Forma de trabajo
- `main` = producción: cada push a `main` se publica solo en Vercel. **No pushear directo a `main`.**
- Una rama por tarea (`feat/...`, `fix/...`), PR hacia `main`. Vercel arma un link de vista previa por PR.
  Ojo: la vista previa usa la **misma base de Supabase** que producción (los datos que se toquen ahí son reales).
- El otro socio revisa y aprueba el PR antes de mergear.
- Commits y PRs en español, cortos y descriptivos.
- **Novedades**: los cambios de estructura se registran solos (triggers de 0005). Cuando Claude haga un cambio de la app
  que el equipo deba conocer, sumar una fila con `origen = 'claude'` y `seccion = 'codigo'` en la migración del PR.
