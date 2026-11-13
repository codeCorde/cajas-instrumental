import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_SESION, leerSesion } from "./sesion";

/** Nombre de la persona de la sesión. Si no hay sesión, manda a ingresar (el middleware ya lo hace; esto es por las dudas). */
export async function quienSoy(): Promise<string> {
  const s = await leerSesion((await cookies()).get(COOKIE_SESION)?.value);
  if (!s) redirect("/ingresar");
  if (!s.nombre) redirect("/ingresar/nombre");
  return s.nombre;
}
