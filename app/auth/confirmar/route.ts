import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/server";
import { destinoSeguro } from "@/lib/rutas";

/**
 * Link del email de invitación si se usa la plantilla personalizada (ver README → "Invite user"):
 *   {{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=invite&next=/auth/nueva-clave
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = destinoSeguro(searchParams.get("next") ?? "/auth/nueva-clave");
  if (token_hash && type) {
    const supabase = await crearClienteServidor();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
