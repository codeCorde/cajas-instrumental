"use server";
import { revalidatePath } from "next/cache";
import { db, sinError } from "@/lib/db";
import { quienSoy } from "@/lib/sesion-servidor";
import { registrarNovedad } from "@/lib/datos";
import { obligatorio, seguro, texto, textoONull } from "@/lib/acciones";
import type { Mensaje, Prioridad } from "@/lib/tipos";
import type { ResultadoAccion } from "@/components/FormAccion";

// ---------------- tareas ----------------
const prioridad = (p: string): Prioridad => (p === "alta" || p === "baja" ? p : "media");

export async function crearTarea(fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const titulo = obligatorio(fd, "titulo", "el título");
    sinError(
      await db()
        .from("tareas")
        .insert({
          titulo,
          detalle: textoONull(fd, "detalle"),
          medico: textoONull(fd, "medico"),
          caja_id: texto(fd, "caja_id") || null,
          instrumental_id: texto(fd, "instrumental_id") || null,
          prioridad: prioridad(texto(fd, "prioridad")),
          creado_por: yo,
        }),
    );
    await registrarNovedad(yo, "tareas", `Nueva tarea: ${titulo}`);
  });
}

export async function marcarTarea(id: string, hecha: boolean): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const t = sinError(
      await db()
        .from("tareas")
        .update({ hecha, hecha_en: hecha ? new Date().toISOString() : null, hecha_por: hecha ? yo : null })
        .eq("id", id)
        .select("titulo")
        .single(),
    );
    await registrarNovedad(yo, "tareas", `${hecha ? "✓ Corregido" : "Reabierta"}: ${t.titulo}`);
  });
}

export async function borrarTarea(id: string): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const t = sinError(await db().from("tareas").delete().eq("id", id).select("titulo").single());
    await registrarNovedad(yo, "tareas", `Tarea borrada: ${t.titulo}`);
  });
}

// ---------------- novedades ----------------
export async function agregarNovedad(fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    sinError(await db().from("novedades").insert({ autor: yo, origen: "manual", seccion: "general", titulo: obligatorio(fd, "titulo", "el título"), detalle: textoONull(fd, "detalle") }));
  });
}

// ---------------- chat ----------------
export async function mensajesDesde(despuesDe: number): Promise<Mensaje[]> {
  await quienSoy();
  const r = await db().from("mensajes").select("*").gt("id", despuesDe).order("id").limit(200);
  return sinError(r) as Mensaje[];
}

export async function enviarMensaje(textoMsg: string): Promise<{ ok: boolean; error?: string }> {
  const yo = await quienSoy();
  const t = textoMsg.trim();
  if (!t) return { ok: false, error: "El mensaje está vacío" };
  if (t.length > 2000) return { ok: false, error: "Máximo 2000 caracteres" };
  const { error } = await db().from("mensajes").insert({ autor: yo, texto: t });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function borrarMensaje(id: number): Promise<{ ok: boolean }> {
  const yo = await quienSoy();
  await db().from("mensajes").delete().eq("id", id).eq("autor", yo);
  revalidatePath("/chat");
  return { ok: true };
}
