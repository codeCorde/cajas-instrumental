import "server-only";
import { db, sinError } from "./db";
import { cajasFaltantesParaPedidos, nombreComponente, queFabricar } from "./calculos";
import { composicionDe, type Catalogo } from "./datos";
import type { Pedido } from "./tipos";

export interface FilaFabricarVista {
  instId: string;
  codigo: string;
  instrumental: string;
  componente: string | null;
  cantidad: number;
  origen: string;
  nota: string | null;
}

/** Filas de "Qué fabricar" listas para mostrar / exportar. */
export function filasFabricar(cat: Catalogo, cajas: Record<string, number>): FilaFabricarVista[] {
  const necesidades = Object.entries(cajas).map(([cajaId, n]) => ({ composicion: composicionDe(cat, cajaId), cajas: n }));
  return queFabricar(necesidades).map((f) => ({
    instId: f.inst.id,
    codigo: cat.porId.get(f.inst.id)!.codigo,
    instrumental: f.inst.nombre,
    componente: f.componente ? nombreComponente(f.componente) : null,
    cantidad: f.cantidad,
    origen: (() => {
      const i = cat.porId.get(f.inst.id)!;
      return i.origen === "tercerizado" ? `Tercerizado${i.proveedor ? ` · ${i.proveedor}` : ""}` : "Fabricación propia";
    })(),
    nota: f.nota,
  }));
}

export const ESTADOS_ABIERTOS = ["pendiente", "en_produccion", "listo"] as const;

export async function pedidosAbiertos(): Promise<Pedido[]> {
  return sinError(
    await db().from("pedidos").select("*, items:pedido_items(*)").in("estado", ESTADOS_ABIERTOS as unknown as string[]).order("fecha_compromiso", { ascending: true, nullsFirst: false }),
  ) as Pedido[];
}

/** Cajas que faltan armar para cubrir los pedidos (lo pedido menos lo ya armado). */
export function cajasParaPedidos(cat: Catalogo, pedidos: Pedido[]): Record<string, number> {
  return cajasFaltantesParaPedidos(
    pedidos.flatMap((p) => p.items),
    Object.fromEntries(cat.cajas.map((c) => [c.id, c.cajas_armadas])),
  );
}
