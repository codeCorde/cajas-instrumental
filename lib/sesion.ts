// Sesión: cookie httpOnly firmada (JWT HS256 con jose), 30 días. Se usa también en middleware (edge).
import { SignJWT, jwtVerify } from "jose";

export const COOKIE_SESION = "sesion";
export const DURACION_SEG = 60 * 60 * 24 * 30;

export interface DatosSesion {
  nombre: string | null; // null = puso la contraseña pero todavía no eligió su nombre
}

function secreto(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("Falta SESSION_SECRET (al menos 32 caracteres)");
  return new TextEncoder().encode(s);
}

export async function firmarSesion(datos: DatosSesion): Promise<string> {
  return new SignJWT({ n: datos.nombre })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SEG}s`)
    .sign(secreto());
}

export async function leerSesion(token: string | undefined): Promise<DatosSesion | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secreto(), { algorithms: ["HS256"] });
    return { nombre: typeof payload.n === "string" && payload.n.trim() ? payload.n : null };
  } catch {
    return null;
  }
}

export const opcionesCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: DURACION_SEG,
};

/** Solo rutas internas para volver después de ingresar (evita redirecciones a otros sitios). */
export function rutaSegura(volver: string | null | undefined): string {
  if (!volver || !volver.startsWith("/") || volver.startsWith("//") || volver.startsWith("/\\")) return "/";
  if (volver.startsWith("/ingresar")) return "/";
  return volver;
}
