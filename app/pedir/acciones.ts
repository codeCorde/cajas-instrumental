"use server";
// Acciones PÚBLICAS del QR de pedidos (sin contraseña). Solo crean pedidos "por recepcionar" y cancelan con el link secreto.
// No tocan stock. Límite por IP para que nadie llene la base de pedidos falsos.
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db, sinError } from "@/lib/db";
import { COOKIE_SESION, leerSesion } from "@/lib/sesion";
import { notificar, urlApp } from "@/lib/notificar";
import { pedidoPorToken } from "@/lib/pedidos";

const MAX_POR_HORA = 10;
const UUID = /^[0-9a-f-]{36}$/i;

async function ip(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim().slice(0, 60);
}

export type ItemPedido = { instrumental_id: string; caja_id: string | null; cantidad: number };
export type RespuestaPedido = { ok: true; numero: string; token: string } | { ok: false; error: string };

export async function crearPedidoQR(datos: { nombre: string; firma: string | null; items: ItemPedido[] }): Promise<RespuestaPedido> {
  try {
    const nombre = String(datos.nombre ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
    if (!nombre) return { ok: false, error: "Poné tu nombre." };
    const firma = datos.firma ?? "";
    if (!firma.startsWith("data:image/png;base64,")) return { ok: false, error: "Falta tu firma." };
    if (firma.length > 350_000) return { ok: false, error: "La firma es demasiado grande. Borrala y firmá de nuevo." };
    const items = (Array.isArray(datos.items) ? datos.items : [])
      .filter((i) => i && UUID.test(i.instrumental_id) && (i.caja_id === null || UUID.test(String(i.caja_id))) && Number.isInteger(i.cantidad) && i.cantidad > 0 && i.cantidad <= 10000)
      .slice(0, 300);
    if (items.length === 0) return { ok: false, error: "El pedido está vacío." };

    const miIp = await ip();
    const haceUnaHora = new Date(Date.now() - 3_600_000).toISOString();
    const { count } = await db().from("pedidos").select("id", { count: "exact", head: true }).eq("ip", miIp).gte("creado_en", haceUnaHora);
    if ((count ?? 0) >= MAX_POR_HORA) return { ok: false, error: "Se hicieron muchos pedidos desde esta conexión. Probá de nuevo en un rato o avisá al taller." };

    // Si quien carga tiene la sesión del equipo iniciada, queda como pedido cargado a mano.
    const sesion = await leerSesion((await cookies()).get(COOKIE_SESION)?.value);
    const { data, error } = await db().rpc("crear_pedido", {
      p_solicitante: nombre,
      p_items: items,
      p_origen: sesion?.nombre ? "interno" : "qr",
      p_firma: firma,
      p_ip: miIp,
      p_notas: sesion?.nombre ? `Cargado por ${sesion.nombre}` : null,
    });
    if (error) return { ok: false, error: error.message };
    const r = data as { id: string; numero: string; token: string };

    const total = items.reduce((s, i) => s + i.cantidad, 0);
    await notificar(`🆕 Pedido nuevo ${r.numero}`, `${nombre} pidió ${total} ${total === 1 ? "pieza" : "piezas"}. Falta recepcionarlo.`, urlApp(`/produccion/pedido/${r.id}`));
    revalidatePath("/produccion", "layout");
    return { ok: true, numero: r.numero, token: r.token };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo hacer el pedido." };
  }
}

export async function cancelarPorToken(token: string, motivo: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const p = await pedidoPorToken(token);
    if (!p) return { ok: false, error: "No encontramos el pedido." };
    sinError(
      await db().rpc("cancelar_pedido", { p_pedido: p.id, p_autor: `${p.cliente} (solicitante)`, p_motivo: String(motivo ?? "").trim().slice(0, 300) || "Cancelado por el solicitante" }),
    );
    await notificar(`✕ Pedido ${p.numero} cancelado`, `${p.cliente} canceló su pedido desde el link de seguimiento.`, urlApp(`/produccion/pedido/${p.id}`));
    revalidatePath(`/pedir/seguimiento/${token}`);
    revalidatePath("/produccion", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo cancelar." };
  }
}
