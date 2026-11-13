"use server";
import { db, sinError } from "@/lib/db";
import { quienSoy } from "@/lib/sesion-servidor";
import { registrarNovedad } from "@/lib/datos";
import { obligatorio, seguro, texto, textoONull } from "@/lib/acciones";
import { RESULTADO_LABEL, type EntidadInspeccion, type ItemChecklist, type MedidaControlada, type Resultado } from "@/lib/tipos";
import type { ResultadoAccion } from "@/components/FormAccion";

/** Para filtrar: a qué instrumental / caja / pedido corresponde lo inspeccionado. */
async function vinculos(entidad: EntidadInspeccion, id: string) {
  if (entidad === "instrumental") return { instrumental_id: id, caja_id: null, pedido_id: null };
  if (entidad === "componente") {
    const c = sinError(await db().from("componentes").select("instrumental_id").eq("id", id).single());
    return { instrumental_id: c.instrumental_id, caja_id: null, pedido_id: null };
  }
  if (entidad === "caja") return { instrumental_id: null, caja_id: id, pedido_id: null };
  return { instrumental_id: null, caja_id: null, pedido_id: id };
}

export async function crearInspeccion(fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const entidad = texto(fd, "entidad") as EntidadInspeccion;
    if (!["instrumental", "componente", "caja", "pedido"].includes(entidad)) throw new Error("Elegí qué se inspecciona.");
    const entidadId = obligatorio(fd, "entidad_id", "qué se inspecciona");
    const resultado = texto(fd, "resultado") as Resultado;
    if (!(resultado in RESULTADO_LABEL)) throw new Error("Elegí el resultado.");
    const checklist = JSON.parse(texto(fd, "checklist") || "[]") as ItemChecklist[];
    const medidas = (JSON.parse(texto(fd, "medidas") || "[]") as MedidaControlada[]).filter((m) => m.cota.trim());
    const cant = texto(fd, "cantidad");
    const v = await vinculos(entidad, entidadId);
    const pedidoExtra = texto(fd, "pedido_id");
    const fila = sinError(
      await db()
        .from("inspecciones")
        .insert({
          fecha: texto(fd, "fecha") || undefined,
          inspector: yo,
          entidad,
          entidad_id: entidadId,
          ...v,
          pedido_id: v.pedido_id ?? (pedidoExtra || null),
          cantidad: cant ? Number(cant) : null,
          lote: textoONull(fd, "lote"),
          resultado,
          motivo: textoONull(fd, "motivo"),
          checklist,
          medidas,
          observaciones: textoONull(fd, "observaciones"),
          accion_correctiva: textoONull(fd, "accion_correctiva"),
        })
        .select("id")
        .single(),
    );
    await registrarNovedad(yo, "calidad", `Inspección: ${RESULTADO_LABEL[resultado]}`, textoONull(fd, "descripcion_entidad"));
    return { ir: `/admin/calidad/${fila.id}` };
  });
}

export async function cerrarAccion(id: string, cerrada: boolean): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    sinError(await db().from("inspecciones").update({ accion_cerrada: cerrada, cerrada_en: cerrada ? new Date().toISOString() : null, cerrada_por: cerrada ? yo : null }).eq("id", id));
  });
}

export async function editarSeguimiento(id: string, fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    await quienSoy();
    sinError(await db().from("inspecciones").update({ observaciones: textoONull(fd, "observaciones"), accion_correctiva: textoONull(fd, "accion_correctiva") }).eq("id", id));
  });
}

export async function borrarInspeccion(id: string): Promise<ResultadoAccion> {
  return seguro(async () => {
    await quienSoy();
    sinError(await db().from("inspecciones").delete().eq("id", id));
    return { ir: "/admin/calidad" };
  });
}
