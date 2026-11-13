import "server-only";
import { db, sinError } from "./db";
import { nombreComponente } from "./calculos";
import type { Catalogo } from "./datos";
import type { EntidadInspeccion, Inspeccion, Pedido } from "./tipos";

/** Opciones de "qué se inspecciona" para el formulario y para mostrar el nombre en los listados. */
export async function opcionesInspeccion(cat: Catalogo) {
  const pedidos = sinError(await db().from("pedidos").select("id, numero, cliente").order("creado_en", { ascending: false }).limit(200)) as Pick<Pedido, "id" | "numero" | "cliente">[];
  const opciones: Record<EntidadInspeccion, { id: string; etiqueta: string; instrumentalId?: string }[]> = {
    instrumental: cat.instrumentales.map((i) => ({ id: i.id, etiqueta: `${i.codigo} · ${i.nombre}` })),
    componente: cat.instrumentales.flatMap((i) => i.componentes.map((c) => ({ id: c.id, etiqueta: `${i.nombre} · ${nombreComponente(c)}`, instrumentalId: i.id }))),
    caja: cat.cajas.map((c) => ({ id: c.id, etiqueta: c.nombre })),
    pedido: pedidos.map((p) => ({ id: p.id, etiqueta: `${p.numero} · ${p.cliente}` })),
  };
  return opciones;
}

export function nombreInspeccionado(x: Inspeccion, opciones: Awaited<ReturnType<typeof opcionesInspeccion>>): string {
  return opciones[x.entidad].find((o) => o.id === x.entidad_id)?.etiqueta ?? "(ya no existe)";
}
