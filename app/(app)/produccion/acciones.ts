"use server";
// Producción: recepcionar → (orden de producción) → armar/finalizar → firmar (entregado). Cancelar en cualquier momento antes de entregar.
// Lo que toca stock va por RPC (finalizar_pedido, cancelar_pedido). Recepcionar y firmar no tocan stock.
import { db, sinError } from "@/lib/db";
import { quienSoy } from "@/lib/sesion-servidor";
import { registrarNovedad } from "@/lib/datos";
import { seguro, texto, textoONull } from "@/lib/acciones";
import { notificar, urlApp } from "@/lib/notificar";
import type { ResultadoAccion } from "@/components/FormAccion";

async function numeroDe(id: string): Promise<{ numero: string; cliente: string }> {
  return sinError(await db().from("pedidos").select("numero, cliente").eq("id", id).single());
}

export async function recepcionarPedido(id: string): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const { data, error } = await db()
      .from("pedidos")
      .update({ estado: "en_produccion", recepcionado_en: new Date().toISOString(), recepcionado_por: yo })
      .eq("id", id)
      .eq("estado", "pendiente")
      .select("numero, cliente")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("El pedido ya no está por recepcionar (¿lo recepcionó otra persona?).");
    await registrarNovedad(yo, "pedidos", `Pedido ${data.numero} recepcionado · orden de producción`, `Solicitante: ${data.cliente}`);
    await notificar(`📥 Orden de producción ${data.numero}`, `${yo} recepcionó el pedido de ${data.cliente}.`, urlApp(`/produccion/pedido/${id}`));
    return { mensaje: `Pedido ${data.numero} en producción` };
  });
}

export async function finalizarPedido(id: string): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const { data, error } = await db().rpc("finalizar_pedido", { p_pedido: id, p_autor: yo });
    if (error) throw new Error(error.message);
    const r = data as { ok: boolean; faltantes?: string[] };
    if (!r.ok) throw new Error(`Faltan piezas terminadas: ${(r.faltantes ?? []).join("; ")}`);
    const p = await numeroDe(id);
    await registrarNovedad(yo, "pedidos", `Pedido ${p.numero} finalizado (armado)`, "Se descontaron las piezas terminadas. Falta la firma de quien recibe.");
    await notificar(`📦 Pedido ${p.numero} finalizado`, `Armado por ${yo}. Falta la firma de ${p.cliente} para entregarlo.`, urlApp(`/produccion/pedido/${id}`));
    return { mensaje: "Pedido finalizado: falta la firma" };
  });
}

export async function firmarPedido(id: string, fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const firma = texto(fd, "firma");
    if (firma.length > 350_000) throw new Error("La firma es demasiado grande. Borrala y firmá de nuevo.");
    const { error } = await db().rpc("firmar_pedido", { p_pedido: id, p_autor: yo, p_recibio: texto(fd, "recibio"), p_firma: firma });
    if (error) throw new Error(error.message);
    const p = await numeroDe(id);
    await registrarNovedad(yo, "pedidos", `Pedido ${p.numero} entregado y firmado`, `Recibió: ${texto(fd, "recibio")}`);
    await notificar(`✅ Pedido ${p.numero} entregado`, `Recibió ${texto(fd, "recibio")}. Remito firmado.`, urlApp(`/produccion/pedido/${id}/remito`));
    return { mensaje: "Pedido entregado. Ya podés imprimir el remito." };
  });
}

export async function cancelarPedido(id: string, fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const motivo = textoONull(fd, "motivo");
    const { error } = await db().rpc("cancelar_pedido", { p_pedido: id, p_autor: yo, p_motivo: motivo });
    if (error) throw new Error(error.message);
    const p = await numeroDe(id);
    await registrarNovedad(yo, "pedidos", `Pedido ${p.numero} cancelado`, motivo);
    await notificar(`✕ Pedido ${p.numero} cancelado`, `${yo} canceló el pedido de ${p.cliente}.${motivo ? ` Motivo: ${motivo}` : ""}`, urlApp(`/produccion/pedido/${id}`));
    return { mensaje: "Pedido cancelado" };
  });
}

// ---------------- Stock de partes: etapa y datos de taller ----------------

type Tabla = "instrumentales" | "componentes";
const TABLAS: Tabla[] = ["instrumentales", "componentes"];

export async function guardarEtapa(tabla: Tabla, id: string, etapa: string): Promise<ResultadoAccion> {
  return seguro(async () => {
    await quienSoy();
    if (!TABLAS.includes(tabla)) throw new Error("Destino no válido");
    sinError(await db().from(tabla).update({ etapa: etapa.trim().slice(0, 60) || null }).eq("id", id));
  });
}

export async function guardarDatosTaller(tabla: Tabla, id: string, fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    if (!TABLAS.includes(tabla)) throw new Error("Destino no válido");
    const r = sinError(
      await db()
        .from(tabla)
        .update({ maquina: textoONull(fd, "maquina"), herramientas: textoONull(fd, "herramientas") })
        .eq("id", id)
        .select("*")
        .single(),
    ) as { nombre?: string; codigo_o_medida?: string };
    await registrarNovedad(yo, "instrumental", `Datos de taller: ${r.nombre ?? r.codigo_o_medida ?? ""}`, "Máquina y herramientas (mechas / machos).");
  });
}

export async function guardarEtapas(fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const etapas = texto(fd, "etapas")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 30);
    if (etapas.length < 2) throw new Error("Poné al menos 2 etapas, una por renglón.");
    sinError(await db().from("config").upsert({ clave: "etapas", valor: etapas }));
    await registrarNovedad(yo, "config", "Etapas de producción actualizadas", etapas.join(" → "));
  });
}

export async function probarAvisos(): Promise<ResultadoAccion> {
  return seguro(async () => {
    await quienSoy();
    const { hayCanales } = await import("@/lib/notificar");
    if (!hayCanales()) throw new Error("No hay ningún canal configurado (Telegram, WhatsApp o ntfy). Mirá el README.");
    const { armarResumenDiario } = await import("@/lib/resumen");
    const { titulo, texto: cuerpo } = await armarResumenDiario();
    const errores = await notificar(titulo, cuerpo, urlApp("/produccion"));
    if (errores.length) throw new Error(`Algunos avisos fallaron: ${errores.join(" · ")}`);
  });
}
