import "server-only";

// Avisos al celular del equipo. Cada canal se activa solo si están sus variables de entorno (ver .env.example).
// Si no hay ninguno configurado, no hace nada. Un aviso que falla NUNCA rompe la acción que lo disparó.
//
//   Telegram  → TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID          (recomendado: gratis, sin límites prácticos, grupo del equipo)
//   WhatsApp  → CALLMEBOT_TELEFONOS + CALLMEBOT_APIKEYS        (CallMeBot, gratis, uso personal; una apikey por teléfono)
//   Push      → NTFY_TEMA (+ NTFY_SERVIDOR opcional)            (app ntfy en el celular; el tema hace de contraseña)

const TIEMPO_MAX = 6000;

async function conLimite(url: string, init: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIEMPO_MAX);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
    if (!r.ok) throw new Error(`${r.status} ${await r.text().catch(() => "")}`.slice(0, 200));
  } finally {
    clearTimeout(t);
  }
}

async function telegram(texto: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  await conLimite(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: texto, disable_web_page_preview: true }),
  });
}

async function whatsapp(texto: string) {
  const tels = (process.env.CALLMEBOT_TELEFONOS ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const claves = (process.env.CALLMEBOT_APIKEYS ?? "").split(",").map((x) => x.trim());
  await Promise.all(
    tels.map((tel, i) =>
      claves[i]
        ? conLimite(`https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(tel)}&apikey=${encodeURIComponent(claves[i])}&text=${encodeURIComponent(texto)}`, { method: "GET" })
        : Promise.resolve(),
    ),
  );
}

async function ntfy(titulo: string, texto: string, link?: string) {
  const tema = process.env.NTFY_TEMA;
  if (!tema) return;
  const servidor = (process.env.NTFY_SERVIDOR ?? "https://ntfy.sh").replace(/\/$/, "");
  // Los encabezados HTTP no aceptan acentos: el título va sin tildes, el cuerpo completo.
  const tituloAscii = titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "");
  await conLimite(`${servidor}/${encodeURIComponent(tema)}`, {
    method: "POST",
    headers: { Title: tituloAscii, ...(link ? { Click: link } : {}) },
    body: texto,
  });
}

export function hayCanales(): boolean {
  return !!(
    (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) ||
    (process.env.CALLMEBOT_TELEFONOS && process.env.CALLMEBOT_APIKEYS) ||
    process.env.NTFY_TEMA
  );
}

/** Manda el aviso por todos los canales configurados. Devuelve los errores (para el resumen diario), nunca tira. */
export async function notificar(titulo: string, texto: string, link?: string): Promise<string[]> {
  if (!hayCanales()) return [];
  const completo = `${titulo}\n${texto}${link ? `\n${link}` : ""}`;
  const r = await Promise.allSettled([telegram(completo), whatsapp(completo), ntfy(titulo, texto, link)]);
  const errores = r.flatMap((x, i) => (x.status === "rejected" ? [`${["Telegram", "WhatsApp", "ntfy"][i]}: ${String(x.reason?.message ?? x.reason)}`] : []));
  if (errores.length) console.error("Avisos con error:", errores);
  return errores;
}

/** URL pública de la app para los links de los avisos (sin depender del pedido HTTP). */
export function urlApp(ruta = "/"): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")).replace(/\/$/, "");
  return `${base}${ruta}`;
}
