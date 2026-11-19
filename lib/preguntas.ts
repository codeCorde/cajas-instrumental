import "server-only";
import { db } from "./db";

// Preguntas puntuales para el dueño que salen UNA vez, dentro del próximo aviso programado (resumen o recordatorio),
// en vez de mandar un mensaje aparte. Las carga Claude (por la API) cuando encuentra un dato que hay que confirmar,
// por ejemplo una contradicción entre un plano y lo cargado. Se guardan en taller.config, clave «preguntas_aviso».

export interface PreguntaAviso {
  texto: string;
  creada: string;
  autor: string;
}

const CLAVE = "preguntas_aviso";

export async function leerPreguntasAviso(): Promise<PreguntaAviso[]> {
  const { data } = await db().from("config").select("valor").eq("clave", CLAVE).maybeSingle();
  return Array.isArray(data?.valor) ? (data.valor as PreguntaAviso[]) : [];
}

export async function agregarPreguntaAviso(texto: string, autor: string): Promise<number> {
  const t = texto.trim().slice(0, 600);
  if (!t) throw new Error("La pregunta está vacía");
  const actuales = await leerPreguntasAviso();
  if (actuales.some((p) => p.texto === t)) return actuales.length;
  const nuevas = [...actuales, { texto: t, creada: new Date().toISOString(), autor }].slice(-10);
  const { error } = await db().from("config").upsert({ clave: CLAVE, valor: nuevas });
  if (error) throw new Error(error.message);
  return nuevas.length;
}

/** Saca de la lista las preguntas que ya salieron en un aviso. */
export async function quitarPreguntasEnviadas(enviadas: PreguntaAviso[]): Promise<void> {
  if (!enviadas.length) return;
  const textos = new Set(enviadas.map((p) => p.texto));
  const quedan = (await leerPreguntasAviso()).filter((p) => !textos.has(p.texto));
  await db().from("config").upsert({ clave: CLAVE, valor: quedan });
}

export function bloquePreguntas(preguntas: PreguntaAviso[]): string[] {
  if (!preguntas.length) return [];
  return ["", "📌 Para confirmar (respondé en el chat con Claude):", ...preguntas.map((p, i) => `${i + 1}. ${p.texto}`)];
}
