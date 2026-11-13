// Genera la contraseña única de la app (hash bcrypt, guardado en base64 porque los "$" se rompen en los .env).
// Uso: npm run hash-password            → te la pide sin mostrarla y te da el valor para Vercel
//      npm run hash-password -- --local → además la guarda en .env.local
import bcrypt from "bcryptjs";
import fs from "node:fs";
import readline from "node:readline";

function preguntarOculto(texto) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.includes(texto)) rl.output.write(s);
    };
    rl.question(texto, (r) => {
      rl.close();
      process.stdout.write("\n");
      resolve(r);
    });
  });
}

const clave = await preguntarOculto("Contraseña nueva (mínimo 8 caracteres): ");
if (clave.length < 8) {
  console.error("Muy corta: usá al menos 8 caracteres.");
  process.exit(1);
}
const repetida = await preguntarOculto("Repetila: ");
if (clave !== repetida) {
  console.error("No coinciden.");
  process.exit(1);
}

const valor = Buffer.from(bcrypt.hashSync(clave, 12)).toString("base64");
console.log("\nPara Vercel (Settings → Environment Variables), APP_PASSWORD_HASH =\n" + valor);

if (process.argv.includes("--local")) {
  const ruta = ".env.local";
  const linea = `APP_PASSWORD_HASH=${valor}`;
  let env = fs.existsSync(ruta) ? fs.readFileSync(ruta, "utf8") : "";
  // saca el comentario de la contraseña de prueba, si estaba
  env = env.replace(/^# Contraseña de PRUEBA local.*\n/m, "# Contraseña de la app (npm run hash-password -- --local)\n");
  env = /^APP_PASSWORD_HASH=.*$/m.test(env) ? env.replace(/^APP_PASSWORD_HASH=.*$/m, () => linea) : env.replace(/\n?$/, "\n") + linea + "\n";
  fs.writeFileSync(ruta, env);
  console.log("\n✓ Guardada en .env.local. Reiniciá `npm run dev` para que la tome.");
}
