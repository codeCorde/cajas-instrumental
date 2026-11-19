# Control de Producción de Cajas de Instrumental

App web que reemplaza el Excel de control de producción y stock de **cajas de instrumental quirúrgico** (cadera).
Repite la estructura y los cálculos del Excel y suma: catálogo único de instrumental con **stock compartido** entre cajas,
procesos de trabajo y planos, armado de cajas, carga por **QR** desde el taller, pedidos y control de calidad.

Producción: <https://cajas-instrumental-chi.vercel.app> · Repo: <https://github.com/marmaxnetizen/cajas-instrumental>

Stack: **Next.js 15** (App Router, Server Actions) + TypeScript · **Supabase** (Postgres + Storage) · **Tailwind 4** · **Vercel**.

---

## 1. Qué hay en el proyecto

```
app/ingresar/            contraseña única → elegir nombre
app/(app)/               1 Conteo de cajas (/, /cajas/[codigo], /cajas/[codigo]/qr)
                         2 Instrumental (/instrumental, /instrumental/[id], /instrumental/sin-clasificar)
                         3 Stock (/stock, /stock/fabricar, /stock/historial)
                         5 Administración (/admin/pedidos, /admin/calidad, /admin/config)
                         Equipo: /tareas, /novedades, /chat
app/taller/[codigo]      4 Vista del taller (se abre con el QR de la caja), mobile-first
app/archivos/[id]        abre un archivo con link firmado de 10 min (?descargar para bajarlo)
lib/calculos.ts      ★   lógica de negocio (stock completo, estados, cajas que alcanza, faltantes, armado, qué fabricar)
lib/datos.ts             lecturas · lib/db.ts cliente service_role · lib/sesion.ts cookie firmada
middleware.ts            todas las rutas piden sesión (salvo /pedir con clave, /api/cron y /api/claude con secreto)
supabase/migrations/     0001–0006 app anterior (esquema public) · 0007 esquema taller · 0008 datos iniciales · 0009 pedidos por QR y órdenes · 0010 sets, entrega parcial e invitaciones · 0011 stock de emergencia y procesos
scripts/                 hash-password, probar-sql (app anterior), probar-taller (app nueva)
tests/calculos.test.ts   tests de los cálculos
```

## 2. Supabase

1. Crear el proyecto en <https://supabase.com>.
2. **SQL Editor**: correr en orden las migraciones de `supabase/migrations/` (0001 a 0011). La 0008 carga el catálogo
   inicial (todo con stock en 0, `cant_por_caja = 1` y marcado «A confirmar») y pasa los planos de la app anterior.
   Si Supabase avisa «tablas sin RLS», elegí **Run without RLS**: el script activa RLS en todas las tablas al final.
3. **Integrations → Data API → Settings → Exposed schemas**: agregar `taller` y guardar.
   Las tablas de `taller` no tienen permisos para `anon` ni `authenticated`: solo el servidor (service_role) las usa.
4. **Project Settings → API**: copiar URL, `anon` key y `service_role` key.

> Vercel **no** corre migraciones: cada migración nueva se pega en el SQL Editor (avisalo en el PR).
> Con `SUPABASE_ACCESS_TOKEN` en `.env.local` también se puede aplicar desde la compu: `node --env-file=.env.local scripts/sql-supabase.mjs supabase/migrations/00XX_….sql`.

## 3. Variables de entorno

Copiá `.env.example` a `.env.local` y completá:

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Proyecto de Supabase (la clave pública solo se usa para subir archivos con links firmados) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Solo servidor.** Toda lectura y escritura pasa por acá |
| `NEXT_PUBLIC_SITE_URL` | URL pública (la que va en los QR) |
| `APP_PASSWORD_HASH` | Contraseña única, como hash bcrypt en base64 |
| `SESSION_SECRET` | Firma la cookie de sesión (≥ 32 caracteres al azar) |
| `CRON_SECRET` | Protege el resumen diario (`/api/cron/resumen-diario`). Vercel lo manda solo |
| `CLAUDE_API_TOKEN` | Clave de la API con la que Claude carga datos (≥ 32 caracteres al azar) |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Avisos por Telegram (opcional) |
| `CALLMEBOT_TELEFONOS`, `CALLMEBOT_APIKEYS` | Avisos por WhatsApp con CallMeBot (opcional, separados por coma) |
| `NTFY_TEMA`, `NTFY_SERVIDOR` | Notificación push al celular con la app ntfy (opcional) |

### Contraseña única
```bash
npm run hash-password -- --local   # te la pide sin mostrarla, la guarda en .env.local y te da el valor para Vercel
```
**Para cambiarla:** generá el valor nuevo, reemplazá `APP_PASSWORD_HASH` en Vercel (Settings → Environment Variables)
y hacé **Redeploy**. Las sesiones abiertas siguen valiendo; para cerrarlas todas, cambiá también `SESSION_SECRET`.

Después de la contraseña cada persona elige su nombre (o escribe uno nuevo). La sesión dura 30 días y el nombre queda
en cada movimiento de stock. Se cambia desde el nombre arriba a la derecha. Hay límite de 5 intentos fallidos por minuto por IP.

## 4. Correr en local
```bash
npm install
npm run dev          # http://localhost:3000
npm test             # cálculos
npm run test:sql     # migraciones, permisos y RPC sobre Postgres en memoria (PGlite)
npm run typecheck
```
En Windows, si PowerShell bloquea `npm`, usá `npm.cmd`.

## 5. Deploy en Vercel
1. Importar el repo en Vercel (framework Next.js).
2. Cargar las variables de la sección 3 en **Production** y **Preview**.
3. Cada push a `main` se publica solo. Cada PR tiene su link de vista previa (**usa la misma base**: los datos son reales).

## 6. Cómo funciona

### Instrumental y cajas
Un solo catálogo; un instrumental puede ir en varias cajas y su stock es uno solo. `composicion_caja` dice cuántos lleva
cada caja. Tipos: **Simple** (stock terminado), **Medidas** (juego de medidas, cada una con su stock) y **Complejo**
(piezas sueltas + unidades armadas; «Armar 1 unidad» descuenta las piezas).

### Cálculos — `lib/calculos.ts`
- **Stock completo**: Simple = stock terminado · Medidas = juegos completos (lo limita la medida que menos hay) ·
  Complejo = armados + los que salen de las piezas.
- **Cajas que alcanza** = `floor(stock completo / cant por caja)`; **cajas que se pueden armar** = el mínimo de la caja.
- **Estados**: ✓ Disponible · ◐ En proceso (con qué falta) · ✕ Falta · ○ Sin definir.
- Como el stock es compartido, «se pueden armar» se calcula por caja y **no se suma**.

### Stock solo por RPC (transaccionales, registran el movimiento)
`taller.ajustar_stock`, `armar_instrumental`, `armar_caja`, `desarmar_caja`, `entregar_pedido` (en `0007_taller.sql`).
El stock nunca baja de 0 y el historial no se puede editar ni borrar. La regla de armado de caja está también en
`planArmadoCaja` (vista previa): si cambia una, cambia la otra.

### Archivos
Bucket privado `planos`. El navegador sube directo a Storage con un link firmado (Vercel limita a 4,5 MB lo que pasa por
el servidor). PDF e imágenes se ven en la web; DWG y STP se descargan. Subir un archivo con el mismo nombre deja el
anterior como «versión anterior».

### Imprimir los QR
Conteo de cajas → abrí una caja → **▦ QR de la caja**. Elegí **Hoja A4** o **Etiqueta chica** y tocá **Imprimir**.
El QR abre `/taller/<código>`: carga de stock con + / −, qué falta y procesos. Pide la contraseña si el celular no tiene sesión.

### Pedidos por QR y producción (migración 0009)
1. **QR de pedidos** (Producción → QR de pedidos) abre `/pedir?k=<clave>`, sin contraseña pero **solo con el link del QR** (la clave se cambia con «Cambiar link»): presentación InstrumentARG de 5 s →
   elegir caja → cantidad de cada pieza (▲ / número / ▼) → «Agregar al pedido» o «Finalizar pedido» → nombre, fecha y firma
   → «Realizar orden de trabajo». El solicitante recibe un número (`OP-0001`) y un link secreto para ver el estado o cancelar.
   No muestra stock. Máximo 10 pedidos por hora por conexión. Los **sets** se piden enteros y se pueden personalizar sacando medidas.
2. **Producción** (4 pestañas):
   - **Órdenes de producción**: se recepcionan los pedidos nuevos (pasan a orden). Sin elegir una orden se ve el listado
     general con todo sumado; eligiendo una, su listado y su fecha.
   - **Stock de partes**: caja → pieza → clasificación (compleja / simple / set completo), cada parte con su stock y su
     **etapa** del proceso, máquina y mechas/machos, planos 2D/3D y programa de mecanizado (.txt/.nc/.gcode/.tap), comentarios.
   - **Stock de piezas terminadas**: por caja, ● completa · ■ incompleta · ✕ vacía. Las complejas se suman con «Armar 1»
     (descuenta 1 de cada parte). «Armar pedido» lleva a la orden para finalizarla.
   - **Pedidos entregados**: Finalizado (naranja) → «Firmar» → Entregado (verde) con **remito** imprimible.
3. **Entregar parcial** (en el pedido): elegís piezas y cantidades, quien recibe firma en tu celular y se descuenta del stock de terminadas. Cada entrega queda registrada con su firma en el remito.
4. **Cancelar** se puede desde las dos páginas (solicitante y taller) hasta que se entrega; si ya estaba finalizado, devuelve lo no entregado. Los cancelados quedan en «Pedidos entregados → Cancelados».
5. Estados en la base: `pendiente` = por recepcionar, `en_produccion`, `listo` = finalizado, `entregado`, `cancelado`.

### Avisos al celular
Un **canal** es el camino por el que llega el mensaje al celular. El elegido es **WhatsApp con CallMeBot**.
Cada pedido nuevo, recepcionado, finalizado, entregado (también parcial) o cancelado manda un aviso. Además, todos los días
(GitHub Actions, `.github/workflows/avisos.yml`, solo desde `main`): **resumen a las 6:40** y **recordatorios a las 9:40, 12:40 y 15:40**
con lo pendiente y 3 preguntas sobre información que falta cargar (lista completa en **Producción → ❓ Info que falta**).
Para activarlo: `CRON_SECRET` en Vercel **y** en GitHub → Settings → Secrets and variables → Actions. Se prueba en **Producción → 🔔 Avisos al celular**.
Canales (cualquiera, o varios):
- **Telegram** (recomendado): hablale a `@BotFather` → `/newbot` → token. Agregá el bot a un grupo del equipo, mandá un
  mensaje y sacá el `chat_id` de `https://api.telegram.org/bot<TOKEN>/getUpdates`.
- **WhatsApp** (CallMeBot, gratis y de uso personal): cada persona agenda el número de CallMeBot y le manda el mensaje de
  autorización que indica su web; le responde con su apikey. Teléfonos y apikeys van en el mismo orden.
- **ntfy** (push): instalá la app ntfy, suscribite a un tema difícil de adivinar y ponelo en `NTFY_TEMA`.

Sin canales configurados no se manda nada (la app funciona igual).

### Stock de emergencia (migración 0011)
Cada caja tiene un **mínimo de cajas armadas** (arranca en 10), editable en **Producción → Órdenes → 🛟 Stock de emergencia**.
Si las cajas armadas más lo que ya está en órdenes de reposición abiertas no llega al mínimo, la app crea sola una
**orden de reposición** (RE-0001…, aparte de los pedidos OP-…) y avisa por Telegram. Se revisa después de armar, desarmar,
finalizar o cancelar, y en el resumen de las 6:40. La orden queda cumplida cuando las cajas armadas vuelven al mínimo.
«Qué fabricar» arma la lista de piezas para lo que falta.

### Procesos y tiempos (base del costeo)
En **Stock de partes**, cada pieza (o cada parte / medida) tiene sus procesos en orden con máquina, minutos por pieza y minutos
de preparación. La app muestra cuántas piezas salen por hora. Es la base de la futura app de costeo.

### Acceso privado (solo por invitación)
- Con la contraseña solo se puede elegir a una persona **habilitada**; ya no se crean nombres nuevos al ingresar
  (salvo la primera vez, cuando no hay nadie habilitado).
- Para sumar a alguien: **Administración → Configuración → Invitaciones** → «Crear invitación» → copiá el link y mandáselo.
  Sirve una sola vez y vence a los 7 días. Al aceptarlo entra sin contraseña en ese equipo.
- Para sacarle el acceso a alguien: **Personas → Desactivar** (se corta al instante; su historial queda).
- Recomendado: desactivar a todos menos a los dos socios y **cambiar la contraseña** (ver «Contraseña única»).

### Carga automática con Claude
Claude carga lo que le dictás o mandás (fotos, planos, programas, máquinas, etapas, stock, pedidos) por la API `/api/claude`:
1. Generá una clave: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
2. Ponela en Vercel como `CLAUDE_API_TOKEN` y en tu `.env.local` como `CLAUDE_API_TOKEN` + `CLAUDE_API_URL` (la URL de la app).
3. Claude usa `node scripts/claude-api.mjs get faltantes | catalogo | pedidos`, `post '<json>'` y `subir <entidad> <id> <archivo>`.
Todo queda con autor «Claude» en el historial y en Novedades. El stock se mueve solo por RPC, igual que en la app.

### Investigación diaria
Una tarea programada de Claude (app de escritorio, ~7:20) revisa qué falta cargar, investiga un tema por día
(tercerizados, procesos, productos nuevos, mejoras de la app, competencia) y deja un informe en
`Proyecto 1 Cajas de Cirugia/Informes diarios/` con mejoras para aprobar («Sí / No») y preguntas para los clientes.
No cambia nada sin aprobación.

## 7. Trabajo en equipo (con Claude Code)
1. `git checkout main && git pull` → `git checkout -b feat/lo-que-sea`.
2. Trabajá (Claude Code lee `CLAUDE.md` y respeta sus reglas).
3. `npm run typecheck && npm test && npm run test:sql`.
4. Push y Pull Request: corre el CI y Vercel arma la vista previa. El otro socio revisa y mergea.

Si el PR trae una migración, se corre en el SQL Editor **antes** de mergear.

### Plugins y conectores de Claude
Claude también ayuda con producción, investigación, diseño, marketing y ventas (plugins `anthropics/knowledge-work-plugins`,
se instalan en cada compu). Cómo instalarlos y qué usar para cada cosa: sección **Plugins y conectores** de `CLAUDE.md`.

### Claude en GitHub
Escribí **@claude** en un issue o comentario de PR y Claude trabaja en la nube (`.github/workflows/claude.yml`).
Usa el secreto `CLAUDE_CODE_OAUTH_TOKEN` (se genera con `claude setup-token`; nunca pegarlo en código, issues ni PRs).
