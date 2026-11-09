import { redirect } from "next/navigation";
import { cache } from "react";
import { crearClienteServidor } from "./supabase/server";
import type { Perfil } from "./tipos";

/** Usuario logueado + su perfil. Redirige a /login si no hay sesión. */
export const obtenerPerfil = cache(async (): Promise<Perfil> => {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("perfiles").select("id, nombre, email, rol").eq("id", user.id).single();
  if (!data) redirect("/login?error=perfil");
  return data as Perfil;
});

export async function exigirAdmin(): Promise<Perfil> {
  const perfil = await obtenerPerfil();
  if (perfil.rol !== "admin") redirect("/");
  return perfil;
}
