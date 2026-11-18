// Corre SQL en el proyecto de Supabase con el token personal (SUPABASE_ACCESS_TOKEN en .env.local, nunca se imprime).
// Uso:  node --env-file=.env.local scripts/sql-supabase.mjs archivo.sql
//       node --env-file=.env.local scripts/sql-supabase.mjs -e "select 1"
// Sirve para aplicar migraciones (Vercel no las corre) sin pegarlas a mano en el SQL Editor.
import fs from "node:fs";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ref = process.env.SUPABASE_PROJECT_REF ?? url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
if (!token || !ref) {
  console.error("Falta SUPABASE_ACCESS_TOKEN o la URL del proyecto en .env.local");
  process.exit(1);
}
const [modo, arg] = process.argv.slice(2);
const query = modo === "-e" ? arg : fs.readFileSync(modo, "utf8");
if (!query?.trim()) {
  console.error('Uso: sql-supabase.mjs archivo.sql | -e "select 1"');
  process.exit(1);
}
const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
  body: JSON.stringify({ query }),
});
const texto = await r.text();
if (!r.ok) {
  console.error(`Error ${r.status}: ${texto.slice(0, 1000)}`);
  process.exit(1);
}
console.log(texto.length > 4000 ? texto.slice(0, 4000) + " …" : texto);
