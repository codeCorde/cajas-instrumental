import { crearClienteServidor } from "./supabase/server";
import type { Movimiento } from "./tipos";

export interface FiltrosHistorial {
  caja?: string;
  instrumental?: string;
  usuario?: string;
  desde?: string; // YYYY-MM-DD
  hasta?: string; // YYYY-MM-DD
}

const ZONA = "-03:00"; // Argentina

function diaSiguiente(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const esFecha = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const esUuid = (s?: string) => !!s && /^[0-9a-f-]{36}$/i.test(s);

/** Lee movimientos con filtros. RLS: solo el admin ve filas. */
export async function buscarMovimientos(f: FiltrosHistorial, limite = 500): Promise<Movimiento[]> {
  const supabase = await crearClienteServidor();
  let q = supabase.from("movimientos").select("*").order("creado_en", { ascending: false }).limit(limite);
  if (esUuid(f.caja)) q = q.eq("caja_id", f.caja!);
  if (esUuid(f.instrumental)) q = q.eq("instrumental_id", f.instrumental!);
  if (esUuid(f.usuario)) q = q.eq("usuario_id", f.usuario!);
  if (esFecha(f.desde)) q = q.gte("creado_en", `${f.desde}T00:00:00${ZONA}`);
  if (esFecha(f.hasta)) q = q.lt("creado_en", `${diaSiguiente(f.hasta!)}T00:00:00${ZONA}`);
  const { data, error } = await q;
  if (error) throw error;
  return data as Movimiento[];
}

export function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
