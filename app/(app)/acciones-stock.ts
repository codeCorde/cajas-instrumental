"use server";
// Cambios de stock: todos por RPC (transaccionales, registran el movimiento con el nombre de la sesión).
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { quienSoy } from "@/lib/sesion-servidor";

export type ObjetivoStock = "stock_terminado" | "unidades_armadas" | "stock" | "cajas_armadas";
export type Respuesta<T = undefined> = { ok: true; valor: T } | { ok: false, error: string; faltantes?: string[] };

const OBJETIVOS: ObjetivoStock[] = ["stock_terminado", "unidades_armadas", "stock", "cajas_armadas"];

export async function ajustarStock(
  objetivo: ObjetivoStock,
  id: string,
  delta: number,
  opciones: { cajaId?: string | null; motivo?: "carga" | "correccion"; nota?: string | null } = {},
): Promise<Respuesta<number>> {
  const autor = await quienSoy();
  if (!OBJETIVOS.includes(objetivo) || !Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100000) {
    return { ok: false, error: "Cantidad no válida" };
  }
  const { data, error } = await db().rpc("ajustar_stock", {
    p_objetivo: objetivo,
    p_id: id,
    p_delta: delta,
    p_autor: autor,
    p_motivo: opciones.motivo ?? "carga",
    p_nota: opciones.nota ?? null,
    p_caja_id: opciones.cajaId ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, valor: data as number };
}

export async function armarInstrumental(id: string): Promise<Respuesta<number>> {
  const autor = await quienSoy();
  const { data, error } = await db().rpc("armar_instrumental", { p_instrumental: id, p_autor: autor });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, valor: data as number };
}

export async function armarCaja(cajaId: string): Promise<Respuesta<number>> {
  const autor = await quienSoy();
  const { data, error } = await db().rpc("armar_caja", { p_caja: cajaId, p_autor: autor });
  if (error) return { ok: false, error: error.message };
  const r = data as { ok: boolean; cajas_armadas?: number; faltantes?: string[] };
  if (!r.ok) return { ok: false, error: "No se puede armar: falta instrumental", faltantes: r.faltantes ?? [] };
  revalidatePath("/", "layout");
  return { ok: true, valor: r.cajas_armadas ?? 0 };
}

export async function desarmarCaja(cajaId: string): Promise<Respuesta<number>> {
  const autor = await quienSoy();
  const { data, error } = await db().rpc("desarmar_caja", { p_caja: cajaId, p_autor: autor });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, valor: data as number };
}
