// Abre o descarga un plano: valida la sesión (RLS) y redirige a un link firmado que vence en 10 minutos.
//   /planos/archivo/<id>            → lo muestra en el navegador (PDF / imagen)
//   /planos/archivo/<id>?descargar  → lo descarga con su nombre original
import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { BUCKET_PLANOS } from "@/lib/planos";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await crearClienteServidor();
  const { data: plano } = await supabase.from("planos").select("ruta, nombre, formato").eq("id", id).maybeSingle();
  if (!plano) return new NextResponse("Plano no encontrado", { status: 404 });

  const descargar = new URL(req.url).searchParams.has("descargar");
  const { data, error } = await supabase.storage
    .from(BUCKET_PLANOS)
    .createSignedUrl(plano.ruta, 600, descargar ? { download: `${plano.nombre}.${plano.formato}` } : undefined);
  if (error || !data) return new NextResponse("No se pudo abrir el plano", { status: 500 });

  const res = NextResponse.redirect(data.signedUrl, 302);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
