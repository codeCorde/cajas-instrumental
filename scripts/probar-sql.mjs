// Prueba las migraciones, RLS y RPC en un Postgres en memoria (PGlite), simulando el esquema auth de Supabase.
// Uso: npm run test:sql
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
const proj = process.argv[2] ?? process.cwd();
const db = new PGlite();
const leer = (f) => fs.readFileSync(path.join(proj, f), "utf8");
let fallas = 0;
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) fallas++; };
async function err(sql, msg) { try { await db.query(sql); ok(false, msg + " (no dio error)"); } catch (e) { ok(true, `${msg} -> ${e.message}`); } }

// --- shim de Supabase ---
await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated; grant all on storage.objects to authenticated; grant select on storage.buckets to authenticated;
`);
for (const f of ["supabase/migrations/0001_tablas.sql", "supabase/migrations/0002_rls.sql", "supabase/migrations/0003_rpc.sql", "supabase/migrations/0004_planos.sql", "supabase/migrations/0005_novedades_tareas.sql", "supabase/seed.sql", "supabase/seed.sql"]) {
  await db.exec(leer(f)); console.log("ok   ", f);
}
const ADMIN = "00000000-0000-0000-0000-00000000000a", OP = "00000000-0000-0000-0000-00000000000b";
await db.exec(`insert into auth.users values ('${ADMIN}','dueno@ej.com','{"nombre":"Dueño"}'), ('${OP}','op@ej.com','{}');
update perfiles set rol='admin' where id='${ADMIN}';`);
const q1 = async (sql) => (await db.query(sql)).rows[0];
ok((await q1(`select count(*)::int n from perfiles`)).n === 2, "trigger crea perfiles");

const como = async (uid) => { await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid}',false); set role authenticated;`); };
const idDe = async (cod) => (await q1(`select i.id from instrumentales i join cajas c on c.id=i.caja_id where c.numero=1 and codigo='${cod}'`)).id;

// ---------- OPERARIO ----------
await como(OP);
ok((await db.query(`select * from cajas`)).rows.length === 3, "operario ve 3 cajas");
ok((await db.query(`select * from instrumentales`)).rows.length === 10, "operario ve 10 instrumentales");
const i13 = await idDe("1.3"), i15 = await idDe("1.5");
await err(`update instrumentales set stock_terminado = 99 where id='${i13}'`, "operario NO puede UPDATE directo de stock");
await db.query(`update instrumentales set nombre='hack' where id='${i13}'`);
ok((await q1(`select nombre from instrumentales where id='${i13}'`)).nombre === "Plástico convexo", "operario NO puede editar nombre (RLS)");
await err(`insert into movimientos (campo, delta, stock_resultante, motivo) values ('stock_terminado',1,1,'carga')`, "operario NO inserta movimientos");
ok((await q1(`select ajustar_stock('${i13}','stock_terminado',1) r`)).r === 2, "ajustar_stock +1 -> 2");
ok((await db.query(`select * from movimientos`)).rows.length === 0, "operario no ve historial");
const p58 = (await q1(`select id from partes where instrumental_id='${i15}' and codigo_o_medida='Ø58'`)).id;
ok((await q1(`select ajustar_stock('${i15}','stock_parte',3,'${p58}') r`)).r === 3, "parte Ø58 +3 -> 3");
ok((await q1(`select ajustar_stock('${i15}','stock_parte',-10,'${p58}') r`)).r === 0, "parte Ø58 -10 -> 0 (no baja de 0)");
await err(`select ajustar_stock('${i13}','unidades_armadas',1)`, "simple no tiene unidades armadas");
await err(`select ajustar_stock('${i15}','stock_parte',1,'${p58}','armado_caja')`, "motivo armado_caja no permitido en ajuste");
const r1 = await q1(`select armar_caja((select id from cajas where numero=1)) r`);
ok(r1.r.ok === false && r1.r.faltantes.length > 0, `armar caja DM sin stock -> rechaza: ${r1.r.faltantes.slice(0, 3).join(" | ")} ...`);
await err(`select entregar_caja((select id from cajas where numero=1))`, "entregar sin cajas armadas");

// ---------- ADMIN ----------
await como(ADMIN);
const movs = (await db.query(`select delta, stock_resultante, usuario_nombre, instrumental_nombre, parte_nombre from movimientos order by id`)).rows;
ok(movs.length === 3, `admin ve 3 movimientos: ${JSON.stringify(movs.map((m) => [m.usuario_nombre, m.parte_nombre ?? m.instrumental_nombre, m.delta, m.stock_resultante]))}`);
ok(movs[2].delta === -3, "el -10 se registró como -3 (lo que realmente bajó)");
await db.query(`update instrumentales set nombre='Plástico convexo (ed)' where id='${i13}'`);
ok((await q1(`select nombre from instrumentales where id='${i13}'`)).nombre.endsWith("(ed)"), "admin edita nombre");
await err(`update instrumentales set stock_terminado = 5 where id='${i13}'`, "admin tampoco cambia stock sin RPC");
try { await db.query(`delete from movimientos`); } catch (e) { console.log("      (delete movimientos ->", e.message + ")"); }
ok((await q1(`select count(*)::int n from movimientos`)).n === 3, "historial no se puede borrar (ni admin)");

// caja de prueba completa
const c9 = (await q1(`insert into cajas (numero, nombre) values (9, 'Prueba') returning id`)).id;
const s = (await q1(`insert into instrumentales (caja_id, codigo, nombre, tipo, cant_por_caja) values ('${c9}','9.1','S','simple',2) returning id`)).id;
const m = (await q1(`insert into instrumentales (caja_id, codigo, nombre, tipo, cant_por_caja) values ('${c9}','9.2','M','medidas',2) returning id`)).id;
const c = (await q1(`insert into instrumentales (caja_id, codigo, nombre, tipo, cant_por_caja) values ('${c9}','9.3','C','complejo',3) returning id`)).id;
const ma = (await q1(`insert into partes (instrumental_id, codigo_o_medida, cant_por_unidad) values ('${m}','Ø44',1) returning id`)).id;
const mb = (await q1(`insert into partes (instrumental_id, codigo_o_medida, cant_por_unidad) values ('${m}','Ø46',2) returning id`)).id;
const pa = (await q1(`insert into partes (instrumental_id, codigo_o_medida, nombre, cant_por_unidad) values ('${c}','A','Base',1) returning id`)).id;
const pb = (await q1(`insert into partes (instrumental_id, codigo_o_medida, nombre, cant_por_unidad) values ('${c}','B','Cuerpo',2) returning id`)).id;
await db.exec(`select ajustar_stock('${s}','stock_terminado',3); select ajustar_stock('${m}','stock_parte',2,'${ma}'); select ajustar_stock('${m}','stock_parte',5,'${mb}');
select ajustar_stock('${c}','unidades_armadas',1); select ajustar_stock('${c}','stock_parte',2,'${pa}'); select ajustar_stock('${c}','stock_parte',4,'${pb}');`);

await como(OP);
const r2 = await q1(`select armar_caja('${c9}', 'prueba') r`);
ok(r2.r.ok === true && r2.r.cajas_armadas === 1, "operario arma caja de prueba");
const st = await q1(`select (select stock_terminado from instrumentales where id='${s}') s, (select stock from partes where id='${ma}') ma, (select stock from partes where id='${mb}') mb,
  (select unidades_armadas from instrumentales where id='${c}') ua, (select stock from partes where id='${pa}') pa, (select stock from partes where id='${pb}') pb`);
ok(st.s === 1 && st.ma === 0 && st.mb === 1 && st.ua === 0 && st.pa === 0 && st.pb === 0, `descuentos correctos ${JSON.stringify(st)}`);
const r3 = await q1(`select armar_caja('${c9}') r`);
ok(r3.r.ok === false, `segunda caja rechazada: ${r3.r.faltantes.join(" | ")}`);
ok((await q1(`select cajas_armadas from cajas where id='${c9}'`)).cajas_armadas === 1, "rechazo no tocó el contador");
await err(`select entregar_caja('${c9}','correccion')`, "operario no puede usar motivo corrección");
ok((await q1(`select entregar_caja('${c9}') r`)).r === 0, "entregar -> 0");

await como(ADMIN);
const mv = (await db.query(`select campo, delta, stock_resultante from movimientos where caja_id='${c9}' and motivo='armado_caja' order by id`)).rows;
ok(mv.length === 7, `armado generó 7 movimientos: ${JSON.stringify(mv.map((x) => [x.campo, x.delta, x.stock_resultante]))}`);
// ---------- PLANOS ----------
const c1 = (await q1(`select id from cajas where numero=1`)).id;
await db.query(`insert into planos (caja_id, instrumental_id, nombre, ruta, formato) values ('${c1}','${i15}','Colocador 1-2','caja-1/colocador-1-2.pdf','pdf')`);
await db.query(`insert into storage.objects (bucket_id, name) values ('planos','caja-1/colocador-1-2.pdf')`);
ok((await q1(`select count(*)::int n from storage.buckets where id='planos' and not public`)).n === 1, "bucket planos privado");
await como(OP);
ok((await db.query(`select * from planos`)).rows.length === 1, "operario ve planos");
ok((await db.query(`select * from storage.objects where bucket_id='planos'`)).rows.length === 1, "operario puede bajar archivos de planos");
await err(`insert into planos (caja_id, nombre, ruta, formato) values ('${c1}','x','x.pdf','pdf')`, "operario NO sube planos");
await err(`insert into storage.objects (bucket_id, name) values ('planos','x.pdf')`, "operario NO sube archivos");
await db.query(`delete from planos`);
await como(ADMIN);
ok((await q1(`select count(*)::int n from planos`)).n === 1, "operario NO borra planos");

// ---------- NOVEDADES ----------
const nov = async (where) => (await db.query(`select * from novedades where ${where} order by id`)).rows;
const ed = await nov(`seccion='instrumentales' and titulo like 'Edición%Plástico convexo (ed)%'`);
ok(ed.length === 1 && ed[0].detalle.includes("nombre: Plástico convexo → Plástico convexo (ed)") && ed[0].autor_nombre === "Dueño",
  `edición de instrumental queda en novedades con autor: ${JSON.stringify(ed[0]?.detalle)}`);
const antesStock = (await q1(`select count(*)::int n from novedades`)).n;
await db.query(`select ajustar_stock('${i13}','stock_terminado',1)`);
ok((await q1(`select count(*)::int n from novedades`)).n === antesStock, "los cambios de stock NO generan novedades (van al historial)");
ok((await nov(`titulo like 'Alta · Caja 9%'`)).length === 1, "alta de caja registrada");
ok((await nov(`titulo like 'Alta · Plano Colocador 1-2%'`)).length === 1, "alta de plano registrada");
const antesMover = (await q1(`select count(*)::int n from novedades`)).n;
await db.query(`update instrumentales set orden = orden + 1 where id='${i13}'`);
ok((await q1(`select count(*)::int n from novedades`)).n === antesMover, "cambiar solo el orden no genera novedad");
await db.query(`delete from cajas where id='${c9}'`);
ok((await nov(`titulo like 'Baja · Caja 9%'`)).length === 1 && (await nov(`titulo like 'Baja · Instrumental 9.%'`)).length === 0,
  "baja de caja: 1 novedad (sin una por cada instrumental borrado en cascada)");
await db.query(`insert into novedades (titulo, detalle) values ('Reunión con el Dr. X', 'Pidió revisar el colocador')`);
const man = (await nov(`titulo='Reunión con el Dr. X'`))[0];
ok(man?.origen === "manual" && man?.autor_nombre === "Dueño", "admin agrega nota manual con su nombre");
await err(`insert into novedades (titulo, origen) values ('x','claude')`, "admin no puede hacerse pasar por Claude/sistema");
await err(`delete from novedades`, "nadie borra novedades");
await err(`update novedades set titulo='hack'`, "nadie edita novedades");
ok((await nov(`titulo='hack'`)).length === 0 && (await q1(`select count(*)::int n from novedades`)).n > 0, "novedades no se editan ni se borran");

// ---------- TAREAS ----------
const t1 = (await q1(`insert into tareas (titulo, medico, caja_id, instrumental_id, prioridad)
  values ('Mango del colocador más largo', 'Dr. Pérez', '${c1}', '${i15}', 'alta') returning *`));
ok(t1.creado_por_nombre === "Dueño" && !t1.hecha && t1.hecha_en === null, "admin crea tarea (queda pendiente, con autor)");
ok((await nov(`titulo='Nueva tarea · Mango del colocador más largo'`)).length === 1, "nueva tarea -> novedad");
await como(OP);
ok((await db.query(`select * from tareas`)).rows.length === 1, "operario ve las tareas");
await db.query(`update tareas set hecha=true where id='${t1.id}'`);
await err(`insert into tareas (titulo) values ('x')`, "operario NO crea tareas");
await como(ADMIN);
ok((await q1(`select hecha from tareas where id='${t1.id}'`)).hecha === false, "operario NO marca tareas");
const t1b = await q1(`update tareas set hecha=true where id='${t1.id}' returning *`);
ok(t1b.hecha && t1b.hecha_en !== null && t1b.hecha_por_nombre === "Dueño", "admin marca corregida: guarda quién y cuándo");
ok((await nov(`titulo='✓ Tarea corregida · Mango del colocador más largo'`)).length === 1, "tarea corregida -> novedad");
const t1c = await q1(`update tareas set hecha=false where id='${t1.id}' returning *`);
ok(!t1c.hecha && t1c.hecha_en === null && t1c.hecha_por_nombre === null, "desmarcar limpia quién y cuándo");
await err(`update tareas set hecha_por_nombre='otro' where id='${t1.id}'`, "no se puede falsear quién la marcó");

await db.exec(`reset role; select set_config('request.jwt.claim.sub','',false); set role anon;`);
await err(`select * from novedades`, "anon no lee novedades");
await err(`select * from tareas`, "anon no lee tareas");
await err(`select * from cajas`, "anon no lee nada");
await err(`select * from planos`, "anon no lee planos");
await err(`select ajustar_stock('${s}','stock_terminado',1)`, "anon no ejecuta RPC");
console.log(fallas ? `\n${fallas} FALLAS` : "\nTODO OK");
process.exit(fallas ? 1 : 0);
