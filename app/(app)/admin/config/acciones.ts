"use server";
import { BUCKET, db, sinError } from "@/lib/db";
import { quienSoy } from "@/lib/sesion-servidor";
import { leerApariencia, registrarNovedad } from "@/lib/datos";
import { obligatorio, seguro, texto } from "@/lib/acciones";
import { extension, IMAGENES } from "@/lib/formato";
import type { ResultadoAccion } from "@/components/FormAccion";

const lineas = (t: string) =>
  t
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

export async function guardarApariencia(fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const actual = await leerApariencia();
    const color = texto(fd, "color");
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error("El color tiene que ser como #1d4f7c.");
    const modo = texto(fd, "modo");
    const valor = { ...actual, empresa: obligatorio(fd, "empresa", "el nombre de la empresa"), color, modo: ["claro", "oscuro", "auto"].includes(modo) ? modo : "auto" };
    sinError(await db().from("config").upsert({ clave: "apariencia", valor }));
    await registrarNovedad(yo, "config", "Cambio de apariencia");
  });
}

export async function prepararLogo(nombre: string, tamano: number): Promise<{ ok: true; ruta: string; token: string } | { ok: false; error: string }> {
  await quienSoy();
  const ext = extension(nombre);
  if (!IMAGENES.includes(ext) && ext !== "svg") return { ok: false, error: "El logo tiene que ser una imagen (PNG, JPG, SVG o WEBP)." };
  if (tamano > 2 * 1024 * 1024) return { ok: false, error: "El logo pesa más de 2 MB." };
  const ruta = `taller/config/logo-${Date.now()}.${ext}`;
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(ruta);
  if (error || !data) return { ok: false, error: error?.message ?? "No se pudo preparar la subida" };
  return { ok: true, ruta, token: data.token };
}

export async function guardarLogo(ruta: string | null): Promise<ResultadoAccion> {
  return seguro(async () => {
    await quienSoy();
    if (ruta && !ruta.startsWith("taller/config/logo-")) throw new Error("Ruta no válida");
    const actual = await leerApariencia();
    if (actual.logo_path && actual.logo_path !== ruta) await db().storage.from(BUCKET).remove([actual.logo_path]);
    sinError(await db().from("config").upsert({ clave: "apariencia", valor: { ...actual, logo_path: ruta } }));
  });
}

export async function guardarMotivos(fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    await quienSoy();
    sinError(await db().from("config").upsert({ clave: "calidad", valor: { motivos: lineas(texto(fd, "motivos")) } }));
  });
}

export async function guardarPlantilla(id: string | null, fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    await quienSoy();
    const fila = { nombre: obligatorio(fd, "nombre", "el nombre"), instrumental_id: texto(fd, "instrumental_id") || null, items: lineas(texto(fd, "items")) };
    if (fila.items.length === 0) throw new Error("Escribí al menos un punto a controlar (uno por línea).");
    if (id) sinError(await db().from("plantillas_calidad").update(fila).eq("id", id));
    else sinError(await db().from("plantillas_calidad").insert(fila));
  });
}

export async function borrarPlantilla(id: string): Promise<ResultadoAccion> {
  return seguro(async () => {
    await quienSoy();
    sinError(await db().from("plantillas_calidad").delete().eq("id", id));
  });
}

export async function agregarPersona(fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    await quienSoy();
    sinError(await db().from("personas").insert({ nombre: obligatorio(fd, "nombre", "el nombre").replace(/\s+/g, " ").slice(0, 40) }));
  });
}

export async function renombrarPersona(id: string, fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    await quienSoy();
    sinError(await db().from("personas").update({ nombre: obligatorio(fd, "nombre", "el nombre").replace(/\s+/g, " ").slice(0, 40) }).eq("id", id));
  });
}

export async function activarPersona(id: string, activa: boolean): Promise<ResultadoAccion> {
  return seguro(async () => {
    await quienSoy();
    sinError(await db().from("personas").update({ activa }).eq("id", id));
  });
}
