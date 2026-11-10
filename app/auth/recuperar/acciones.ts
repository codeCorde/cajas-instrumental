"use server";
// Pide a Supabase que mande el mail para cambiar la contraseña.
// La respuesta es siempre la misma, exista o no el email: así nadie puede averiguar qué usuarios hay.
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export interface EstadoRecuperar {
  enviado?: boolean;
  error?: string;
}

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function pedirCambioDeClave(_prev: EstadoRecuperar | null, fd: FormData): Promise<EstadoRecuperar> {
  const email = String(fd.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!EMAIL_VALIDO.test(email)) return { error: "Escribí un email válido." };

  let base = process.env.NEXT_PUBLIC_SITE_URL;
  if (!base) {
    const h = await headers();
    base = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  }
  // Flujo "implicit": el link del mail vuelve a /auth/nueva-clave con la sesión en el #hash (igual que las
  // invitaciones), así funciona aunque se abra en otro dispositivo (pedido en la PC, abierto en el celular).
  // Con PKCE (el cliente de servidor por defecto) solo andaría en el mismo navegador que lo pidió.
  const redirectTo = `${base.replace(/\/$/, "")}/auth/nueva-clave`;

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  // Límite de envíos de Supabase: es el único error que vale la pena mostrar.
  if (error && (error.status === 429 || /rate limit/i.test(error.message))) {
    return { error: "Se pidieron demasiados mails seguidos. Esperá un rato y probá de nuevo." };
  }
  return { enviado: true };
}
