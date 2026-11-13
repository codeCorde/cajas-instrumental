"use server";
// Subida de archivos: el navegador sube DIRECTO a Storage con un link firmado (Vercel limita a 4,5 MB lo que pasa por el servidor).
import { BUCKET, db, sinError } from "@/lib/db";
import { quienSoy } from "@/lib/sesion-servidor";
import { registrarNovedad } from "@/lib/datos";
import { seguro } from "@/lib/acciones";
import { EXTENSIONES_OK, TAMANO_MAX, extension, slug } from "@/lib/formato";
import type { EntidadArchivo } from "@/lib/tipos";
import type { ResultadoAccion } from "@/components/FormAccion";

const ENTIDADES: EntidadArchivo[] = ["instrumental", "componente", "caja", "calidad", "sin_clasificar"];

export async function prepararSubida(
  entidad: EntidadArchivo,
  entidadId: string,
  nombre: string,
  tamano: number,
): Promise<{ ok: true; ruta: string; token: string } | { ok: false; error: string }> {
  await quienSoy();
  if (!ENTIDADES.includes(entidad)) return { ok: false, error: "Destino no válido" };
  const ext = extension(nombre);
  if (!EXTENSIONES_OK.includes(ext)) return { ok: false, error: `"${nombre}": tipo no permitido (PDF, DWG, STP/STEP o imagen).` };
  if (tamano > TAMANO_MAX) return { ok: false, error: `"${nombre}" pesa más de 50 MB.` };
  const ruta = `taller/${entidad}/${entidadId}/${Date.now()}-${slug(nombre)}`;
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(ruta);
  if (error || !data) return { ok: false, error: error?.message ?? "No se pudo preparar la subida" };
  return { ok: true, ruta, token: data.token };
}

/** Registra el archivo subido. Si ya había uno vigente con el mismo nombre, queda como versión anterior. */
export async function confirmarSubida(entidad: EntidadArchivo, entidadId: string, nombreArchivo: string, tamano: number, ruta: string): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    if (!ruta.startsWith(`taller/${entidad}/${entidadId}/`)) throw new Error("Ruta no válida");
    const tipo = extension(nombreArchivo);
    const nombre = nombreArchivo.replace(/\.[^.]+$/, "");
    await db().from("archivos").update({ vigente: false }).eq("entidad", entidad).eq("entidad_id", entidadId).eq("nombre", nombre).eq("tipo", tipo);
    sinError(await db().from("archivos").insert({ entidad, entidad_id: entidadId, nombre, tipo, tamano, storage_path: ruta, subido_por: yo, vigente: true }));
    await registrarNovedad(yo, "archivos", `Archivo subido: ${nombreArchivo}`);
  });
}

export async function marcarVigente(id: string, vigente: boolean): Promise<ResultadoAccion> {
  return seguro(async () => {
    await quienSoy();
    sinError(await db().from("archivos").update({ vigente }).eq("id", id));
  });
}

export async function renombrarArchivo(id: string, fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    await quienSoy();
    const nombre = String(fd.get("nombre") ?? "").trim();
    if (!nombre) throw new Error("Falta el nombre.");
    sinError(await db().from("archivos").update({ nombre }).eq("id", id));
  });
}

export async function borrarArchivo(id: string): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const a = sinError(await db().from("archivos").select("storage_path, nombre, tipo").eq("id", id).single());
    await db().storage.from(BUCKET).remove([a.storage_path]);
    sinError(await db().from("archivos").delete().eq("id", id));
    await registrarNovedad(yo, "archivos", `Archivo borrado: ${a.nombre}.${a.tipo}`);
  });
}
