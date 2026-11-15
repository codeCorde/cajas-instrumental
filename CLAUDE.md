# CLAUDE.md — guía del proyecto para Claude (y para el equipo)

App web que reemplaza el Excel de control de producción y stock de **cajas de instrumental quirúrgico**.
Producción: https://cajas-instrumental-eta.vercel.app · Repo: codeCorde/cajas-instrumental

## Stack
Next.js 15 (App Router, Server Actions) + TypeScript · Supabase (Postgres, Auth, RLS, Storage) · Tailwind 4 · Vercel.
Sin librerías de UI: componentes propios en `components/`, estilos base en `app/globals.css` (`.card`, `.btn`, `.campo`, `.etiqueta`, `.titulo`, `.tabla`).

## Comandos
```bash
npm run dev        # http://localhost:3000 (necesita .env.local)
npm test           # Vitest: lib/calculos.ts
npm run test:sql   # migraciones + permisos + RPC sobre Postgres en memoria (PGlite)
npm run typecheck
npm run build
```
Antes de abrir un PR: `npm run typecheck && npm test && npm run test:sql`. El CI de GitHub corre lo mismo.
En Windows, si PowerShell bloquea `npm`/`npx`, usar `npm.cmd` / `npx.cmd`.

## Reglas que no se rompen
1. **Idioma**: toda la interfaz en español rioplatense (vos, tocá, cargá). Código, variables y comentarios también en español.
2. **Cálculos solo en `lib/calculos.ts`** (stock completo, estados, cajas que alcanza, qué fabricar). Funciones puras con tests.
   Cualquier cambio de cálculo lleva su test en `tests/calculos.test.ts`.
3. **El stock solo cambia por RPC** (`taller.ajustar_stock`, `armar_instrumental`, `armar_caja`, `desarmar_caja`,
   `entregar_pedido` en `supabase/migrations/0007_taller.sql`), llamadas desde `app/(app)/acciones-stock.ts`.
   Nunca hacer `update ... set stock = ...` desde la app. El historial (`movimientos`) es solo inserción.
4. **Regla de armado duplicada a propósito**: `taller.armar_caja` (SQL) y `planArmadoCaja` en `lib/calculos.ts` (vista previa).
   Si cambia una, cambia la otra; `tests/calculos.test.ts` y `scripts/probar-taller.mjs` prueban el mismo caso.
5. **Acceso**: contraseña única (`APP_PASSWORD_HASH`) + nombre elegido, en cookie firmada (`lib/sesion.ts`, `middleware.ts`).
   No hay roles. La base no tiene acceso público: todo pasa por el servidor con `lib/db.ts` (service_role, esquema `taller`).
   Si agregás una tabla en `taller`: `enable row level security`, `revoke all ... from public, anon, authenticated`,
   `grant ... to service_role`, y tests en `scripts/probar-taller.mjs`. Cada Server Action llama a `quienSoy()`.
6. **Migraciones**: nunca editar una migración ya aplicada. Crear la siguiente (`0009_...sql`), agregarla a
   `scripts/probar-taller.mjs` y al README. **Vercel no corre migraciones**: hay que pegarlas en el SQL Editor de Supabase
   (avisarle al admin en el PR). El esquema `public` (0001–0006) es de la app anterior: no se usa más.
7. **Secretos**: nunca commitear `.env*` (salvo `.env.example`) ni pegar claves en código, issues o PRs.
   `SUPABASE_SERVICE_ROLE_KEY`, `APP_PASSWORD_HASH` y `SESSION_SECRET` solo en servidor.
8. **Archivos**: bucket privado `planos`, tabla `taller.archivos`. Se abren con `/archivos/<id>` (link firmado de 10 min).
   El navegador sube directo a Storage con link firmado (Vercel limita a 4,5 MB lo que pasa por el servidor).
9. Mobile-first para operarios (botones grandes, `+ / −`), tablas para el admin. Estados siempre con color **e** ícono (✓ ◐ ✕ ○).

## Mapa
```
app/(app)/            conteo (/), cajas/[codigo], instrumental, stock (fabricar, historial), admin (pedidos, calidad, config), tareas, novedades, chat
app/taller/[codigo]    vista del QR (celular)      app/ingresar/  contraseña + nombre
lib/calculos.ts       ★ lógica de negocio y regla de armado (vista previa)
lib/datos.ts          lecturas      lib/db.ts  cliente service_role (esquema taller)
supabase/migrations/  0001 tablas · 0002 RLS · 0003 RPC · 0004 planos · 0005 novedades y tareas · 0006 chat · 0007 esquema taller · 0008 datos       supabase/seed.sql  datos de ejemplo
scripts/              hash-password, probar-sql (app anterior), probar-taller
```
Más contexto: `README.md` (instalación y funcionamiento) y `DECISIONES.md` (por qué se hizo cada cosa).

## Forma de trabajo
- `main` = producción: cada push a `main` se publica solo en Vercel. **No pushear directo a `main`.**
- Una rama por tarea (`feat/...`, `fix/...`), PR hacia `main`. Vercel arma un link de vista previa por PR.
  Ojo: la vista previa usa la **misma base de Supabase** que producción (los datos que se toquen ahí son reales).
- El otro socio revisa y aprueba el PR antes de mergear.
- Commits y PRs en español, cortos y descriptivos.
- **Novedades**: los cambios de estructura se registran desde las Server Actions (`registrarNovedad`). Cuando Claude haga un cambio de la app
  que el equipo deba conocer, sumar una fila con `origen = 'claude'` y `seccion = 'codigo'` en la migración del PR.

## Plugins y conectores de Claude (más allá del código)
Además del código, Claude ayuda con producción, investigación, diseño, marketing y ventas del negocio.
Los plugins son de Anthropic (`anthropics/knowledge-work-plugins`) y se instalan **por computadora**:
el otro socio tiene que instalarlos en la suya para usarlos.

```bash
claude plugin marketplace add anthropics/knowledge-work-plugins
claude plugin install productivity@knowledge-work-plugins   # y lo mismo con: small-business, operations,
                                                            # product-management, marketing, design, sales
```

| Necesidad | Usar | Ejemplo de pedido |
|---|---|---|
| Pendientes personales (las mejoras de la app van en la sección **Tareas** de la app) | `productivity:task-management` | «Anotá como pendiente llamar al proveedor de acero» |
| Documentar procesos del taller | `operations:process-doc`, `operations:runbook` | «Documentá el proceso de armado de una caja» |
| Riesgos, proveedores, avance | `operations:risk-assessment`, `vendor-review`, `status-report` | «Hacé el informe de avance del mes» |
| Nuevas funciones de la app | `product-management:write-spec`, `roadmap-update` | «Escribí la especificación de órdenes de producción» |
| Competencia e investigación | `product-management:competitive-brief`, `deep-research`, PubMed / SciSpace | «Compará proveedores de cajas de instrumental en Argentina» |
| Revisar pantallas y textos | `design:design-critique`, `design:ux-copy`, `design:accessibility-review` | «Revisá la pantalla de Cargar en el celular» |
| Marketing | `marketing:campaign-plan`, `content-creation`, `brand-review` | «Armá un plan de campaña para clínicas y traumatólogos» |
| Ventas y presupuestos | `small-business:proposal-builder`, `sales:account-research`, `sales:call-prep` | «Prepará un presupuesto de 2 cajas de cadera» |

Conectores de la cuenta: Notion, Canva, Google Drive / Docs / Sheets / Slides, Gmail, Calendar,
PubMed, SciSpace y SketchUp (modelos 3D).
Las reglas de arriba siguen valiendo: **nunca** pegar claves ni datos de `.env*` en Notion, Canva, documentos ni mails.
