"use server";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { COOKIE_SESION, firmarSesion, leerSesion, opcionesCookie, rutaSegura } from "@/lib/sesion";

const MAX_INTENTOS = 5; // fallidos, por minuto y por IP

/** El hash bcrypt se guarda en base64 (los "$" del hash se rompen al leer .env). También acepta el hash tal cual. */
function hashDeLaApp(): string | null {
  const v = process.env.APP_PASSWORD_HASH?.trim();
  if (!v) return null;
  return v.startsWith("$2") ? v : Buffer.from(v, "base64").toString("utf8");
}

async function ipDelPedido(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}

export async function ingresar(_prev: { error?: string } | null, fd: FormData): Promise<{ error?: string }> {
  const clave = String(fd.get("clave") ?? "");
  const volver = rutaSegura(String(fd.get("volver") ?? ""));
  const hash = hashDeLaApp();
  if (!hash) return { error: "Falta configurar la contraseña de la app (APP_PASSWORD_HASH). Mirá el README." };

  const ip = await ipDelPedido();
  const haceUnMinuto = new Date(Date.now() - 60_000).toISOString();
  const { count } = await db().from("intentos_login").select("id", { count: "exact", head: true }).eq("ip", ip).gte("creado_en", haceUnMinuto);
  if ((count ?? 0) >= MAX_INTENTOS) return { error: "Demasiados intentos. Esperá un minuto y probá de nuevo." };

  if (!clave || !(await bcrypt.compare(clave, hash))) {
    await db().from("intentos_login").insert({ ip });
    await db().from("intentos_login").delete().lt("creado_en", new Date(Date.now() - 86_400_000).toISOString());
    return { error: "Contraseña incorrecta." };
  }

  (await cookies()).set(COOKIE_SESION, await firmarSesion({ nombre: null }), opcionesCookie);
  redirect(`/ingresar/nombre?volver=${encodeURIComponent(volver)}`);
}

export async function elegirNombre(fd: FormData) {
  const jar = await cookies();
  if (!(await leerSesion(jar.get(COOKIE_SESION)?.value))) redirect("/ingresar");
  const volver = rutaSegura(String(fd.get("volver") ?? ""));
  const nuevo = String(fd.get("nuevo") ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
  let nombre = String(fd.get("nombre") ?? "").trim();

  if (nuevo) {
    const { data: existe } = await db().from("personas").select("id, nombre, activa").ilike("nombre", nuevo).maybeSingle();
    if (existe) {
      nombre = existe.nombre;
      if (!existe.activa) await db().from("personas").update({ activa: true }).eq("id", existe.id);
    } else {
      const { error } = await db().from("personas").insert({ nombre: nuevo });
      if (error) throw new Error(error.message);
      nombre = nuevo;
    }
  }
  if (!nombre) redirect(`/ingresar/nombre?volver=${encodeURIComponent(volver)}&error=1`);

  jar.set(COOKIE_SESION, await firmarSesion({ nombre }), opcionesCookie);
  redirect(volver);
}
