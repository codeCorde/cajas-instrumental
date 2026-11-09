// Crea (o promueve) el primer usuario ADMIN.
// Uso:  npm run crear-admin -- tu@email.com "Tu nombre"
// Lee las claves de .env.local. Manda un email de invitación: con ese link elegís tu contraseña.
// Si el usuario ya existe, solo le da el rol admin.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
if (!fs.existsSync(".env.local")) {
  console.error("Falta .env.local: copiá .env.example y completá las claves de Supabase.");
  process.exit(1);
}
for (const linea of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = linea.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const clave = env.SUPABASE_SERVICE_ROLE_KEY;
const sitio = env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const [email, nombre = ""] = process.argv.slice(2);

if (!url || !clave || url.includes("xxxx")) {
  console.error("Completá NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}
if (!email || !email.includes("@")) {
  console.error('Uso: npm run crear-admin -- tu@email.com "Tu nombre"');
  process.exit(1);
}

const sb = createClient(url, clave, { auth: { persistSession: false } });

let id;
const { data, error } = await sb.auth.admin.inviteUserByEmail(email, {
  data: { nombre },
  redirectTo: `${sitio}/auth/nueva-clave`,
});
if (data?.user) {
  id = data.user.id;
  console.log(`Invitación enviada a ${email}. Abrí el email para elegir tu contraseña.`);
} else {
  // ¿Ya existe? Lo buscamos.
  const { data: lista, error: e2 } = await sb.auth.admin.listUsers({ perPage: 1000 });
  if (e2) throw e2;
  id = lista.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
  if (!id) {
    console.error("No se pudo invitar:", error?.message);
    process.exit(1);
  }
  console.log(`${email} ya existía; se lo hace admin.`);
}

const cambios = { rol: "admin", ...(nombre ? { nombre } : {}) };
const { error: e3 } = await sb.from("perfiles").update(cambios).eq("id", id);
if (e3) {
  console.error("No se pudo asignar el rol (¿corriste las migraciones?):", e3.message);
  process.exit(1);
}
console.log("Listo: es admin.");
