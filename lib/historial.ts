import "server-only";
import { db, sinError } from "./db";
import type { Movimiento } from "./tipos";

export interface FiltroHistorial {
  desde?: string;
  hasta?: string;
  caja?: string;
  instrumental?: string;
  motivo?: string;
  autor?: string;
  limite?: number;
}

export async function listarMovimientos(f: FiltroHistorial = {}): Promise<Movimiento[]> {
  let q = db().from("movimientos").select("*").order("creado_en", { ascending: false }).order("id", { ascending: false }).limit(f.limite ?? 300);
  if (f.desde) q = q.gte("creado_en", `${f.desde}T00:00:00-03:00`);
  if (f.hasta) q = q.lte("creado_en", `${f.hasta}T23:59:59-03:00`);
  if (f.caja) q = q.eq("caja_id", f.caja);
  if (f.instrumental) q = q.eq("instrumental_id", f.instrumental);
  if (f.motivo) q = q.eq("motivo", f.motivo);
  if (f.autor) q = q.eq("autor", f.autor);
  return sinError(await q) as Movimiento[];
}
