"use server";
// Server Actions de Tareas de mejora y notas manuales de Novedades.
// Usan la sesión del usuario: RLS valida que sea admin (exigirAdmin corta antes con un mensaje claro).
// Quién y cuándo se marcó una tarea lo completa la base (trigger), no la app.

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Resultado } from "@/components/FormAccion";

const txt = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};
const PRIORIDADES = ["alta", "media", "baja"];

function refrescar() {
  revalidatePath("/tareas");
  revalidatePath("/novedades");
  revalidatePath("/");
}

/** Lee los campos del formulario. Si se eligió un instrumental, la caja sale de él (no pueden contradecirse). */
async function leerTarea(fd: FormData, supabase: Awaited<ReturnType<typeof crearClienteServidor>>) {
  const instrumental_id = txt(fd, "instrumental_id");
  let caja_id = txt(fd, "caja_id");
  if (instrumental_id) {
    const { data } = await supabase.from("instrumentales").select("caja_id").eq("id", instrumental_id).maybeSingle();
    caja_id = (data?.caja_id as string | undefined) ?? caja_id;
  }
  const prioridad = txt(fd, "prioridad") ?? "media";
  return {
    titulo: txt(fd, "titulo"),
    detalle: txt(fd, "detalle"),
    medico: txt(fd, "medico"),
    caja_id,
    instrumental_id,
    prioridad: PRIORIDADES.includes(prioridad) ? prioridad : "media",
  };
}

export async function crearTarea(fd: FormData): Promise<Resultado> {
  await exigirAdmin();
  const supabase = await crearClienteServidor();
  const datos = await leerTarea(fd, supabase);
  if (!datos.titulo) return { error: "Escribí qué hay que mejorar." };
  const { error } = await supabase.from("tareas").insert(datos);
  if (error) return { error: error.message };
  refrescar();
  return { ok: "Tarea agregada." };
}

export async function editarTarea(fd: FormData): Promise<Resultado> {
  await exigirAdmin();
  const supabase = await crearClienteServidor();
  const datos = await leerTarea(fd, supabase);
  if (!datos.titulo) return { error: "El título no puede quedar vacío." };
  const { error } = await supabase.from("tareas").update(datos).eq("id", txt(fd, "id")!);
  if (error) return { error: error.message };
  refrescar();
  return { ok: "Guardado." };
}

/** Marca o desmarca "corregido". */
export async function marcarTarea(fd: FormData): Promise<Resultado> {
  await exigirAdmin();
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("tareas")
    .update({ hecha: fd.get("hecha") === "1" })
    .eq("id", txt(fd, "id")!);
  if (error) return { error: error.message };
  refrescar();
  return {};
}

export async function borrarTarea(fd: FormData): Promise<Resultado> {
  await exigirAdmin();
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("tareas").delete().eq("id", txt(fd, "id")!);
  if (error) return { error: error.message };
  refrescar();
  return {};
}

/** Nota escrita a mano en Novedades (reunión, decisión, aviso). No se puede editar ni borrar. */
export async function agregarNovedad(fd: FormData): Promise<Resultado> {
  await exigirAdmin();
  const titulo = txt(fd, "titulo");
  if (!titulo) return { error: "Escribí un título." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("novedades").insert({ titulo, detalle: txt(fd, "detalle"), seccion: "general" });
  if (error) return { error: error.message };
  refrescar();
  return { ok: "Nota agregada." };
}
