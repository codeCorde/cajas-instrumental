import { crearClienteServidor } from "./supabase/server";
import { PRIORIDAD_ORDEN, type Novedad, type OrigenNovedad, type Tarea } from "./tipos";

const ORIGENES: OrigenNovedad[] = ["app", "manual", "claude", "sistema"];
export const esOrigen = (s?: string): s is OrigenNovedad => !!s && (ORIGENES as string[]).includes(s);

/** Últimas novedades (registro de cambios), opcionalmente de un solo origen. */
export async function listarNovedades(origen?: string, limite = 300): Promise<Novedad[]> {
  const supabase = await crearClienteServidor();
  let q = supabase.from("novedades").select("*").order("creado_en", { ascending: false }).order("id", { ascending: false }).limit(limite);
  if (esOrigen(origen)) q = q.eq("origen", origen);
  const { data, error } = await q;
  if (error) throw error;
  return data as Novedad[];
}

/** Todas las tareas: primero las pendientes (por prioridad y antigüedad), después las corregidas (más recientes primero). */
export async function listarTareas(): Promise<Tarea[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("tareas")
    .select("*, caja:cajas(id, numero, nombre), instrumental:instrumentales(id, codigo, nombre)")
    .order("creado_en", { ascending: true });
  if (error) throw error;
  return ordenarTareas(data as unknown as Tarea[]);
}

export function ordenarTareas(tareas: Tarea[]): Tarea[] {
  return [...tareas].sort((a, b) => {
    if (a.hecha !== b.hecha) return a.hecha ? 1 : -1;
    if (!a.hecha) return PRIORIDAD_ORDEN[a.prioridad] - PRIORIDAD_ORDEN[b.prioridad] || a.creado_en.localeCompare(b.creado_en);
    return (b.hecha_en ?? "").localeCompare(a.hecha_en ?? "");
  });
}

/** "lunes 9 de noviembre de 2026" en hora de Argentina (para agrupar la línea de tiempo). */
export function diaLegible(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function horaLegible(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
  });
}
