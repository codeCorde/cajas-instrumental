// Cliente de la API de Claude (/api/claude). Lo usa Claude para cargar lo que el dueño le dicta o le manda.
// Lee CLAUDE_API_URL y CLAUDE_API_TOKEN de .env.local (nunca los muestra).
//
//   node scripts/claude-api.mjs get faltantes|catalogo|pedidos
//   node scripts/claude-api.mjs post '{"accion":"datos","tabla":"instrumentales","id":"…","campos":{"maquina":"Torno CNC"}}'
//   node scripts/claude-api.mjs subir instrumental|componente|caja <id> <ruta-del-archivo>
import fs from "node:fs";
import path from "node:path";

function leerEnv() {
  const env = {};
  try {
    for (const linea of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* sin .env.local */
  }
  return { url: (process.env.CLAUDE_API_URL ?? env.CLAUDE_API_URL ?? "").replace(/\/$/, ""), token: process.env.CLAUDE_API_TOKEN ?? env.CLAUDE_API_TOKEN ?? "" };
}

const { url, token } = leerEnv();
if (!url || !token) {
  console.error("Faltan CLAUDE_API_URL y CLAUDE_API_TOKEN en .env.local (ver README → «Carga automática con Claude»).");
  process.exit(1);
}
const h = { authorization: `Bearer ${token}`, "content-type": "application/json" };
const [cmd, ...args] = process.argv.slice(2);

async function llamar(metodo, cuerpo, query = "") {
  const r = await fetch(`${url}/api/claude${query}`, { method: metodo, headers: h, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const j = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
  if (!j.ok) {
    console.error("Error:", j.error);
    process.exit(1);
  }
  return j;
}

if (cmd === "get") {
  console.log(JSON.stringify(await llamar("GET", null, `?que=${encodeURIComponent(args[0] ?? "faltantes")}`), null, 2));
} else if (cmd === "post") {
  console.log(JSON.stringify(await llamar("POST", JSON.parse(args[0])), null, 2));
} else if (cmd === "subir") {
  const [entidad, id, archivo] = args;
  const nombre = path.basename(archivo);
  const datos = fs.readFileSync(archivo);
  const p = await llamar("POST", { accion: "preparar_subida", entidad, entidad_id: id, nombre, tamano: datos.length });
  const up = await fetch(p.url, { method: "PUT", body: datos, headers: { "content-type": "application/octet-stream", "x-upsert": "false" } });
  if (!up.ok) {
    console.error("No se pudo subir:", up.status, await up.text());
    process.exit(1);
  }
  await llamar("POST", { accion: "confirmar_subida", entidad, entidad_id: id, nombre, tamano: datos.length, ruta: p.ruta });
  console.log(`✓ Subido: ${nombre}`);
} else {
  console.error("Uso: get <que> | post '<json>' | subir <entidad> <id> <archivo>");
  process.exit(1);
}
