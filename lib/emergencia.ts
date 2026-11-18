import "server-only";
import { db, sinError } from "./db";
import { notificar, urlApp } from "./notificar";
import type { OrdenReposicion } from "./tipos";

interface ResultadoRevision {
  creadas: { numero: string; caja: string; cantidad: number }[];
  cumplidas: { numero: string; caja: string }[];
}

/**
 * Revisa el stock de emergencia (taller.revisar_stock_emergencia): crea órdenes de reposición por las cajas que
 * faltan para el mínimo y cierra las que ya se cumplieron. Avisa por Telegram. Nunca tira: se llama después de
 * cualquier cambio de cajas armadas y en el resumen diario, y un error acá no puede romper esa acción.
 */
export async function revisarStockEmergencia(autor: string): Promise<ResultadoRevision | null> {
  try {
    const { data, error } = await db().rpc("revisar_stock_emergencia", { p_autor: autor });
    if (error) throw new Error(error.message);
    const r = data as ResultadoRevision;
    if (r.creadas.length) {
      await notificar(
        "🛟 Orden de reposición · stock de emergencia",
        r.creadas.map((c) => `${c.numero}: fabricar ${c.cantidad} ${c.cantidad === 1 ? "caja" : "cajas"} de ${c.caja} para volver al mínimo.`).join("\n"),
        urlApp("/produccion"),
      );
    }
    if (r.cumplidas.length) {
      await notificar("✓ Stock de emergencia cubierto", r.cumplidas.map((c) => `${c.numero} cumplida: ${c.caja} volvió al mínimo.`).join("\n"), urlApp("/produccion"));
    }
    return r;
  } catch (e) {
    console.error("Stock de emergencia:", e);
    return null;
  }
}

export async function ordenesReposicionAbiertas(): Promise<OrdenReposicion[]> {
  return sinError(await db().from("ordenes_reposicion").select("*").eq("estado", "abierta").order("creado_en")) as OrdenReposicion[];
}
