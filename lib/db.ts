import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente de Supabase con la service_role, apuntando al esquema "taller". SOLO servidor.
// La base no tiene acceso público: todo lo que lee o escribe la app pasa por acá.
let cliente: SupabaseClient<any, "taller", any> | null = null;

export function db() {
  if (!cliente) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !clave) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    cliente = createClient(url, clave, { db: { schema: "taller" }, auth: { persistSession: false, autoRefreshToken: false } });
  }
  return cliente;
}

/** Bucket privado donde viven todos los archivos técnicos. */
export const BUCKET = "planos";

/** Tira el error de Supabase con un mensaje legible. */
export function sinError<T>(r: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<T>;
}
