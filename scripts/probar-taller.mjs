// Prueba el esquema "taller" (app nueva): datos iniciales, permisos y RPC, en un Postgres en memoria (PGlite).
// Uso: npm run test:sql   (corre también probar-sql.mjs, la app anterior)
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

const proj = process.argv[2] ?? process.cwd();
const db = new PGlite();
const leer = (f) => fs.readFileSync(path.join(proj, f), "utf8");
let fallas = 0;
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) fallas++; };
async function err(sql, msg) { try { await db.query(sql); ok(false, msg + " (no dio error)"); } catch (e) { ok(true, `${msg} -> ${e.message}`); } }
const q1 = async (sql) => (await db.query(sql)).rows[0];
const filas = async (sql) => (await db.query(sql)).rows;

// --- shim de Supabase ---
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
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
for (const f of ["0001_tablas", "0002_rls", "0003_rpc", "0004_planos", "0005_novedades_tareas", "0006_chat_equipo"]) await db.exec(leer(`supabase/migrations/${f}.sql`));
await db.exec(leer("supabase/seed.sql"));
// un plano de la app anterior, para probar que se pasa al instrumental nuevo
await db.exec(`insert into public.instrumentales (caja_id, codigo, nombre) select id, '3.3', 'Cureta de cadera' from public.cajas where numero = 3;
insert into public.planos (caja_id, instrumental_id, nombre, ruta, formato, tamano)
  select c.id, i.id, 'Cureta de cadera', 'caja-3/3-3/cureta.pdf', 'pdf', 1234 from public.cajas c join public.instrumentales i on i.caja_id = c.id
  where c.numero = 3 and i.codigo = '3.3';`);
await db.exec(leer("supabase/migrations/0007_taller.sql")); console.log("ok    0007_taller.sql");
await db.exec(leer("supabase/migrations/0008_taller_datos.sql")); console.log("ok    0008_taller_datos.sql");
await err(leer("supabase/migrations/0008_taller_datos.sql"), "0008 no se puede correr dos veces");

// ---------- datos iniciales ----------
ok((await q1(`select count(*)::int n from taller.cajas`)).n === 3, "3 cajas");
ok((await q1(`select count(*)::int n from taller.instrumentales`)).n === 28, "28 instrumentales en el catálogo");
ok((await q1(`select count(*)::int n from taller.instrumentales where a_confirmar and stock_terminado = 0`)).n === 28, "todos a confirmar y en 0");
const usos = await filas(`select i.codigo, string_agg(c.codigo, ',' order by c.codigo) cajas from taller.composicion_caja cc
  join taller.instrumentales i on i.id = cc.instrumental_id join taller.cajas c on c.id = cc.caja_id group by i.codigo`);
ok(usos.find((u) => u.codigo === "COM-01")?.cajas === "CHM,DM,TRI", "la cabeza de prueba está en las 3 cajas (un solo registro)");
ok(usos.find((u) => u.codigo === "COM-03")?.cajas === "CHM,TRI", "la cureta está en TRI y CHM");
const ext = await filas(`select codigo_o_medida, nombre from taller.componentes where instrumental_id = (select id from taller.instrumentales where codigo='DM-06') order by orden`);
ok(ext.length === 5 && ext[2].codigo_o_medida === "3/5" && ext[2].nombre === "Mandíbula superior", "piezas del extractor con código y nombre");
ok((await q1(`select count(*)::int n from taller.componentes where instrumental_id = (select id from taller.instrumentales where codigo='DM-01')`)).n === 10, "colocador Ø44..Ø62 = 10 medidas");
ok((await q1(`select count(*)::int n from taller.sin_clasificar`)).n === 9, "9 piezas en la bandeja Sin clasificar");
const arch = await q1(`select a.entidad, i.codigo from taller.archivos a join taller.instrumentales i on i.id = a.entidad_id where a.storage_path = 'caja-3/3-3/cureta.pdf'`);
ok(arch?.codigo === "COM-03", "el plano de la app anterior quedó en el instrumental compartido");

// ---------- permisos ----------
await db.exec(`set role anon;`);
await err(`select * from taller.cajas`, "anon no lee el esquema taller");
await db.exec(`reset role; set role authenticated;`);
await err(`select * from taller.instrumentales`, "authenticated tampoco");
await err(`select taller.ajustar_stock('stock', gen_random_uuid(), 1, 'x')`, "authenticated no ejecuta RPC");
await db.exec(`reset role; set role service_role;`);

// ---------- RPC ----------
const id = async (cod) => (await q1(`select id from taller.instrumentales where codigo='${cod}'`)).id;
const comp = async (cod, med) => (await q1(`select id from taller.componentes where instrumental_id='${await id(cod)}' and codigo_o_medida='${med}'`)).id;
const cureta = await id("COM-03");
ok((await q1(`select taller.ajustar_stock('stock_terminado','${cureta}',3,'Ana') r`)).r === 3, "cureta +3 -> 3");
ok((await q1(`select taller.ajustar_stock('stock_terminado','${cureta}',-10,'Ana','correccion') r`)).r === 0, "cureta -10 -> 0 (no baja de 0)");
const mv = await filas(`select autor, delta, stock_resultante, motivo from taller.movimientos order by id`);
ok(mv.length === 2 && mv[1].delta === -3 && mv[1].autor === "Ana", "el -10 se registró como -3, con el autor");
await err(`select taller.ajustar_stock('stock_terminado','${await id("COM-01")}',1,'Ana')`, "no se carga stock terminado a un instrumental de medidas");
await err(`select taller.ajustar_stock('stock_terminado','${cureta}',1,'  ')`, "sin nombre no se carga");
await err(`select taller.ajustar_stock('stock_terminado','${cureta}',1,'Ana','armado_caja')`, "motivo de armado no permitido en un ajuste");
await err(`update taller.movimientos set delta = 0`, "el historial no se edita");
await err(`delete from taller.movimientos`, "el historial no se borra");

// Armar un complejo
const palanca = await id("COM-06");
await err(`select taller.armar_instrumental('${palanca}','Ana')`, "armar palanca sin piezas -> error");
await db.exec(`select taller.ajustar_stock('stock','${await comp("COM-06", "1/2")}',2,'Ana'); select taller.ajustar_stock('stock','${await comp("COM-06", "2/2")}',1,'Ana');`);
ok((await q1(`select taller.armar_instrumental('${palanca}','Ana') r`)).r === 1, "arma 1 palanca");
ok((await q1(`select stock from taller.componentes where id='${await comp("COM-06", "1/2")}'`)).stock === 1, "descontó la pieza 1/2");

// Armar caja de prueba con stock compartido: simple ×2, medidas ×2, complejo ×3 (1 armado + 2 con piezas)
const cp = (await q1(`insert into taller.cajas (codigo, nombre) values ('PRU','Prueba') returning id`)).id;
const s = (await q1(`insert into taller.instrumentales (codigo, nombre, tipo) values ('P-1','S','simple') returning id`)).id;
const m = (await q1(`insert into taller.instrumentales (codigo, nombre, tipo) values ('P-2','M','medidas') returning id`)).id;
const c = (await q1(`insert into taller.instrumentales (codigo, nombre, tipo) values ('P-3','C','complejo') returning id`)).id;
await db.exec(`insert into taller.composicion_caja (caja_id, instrumental_id, cant_por_caja, orden) values ('${cp}','${s}',2,1), ('${cp}','${m}',2,2), ('${cp}','${c}',3,3);`);
const ma = (await q1(`insert into taller.componentes (instrumental_id, clase, codigo_o_medida, cant_por_unidad) values ('${m}','medida','Ø44',1) returning id`)).id;
const mb = (await q1(`insert into taller.componentes (instrumental_id, clase, codigo_o_medida, cant_por_unidad) values ('${m}','medida','Ø46',2) returning id`)).id;
const pa = (await q1(`insert into taller.componentes (instrumental_id, clase, codigo_o_medida, nombre, cant_por_unidad) values ('${c}','pieza','A','Base',1) returning id`)).id;
const pb = (await q1(`insert into taller.componentes (instrumental_id, clase, codigo_o_medida, nombre, cant_por_unidad) values ('${c}','pieza','B','Cuerpo',2) returning id`)).id;
const r0 = await q1(`select taller.armar_caja('${cp}','Ana') r`);
ok(r0.r.ok === false && r0.r.faltantes.length === 5, `sin stock no arma: ${r0.r.faltantes.join(" | ")}`);
await db.exec(`select taller.ajustar_stock('stock_terminado','${s}',3,'Ana'); select taller.ajustar_stock('stock','${ma}',2,'Ana'); select taller.ajustar_stock('stock','${mb}',5,'Ana');
select taller.ajustar_stock('unidades_armadas','${c}',1,'Ana'); select taller.ajustar_stock('stock','${pa}',2,'Ana'); select taller.ajustar_stock('stock','${pb}',4,'Ana');`);
const r1 = await q1(`select taller.armar_caja('${cp}','Ana') r`);
ok(r1.r.ok === true && r1.r.cajas_armadas === 1, "arma la caja de prueba");
const st = await q1(`select (select stock_terminado from taller.instrumentales where id='${s}') s, (select stock from taller.componentes where id='${ma}') ma,
  (select stock from taller.componentes where id='${mb}') mb, (select unidades_armadas from taller.instrumentales where id='${c}') ua,
  (select stock from taller.componentes where id='${pa}') pa, (select stock from taller.componentes where id='${pb}') pb`);
ok(st.s === 1 && st.ma === 0 && st.mb === 1 && st.ua === 0 && st.pa === 0 && st.pb === 0, `descuentos correctos ${JSON.stringify(st)}`);
const r2 = await q1(`select taller.armar_caja('${cp}','Ana') r`);
ok(r2.r.ok === false, "la segunda caja no alcanza y no toca nada");
ok((await q1(`select stock_terminado s from taller.instrumentales where id='${s}'`)).s === 1, "…el stock quedó igual");

ok((await q1(`select taller.desarmar_caja('${cp}','Ana') r`)).r === 0, "desarma la caja");
const st2 = await q1(`select (select stock_terminado from taller.instrumentales where id='${s}') s, (select stock from taller.componentes where id='${mb}') mb,
  (select unidades_armadas from taller.instrumentales where id='${c}') ua`);
ok(st2.s === 3 && st2.mb === 5 && st2.ua === 3, `devolvió el instrumental (complejos como armados) ${JSON.stringify(st2)}`);
await err(`select taller.desarmar_caja('${cp}','Ana')`, "no desarma si no hay cajas armadas");

// Pedido y entrega
await q1(`select taller.armar_caja('${cp}','Ana') r`);
const ped = (await q1(`insert into taller.pedidos (numero, cliente) values ('P-001','Clínica X') returning id`)).id;
await db.exec(`insert into taller.pedido_items (pedido_id, caja_id, cantidad) values ('${ped}','${cp}',2);`);
const e1 = await q1(`select taller.entregar_pedido('${ped}','Ana',true) r`);
ok(e1.r.ok === false, "no entrega 2 cajas si hay 1 armada");
ok((await q1(`select taller.entregar_pedido('${ped}','Ana',false) r`)).r.ok === true, "entrega sin descontar");
ok((await q1(`select estado from taller.pedidos where id='${ped}'`)).estado === "entregado", "pedido entregado");
await err(`select taller.entregar_pedido('${ped}','Ana',false)`, "no se entrega dos veces");
const ped2 = (await q1(`insert into taller.pedidos (numero, cliente) values ('P-002','Clínica Y') returning id`)).id;
await db.exec(`insert into taller.pedido_items (pedido_id, caja_id, cantidad) values ('${ped2}','${cp}',1);`);
ok((await q1(`select taller.entregar_pedido('${ped2}','Ana',true) r`)).r.ok === true, "entrega descontando");
ok((await q1(`select cajas_armadas n from taller.cajas where id='${cp}'`)).n === 0, "descontó la caja armada");
ok((await q1(`select count(*)::int n from taller.movimientos where motivo='entrega'`)).n === 1, "la entrega quedó en el historial");

console.log(fallas ? `\n${fallas} FALLAS` : "\nTODO OK");
process.exit(fallas ? 1 : 0);
