import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Cliente con service_role. SOLO servidor: se usa para invitar usuarios. Saltea RLS. */
export function crearClienteAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
