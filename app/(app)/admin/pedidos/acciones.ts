"use server";
import { db, sinError } from "@/lib/db";
import { quienSoy } from "@/lib/sesion-servidor";
import { registrarNovedad } from "@/lib/datos";
import { obligatorio, seguro, texto, textoONull } from "@/lib/acciones";
import { ESTADO_PEDIDO_LABEL, type EstadoPedido } from "@/lib/tipos";
import type { ResultadoAccion } from "@/components/FormAccion";

/** Ítems del formulario: caja_0 / cant_0, caja_1 / cant_1… (se suman las cajas repetidas). */
function leerItems(fd: FormData): { caja_id: string; cantidad: number }[] {
  const items = new Map<string, number>();
  for (const [k, v] of fd.entries()) {
    const m = k.match(/^caja_(\d+)$/);
    if (!m || !v) continue;
    const cant = Number(fd.get(`cant_${m[1]}`));
    if (!Number.isInteger(cant) || cant < 1) throw new Error("Cada ítem necesita una cantidad entera ≥ 1.");
    items.set(String(v), (items.get(String(v)) ?? 0) + cant);
  }
  if (items.size === 0) throw new Error("Agregá al menos una caja al pedido.");
  return [...items].map(([caja_id, cantidad]) => ({ caja_id, cantidad }));
}

function datosPedido(fd: FormData) {
  return {
    numero: obligatorio(fd, "numero", "el número de pedido"),
    cliente: obligatorio(fd, "cliente", "el cliente"),
    fecha_pedido: texto(fd, "fecha_pedido") || new Date().toISOString().slice(0, 10),
    fecha_compromiso: textoONull(fd, "fecha_compromiso"),
    notas: textoONull(fd, "notas"),
  };
}

export async function crearPedido(fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const items = leerItems(fd);
    const p = sinError(await db().from("pedidos").insert(datosPedido(fd)).select("id, numero, cliente").single());
    const r = await db().from("pedido_items").insert(items.map((i) => ({ ...i, pedido_id: p.id })));
    if (r.error) {
      await db().from("pedidos").delete().eq("id", p.id);
      throw new Error(r.error.message);
    }
    await registrarNovedad(yo, "pedidos", `Nuevo pedido ${p.numero} · ${p.cliente}`);
    return { ir: `/admin/pedidos/${p.id}` };
  });
}

export async function editarPedido(id: string, fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    await quienSoy();
    const items = leerItems(fd);
    sinError(await db().from("pedidos").update(datosPedido(fd)).eq("id", id));
    sinError(await db().from("pedido_items").delete().eq("pedido_id", id));
    sinError(await db().from("pedido_items").insert(items.map((i) => ({ ...i, pedido_id: id }))));
  });
}

export async function cambiarEstadoPedido(id: string, estado: EstadoPedido): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    if (!["pendiente", "en_produccion", "listo", "cancelado"].includes(estado)) throw new Error("Para entregar usá el botón «Entregar».");
    const p = sinError(await db().from("pedidos").update({ estado }).eq("id", id).select("numero").single());
    await registrarNovedad(yo, "pedidos", `Pedido ${p.numero}: ${ESTADO_PEDIDO_LABEL[estado]}`);
  });
}

export async function entregarPedido(id: string, fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const descontar = fd.get("descontar") === "on";
    const { data, error } = await db().rpc("entregar_pedido", { p_pedido: id, p_autor: yo, p_descontar: descontar });
    if (error) throw new Error(error.message);
    const r = data as { ok: boolean; faltantes?: string[] };
    if (!r.ok) throw new Error(`No hay suficientes cajas armadas: ${(r.faltantes ?? []).join("; ")}. Destildá «descontar» o armá las cajas.`);
    const p = sinError(await db().from("pedidos").select("numero").eq("id", id).single());
    await registrarNovedad(yo, "pedidos", `Pedido ${p.numero} entregado`, descontar ? "Se descontaron las cajas armadas." : null);
    return { mensaje: "Pedido entregado" };
  });
}

export async function borrarPedido(id: string): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const p = sinError(await db().from("pedidos").delete().eq("id", id).select("numero").single());
    await registrarNovedad(yo, "pedidos", `Pedido ${p.numero} borrado`);
    return { ir: "/admin/pedidos" };
  });
}
