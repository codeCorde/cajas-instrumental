import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { COOKIE_SESION, leerSesion } from "./sesion";

/** ¿La persona sigue habilitada? (desactivarla en Configuración le corta el acceso). Se consulta una vez por pedido. */
const habilitada = cache(async (nombre: string): Promise<boolean> => {
  const { data } = await db().from("personas").select("activa").eq("nombre", nombre).maybeSingle();
  return !!data?.activa;
});

/**
 * Nombre de la persona de la sesión. Sin sesión → ingresar. Si la persona fue desactivada (o nunca fue
 * habilitada por invitación), también la manda a ingresar: el taller es privado.
 */
export async function quienSoy(): Promise<string> {
  const s = await leerSesion((await cookies()).get(COOKIE_SESION)?.value);
  if (!s) redirect("/ingresar");
  if (!s.nombre) redirect("/ingresar/nombre");
  if (!(await habilitada(s.nombre))) redirect("/ingresar?sin_acceso=1");
  return s.nombre;
}

/** Para páginas públicas (/pedir): nombre de la sesión del equipo si hay una válida, sin redirigir. */
export async function sesionDelEquipo(): Promise<string | null> {
  const s = await leerSesion((await cookies()).get(COOKIE_SESION)?.value);
  if (!s?.nombre) return null;
  return (await habilitada(s.nombre)) ? s.nombre : null;
}
