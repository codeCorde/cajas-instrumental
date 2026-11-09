// Carga los instrumentales de las 3 cajas y sube sus planos a Supabase Storage.
// Uso:  node scripts/importar-cajas.mjs "C:\Users\...\Recopilación cajas de cirugía"
// Se puede correr de nuevo: no duplica instrumentales ni planos (los reemplaza).
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const RAIZ = process.argv[2];
if (!RAIZ || !fs.existsSync(RAIZ)) {
  console.error('Uso: node scripts/importar-cajas.mjs "<carpeta Recopilación cajas de cirugía>"');
  process.exit(1);
}
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const SIN_ROTULO = "Sin rótulo en el plano de la caja";
// archivos: rutas relativas a la carpeta de la caja; si terminan en "/" se toma toda la subcarpeta.
// existe: el instrumental ya estaba cargado (Caja 1): solo se le suman los planos.
const CAJAS = [
  {
    numero: 1, nombre: "Caja Doble Movilidad", carpeta: "caja Doble movilidad",
    planosCaja: ["Probadores.dwg"],
    instrumentales: [
      { codigo: "1.1", existe: true, alias: "Probador de cotilo", archivos: ["Probador de cotilo/"] },
      { codigo: "1.2", existe: true, alias: "Impactor de cabeza (cúpula doble movilidad)", archivos: ["Impactor de cabeza/"] },
      { codigo: "1.5", existe: true, alias: "Colocador de cúpula doble movilidad", archivos: ["Colocador/"] },
      { codigo: "1.6", existe: true, alias: "Probador de liner para cúpula doble movilidad", archivos: ["Probador de liner/"] },
      { codigo: "1.7", existe: true, archivos: ["Prensa/"] },
      { codigo: "1.8", existe: true, alias: "Probador de componente cefálico Ø28 / Ø32", archivos: ["Probador de componente cefálico ¥28.pdf", "Probador de componente cefálico ¥32.pdf"] },
      { codigo: "1.9", existe: true, archivos: ["Mango de fresa/"] },
      { codigo: "1.10", existe: true, archivos: ["Fresas acetabulares/"] },
      { codigo: "1.11", nombre: "Empujador", archivos: ["Empujador.pdf", "Empujador.dwg"] },
      { codigo: "1.12", nombre: "Extractor de liner para cúpula doble movilidad", archivos: ["Extractor/"] },
    ],
  },
  {
    numero: 2, nombre: "Caja Charnley-Muller", carpeta: "Caja charnley-Muller",
    planosCaja: ["Caja de cirugía Charnley y Muller.dwg"],
    instrumentales: [
      { codigo: "2.1", nombre: "Broca con tope", archivos: ["Broca con tope/"] },
      { codigo: "2.2", nombre: "Cureta de cadera", archivos: ["Cureta de cadera.pdf"] },
      { codigo: "2.3", nombre: "Escopio para cajón", archivos: ["Escopio para cajón.pdf"] },
      { codigo: "2.4", nombre: "Impactor de cabeza", archivos: ["Impactor de cabeza.pdf"] },
      { codigo: "2.5", nombre: "Llave Allen 2,5", archivos: ["Llave Allen 2.5.pdf"] },
      { codigo: "2.6", nombre: "Mango de fresa", archivos: ["Mango de fresa/"] },
      { codigo: "2.7", nombre: "Palanca dislocadora", archivos: ["Palanca dislocadora/"] },
      { codigo: "2.8", nombre: "Perno para raspa", archivos: ["Perno para raspa.pdf"] },
      { codigo: "2.9", nombre: "Probador de componente cefálico", tipo: "medidas", medidas: ["Ø28", "Ø32"], archivos: ["Probador de componente cefálico ¥28.pdf", "Probador de componente cefálico ¥32.pdf"] },
      { codigo: "2.10", nombre: "Probador de tapón endomedular", alias: "Mango en T + mango + probador", archivos: ["Probador de tapón endomedular/"] },
      { codigo: "2.11", nombre: "Raspas Muller", tipo: "medidas", medidas: ["N°7,5", "N°10", "N°12,5", "N°15", "N°17,5", "N°20"],
        archivos: ["Raspa Muller N°7.5.pdf", "Raspa Muller N°10.pdf", "Raspa Muller N°12.5.pdf", "Raspa Muller N°15.pdf", "Raspa Muller N°17.5.pdf", "Raspa Muller N°20.pdf"] },
      { codigo: "2.12", nombre: "Tirabuzón de Putti", archivos: ["Tirabuzón de Putti.pdf"] },
      { codigo: "2.13", nombre: "Acople", alias: SIN_ROTULO, archivos: ["Piezas sin rotulo/Acople.pdf"] },
      { codigo: "2.14", nombre: "Guía de mecha", alias: SIN_ROTULO, archivos: ["Piezas sin rotulo/Guía de mecha.pdf"] },
      { codigo: "2.15", nombre: "Mango colocador", alias: SIN_ROTULO, archivos: ["Piezas sin rotulo/Mango colocador.pdf"] },
      { codigo: "2.16", nombre: "Mecha flexible", alias: SIN_ROTULO, archivos: ["Piezas sin rotulo/Mecha flexible.pdf"] },
      { codigo: "2.17", nombre: "Perno", alias: SIN_ROTULO, archivos: ["Piezas sin rotulo/Perno.pdf"] },
      { codigo: "2.18", nombre: "Probadores", alias: SIN_ROTULO, archivos: ["Piezas sin rotulo/Probadores.pdf"] },
      { codigo: "2.19", nombre: "Pieza sin rótulo 1", alias: `${SIN_ROTULO} · nombre provisorio`, archivos: ["Piezas sin rotulo/1.pdf"] },
      { codigo: "2.20", nombre: "Pieza sin rótulo 2", alias: `${SIN_ROTULO} · nombre provisorio`, archivos: ["Piezas sin rotulo/2.pdf"] },
    ],
  },
  {
    numero: 3, nombre: "Caja Tricónico", carpeta: "Caja Tricónico",
    planosCaja: ["Caja de cirugía para tallos tricónicos.dwg"],
    instrumentales: [
      { codigo: "3.1", nombre: "Calisuar en T", tipo: "medidas", medidas: ["Ø12", "Ø16"], archivos: ["Calisuar/"] },
      { codigo: "3.2", nombre: "Colocador de tallo tricónico", archivos: ["Colocador de tallo/"] },
      { codigo: "3.3", nombre: "Cureta de cadera", archivos: ["Cureta de cadera.pdf"] },
      { codigo: "3.4", nombre: "Escopio para cajón", archivos: ["Escopio para cajón.pdf"] },
      { codigo: "3.5", nombre: "Impactor de cabeza", archivos: ["Impactor de cabeza.pdf"] },
      { codigo: "3.6", nombre: "Llave Allen 5/32", nota: "Según el archivo, entra también la llave de 4 mm.", archivos: ["Llave Allen 5 32 (entra 4mm tmb).stp"] },
      { codigo: "3.7", nombre: "Mango para raspas", archivos: ["Mango para raspas/"] },
      { codigo: "3.8", nombre: "Palanca dislocadora", archivos: ["Palanca dislocadora/"] },
      { codigo: "3.9", nombre: "Probador de componente cefálico", tipo: "medidas", medidas: ["Ø28", "Ø32"], archivos: ["Probador de componente cefálico ¥28.pdf", "Probador de componente cefálico ¥32.pdf"] },
      { codigo: "3.10", nombre: "Probador de cono para tallos tricónicos", archivos: ["Probador de cono para tallos tricónicos.pdf"] },
      { codigo: "3.11", nombre: "Probador de tapón endomedular", alias: "Mango en T + mango + probador", archivos: ["Probador de tapón endomedular/"] },
      { codigo: "3.12", nombre: "Raspas para tallos tricónicos", archivos: ["Raspas para tallos tricónicos.pdf"] },
    ],
  },
];

const slug = (t) =>
  t.replace(/[Ø¥°]/g, "o").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
const nombreDe = (archivo) => {
  const ext = path.extname(archivo);
  return { nombre: path.basename(archivo, ext).replace(/¥/g, "Ø").trim(), formato: ext.slice(1).toLowerCase() };
};
const TIPOS = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };
const usados = new Set();

function expandir(carpetaCaja, archivos) {
  return archivos.flatMap((a) => {
    const abs = path.join(RAIZ, carpetaCaja, a);
    if (a.endsWith("/")) return fs.readdirSync(abs).filter((f) => fs.statSync(path.join(abs, f)).isFile()).map((f) => path.join(a, f));
    if (!fs.existsSync(abs)) throw new Error(`No existe: ${abs}`);
    return [a];
  });
}

async function subirPlano(caja, cajaNumero, instrumental, rel, orden) {
  const abs = path.join(RAIZ, caja.carpeta, rel);
  usados.add(path.normalize(abs));
  const { nombre, formato } = nombreDe(rel);
  const ruta = `caja-${cajaNumero}/${instrumental ? slug(instrumental.codigo) : "caja"}/${slug(rel.replace(/\\/g, "/").replace(/\//g, "--"))}`;
  const buf = fs.readFileSync(abs);
  const up = await sb.storage.from("planos").upload(ruta, buf, { contentType: TIPOS[formato] ?? "application/octet-stream", upsert: true });
  if (up.error) throw new Error(`${rel}: ${up.error.message}`);
  const fila = { caja_id: caja.id, instrumental_id: instrumental?.id ?? null, nombre, ruta, formato, tamano: buf.length, orden };
  const ins = await sb.from("planos").upsert(fila, { onConflict: "ruta" });
  if (ins.error) throw new Error(`${rel}: ${ins.error.message}`);
  process.stdout.write(".");
}

for (const c of CAJAS) {
  // Caja: crear o renombrar
  let { data: caja } = await sb.from("cajas").select("*").eq("numero", c.numero).maybeSingle();
  if (!caja) ({ data: caja } = await sb.from("cajas").insert({ numero: c.numero, nombre: c.nombre }).select().single());
  else if (caja.nombre !== c.nombre) await sb.from("cajas").update({ nombre: c.nombre }).eq("id", caja.id);
  caja.carpeta = c.carpeta;
  console.log(`\nCaja ${c.numero} · ${c.nombre}`);

  for (const [n, rel] of c.planosCaja.entries()) await subirPlano(caja, c.numero, null, rel, n);

  for (const [idx, def] of c.instrumentales.entries()) {
    let { data: inst } = await sb.from("instrumentales").select("id, codigo, alias").eq("caja_id", caja.id).eq("codigo", def.codigo).maybeSingle();
    if (!inst && def.existe) throw new Error(`Se esperaba el instrumental ${def.codigo} en la caja ${c.numero}`);
    if (!inst) {
      const { data, error } = await sb
        .from("instrumentales")
        .insert({ caja_id: caja.id, codigo: def.codigo, nombre: def.nombre, alias: def.alias ?? null, tipo: def.tipo ?? "simple", cant_por_caja: 1, orden: idx + 1 })
        .select("id, codigo, alias")
        .single();
      if (error) throw error;
      inst = data;
      for (const [o, m] of (def.medidas ?? []).entries()) {
        const { error: e2 } = await sb.from("partes").insert({ instrumental_id: inst.id, codigo_o_medida: m, cant_por_unidad: 1, stock: 0, orden: o + 1 });
        if (e2) throw e2;
      }
      if (def.nota) await sb.from("notas").insert({ instrumental_id: inst.id, tipo: "General", texto: def.nota });
    } else if (def.alias && !inst.alias) {
      await sb.from("instrumentales").update({ alias: def.alias }).eq("id", inst.id);
    }
    process.stdout.write(`\n  ${def.codigo} ${def.nombre ?? "(existente)"} `);
    for (const [o, rel] of expandir(c.carpeta, def.archivos).entries()) await subirPlano(caja, c.numero, inst, rel, o);
  }
}

// ¿Quedó algún archivo sin asignar?
const todos = [];
const recorrer = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? recorrer(path.join(d, e.name)) : todos.push(path.normalize(path.join(d, e.name)))));
recorrer(RAIZ);
const sobrantes = todos.filter((f) => !usados.has(f));
console.log(`\n\nListo: ${usados.size} de ${todos.length} archivos subidos.`);
if (sobrantes.length) console.log("Sin asignar:\n  " + sobrantes.join("\n  "));
