# Control de Producción de Cajas de Instrumental

MVP web que reemplaza el Excel de control de producción y stock de cajas de instrumental quirúrgico.
Replica sus cálculos y suma login, historial de movimientos, lista de qué fabricar y carga rápida por QR desde el celular.

**Stack:** Next.js 15 (App Router) + TypeScript · Supabase (Postgres, Auth, RLS) · Tailwind CSS 4 · Vercel.

---

## 1. Qué hay en el proyecto

```
app/
  login/                     Ingreso con email y contraseña (?next= para volver a donde ibas)
  auth/                      Links de invitación, nueva contraseña, cerrar sesión
  (app)/page.tsx             Resumen de cajas
  (app)/cajas/[id]/          Detalle de caja: pestañas, medidor, grilla, panel con + / −
  (app)/cargar/              Carga rápida por QR (paso 1: caja · paso 2: instrumentales)
  (app)/fabricar/            Lista de qué fabricar (por caja o global, objetivo N, CSV, imprimir)
  (app)/planos/              Instrumental de cada caja con sus planos (visor PDF, descarga de DWG/STEP)
  (app)/historial/           Movimientos con filtros + CSV            [solo admin]
  (app)/admin/               Cajas, instrumentales, medidas/partes, notas, usuarios, QR   [solo admin]
lib/
  calculos.ts                ★ TODA la lógica de cálculo (stock completo, estados, cajas, a fabricar)
  armado.ts                  ★ Regla de qué se descuenta al armar una caja (vista previa)
  useCaja.ts                 Estado en vivo + actualización optimista de los + / −
  supabase/                  Clientes de Supabase (navegador, servidor, service role)
components/                  Stepper − / +, chips de estado, medidor, contador de cajas armadas…
supabase/
  migrations/0001_tablas.sql Tablas
  migrations/0002_rls.sql    Permisos y Row Level Security
  migrations/0003_rpc.sql    Funciones de stock: ajustar_stock, armar_caja, entregar_caja
  migrations/0004_planos.sql Tabla de planos + bucket privado «planos» en Storage
  seed.sql                   Datos de ejemplo
tests/calculos.test.ts       Tests de lib/calculos.ts y lib/armado.ts
scripts/probar-sql.mjs       Prueba las migraciones + RLS + RPC en un Postgres en memoria
```

---

## 2. Crear el proyecto en Supabase

1. Entrá a <https://supabase.com>, creá un proyecto nuevo (región São Paulo es la más cercana).
2. En **SQL Editor → New query**, pegá y corré **en este orden**:
   1. `supabase/migrations/0001_tablas.sql`
   2. `supabase/migrations/0002_rls.sql`
   3. `supabase/migrations/0003_rpc.sql`
   4. `supabase/migrations/0004_planos.sql`
   5. `supabase/seed.sql` (datos de ejemplo; se puede volver a correr, recrea las cajas 1, 2 y 3)
3. En **Authentication → Sign In / Providers → Email**: dejá habilitado Email. Si no querés que se registre cualquiera,
   desactivá **Allow new users to sign up** (los usuarios los crea el admin desde la app).
4. En **Authentication → URL Configuration**:
   - **Site URL**: la URL de producción (ej. `https://cajas-instrumental.vercel.app`). En local: `http://localhost:3000`.
   - **Redirect URLs**: agregá `http://localhost:3000/**` y `https://TU-DOMINIO/**`.
5. (Recomendado) En **Authentication → Emails → Invite user**, cambiá el link de la plantilla por:
   ```
   {{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=invite&next=/auth/nueva-clave
   ```
   Con la plantilla por defecto también funciona, pero esta es más robusta.
6. En **Project Settings → API** copiá la **URL**, la **anon key** y la **service_role key**.

> Nota: el SMTP de prueba de Supabase manda pocos emails por hora. Para el día a día podés usar
> «Crear con contraseña» en Administración → Usuarios (no necesita email) o configurar un SMTP propio.

---

## 3. Correr en local

Requisitos: Node 20 o superior.

```bash
cp .env.example .env.local      # y completá los valores
npm install
npm run dev                     # http://localhost:3000
```

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública (respeta RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Solo servidor.** Invitar / crear usuarios desde Administración |
| `NEXT_PUBLIC_SITE_URL` | URL pública de la app (la usa el QR y las invitaciones) |

Tests:

```bash
npm test            # cálculos (Vitest)
npm run test:sql    # migraciones + RLS + RPC sobre Postgres en memoria (PGlite)
npm run typecheck
```

---

## 4. Crear el primer usuario admin

1. En Supabase → **Authentication → Users → Add user → Create new user**: poné tu email y una contraseña,
   y marcá **Auto Confirm User**.
2. En **SQL Editor** corré (con tu email):
   ```sql
   update perfiles set rol = 'admin', nombre = 'Tu nombre'
   where id = (select id from auth.users where email = 'tu@email.com');
   ```
3. Entrá a la app con ese email y contraseña. Desde **Administración → Usuarios** ya podés invitar operarios.

Todo usuario nuevo nace como **operario**; el rol solo lo cambia un admin.

---

## 5. Deploy en Vercel

1. Subí el proyecto a un repositorio de GitHub.
2. En <https://vercel.com> → **Add New → Project** → importá el repositorio (Vercel detecta Next.js solo).
3. En **Environment Variables** cargá las 4 variables de la tabla de arriba
   (`NEXT_PUBLIC_SITE_URL` = la URL que te da Vercel, o tu dominio).
4. **Deploy**. Después actualizá en Supabase la **Site URL** y las **Redirect URLs** con la URL final.
5. Entrá como admin → **Administración → QR de carga** → imprimí el QR y pegalo en el taller.

---

## 6. Cómo funciona

### Roles

| | Admin | Operario |
|---|---|---|
| Ver resumen, cajas, estados, qué fabricar | ✓ | ✓ |
| + / − de stock, unidades armadas, medidas, partes | ✓ | ✓ |
| + / − de cajas armadas | ✓ | ✓ |
| Crear / editar / borrar cajas, instrumentales, partes, notas, links | ✓ | |
| Historial y CSV | ✓ | |
| Usuarios y QR | ✓ | |

Los permisos se aplican **en la base** (RLS + permisos por columna), no solo en la pantalla:
las columnas de stock no se pueden modificar con un `UPDATE` directo, ni siquiera el admin.
Solo cambian a través de las funciones RPC, que en la misma transacción registran el movimiento.

### Cálculos (iguales al Excel) — `lib/calculos.ts`

- **Stock completo**: Simple = stock terminado · Medidas = `MIN(floor(stock_medida / cant_por_juego))` ·
  Complejo = unidades armadas + `MIN(floor(stock_parte / cant_por_instrumental))`.
- **Cajas que alcanza** = `floor(stock completo / cant. por caja)`.
- **Estado**: ✓ Disponible (alcanza ≥ 1) · ◐ En proceso (hay algo) · ✕ Falta (nada) · ○ Sin partes cargadas.
- **Cajas completas** = mínimo de «cajas que alcanza» entre todos los instrumentales.

### Armar / entregar cajas

- **+ caja armada**: muestra qué se va a descontar y pide confirmación. Descuenta automáticamente lo que lleva
  una caja (simple → stock terminado; medidas → cant. por juego × cant. por caja; complejo → primero unidades
  armadas, después partes sueltas). Si falta algo, no la arma y muestra qué falta.
- **− caja armada** (entrega / venta): solo baja el contador.
- La regla está aislada en la RPC `armar_caja` (`0003_rpc.sql`) y replicada en `lib/armado.ts` para la vista previa.
  Si la cambiás, cambiala en los dos lugares. `tests/calculos.test.ts` y `scripts/probar-sql.mjs` prueban el mismo
  caso de armado (mismos datos, mismos descuentos esperados), así que si una cambia y la otra no, falla un test.

---

### Planos

- Menú **Planos**: todas las cajas con su instrumental; buscador por nombre, código o plano.
- Cada instrumental tiene su página con el visor de PDF y botones para bajar los DWG / STEP (no se ven en el navegador).
- Los archivos están en un bucket **privado** de Supabase Storage: solo usuarios logueados los ven, con links que vencen
  a los 10 minutos. Solo el admin sube, renombra o borra (Administración → instrumental → Planos, o la caja para el
  plano general).
- Carga inicial desde la carpeta «Recopilación cajas de cirugía»:
  `node scripts/importar-cajas.mjs "C:\Users\Admin\Desktop\Recopilación cajas de cirugía"` (se puede repetir sin duplicar).

## 7. Cómo ampliar

- **Nuevo cálculo o estado** → `lib/calculos.ts` + un test en `tests/calculos.test.ts`.
- **Nuevo campo de instrumental** → columna en una migración nueva (`0005_...sql`), agregala al `grant insert/update`
  de `0002_rls.sql`, al tipo en `lib/tipos.ts` y al formulario en `app/(app)/admin/instrumentales/[id]/page.tsx`.
- **Nuevo motivo de movimiento** → `alter type motivo_movimiento add value '...'` y `MOTIVO_LABEL` en `lib/tipos.ts`.

Preparado para más adelante (no implementado): QR por pieza o lote (la ruta `/cargar/[cajaId]` ya acepta ir directo
a una caja; se puede sumar `?i=<instrumental>`), subida de archivos (hoy son links de Drive), importación desde Excel,
órdenes de producción, clientes y pedidos (la tabla `movimientos` ya tiene `motivo` y `nota` para enlazarlos).
