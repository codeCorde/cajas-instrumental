// Abre un archivo del bucket privado con un link firmado de 10 minutos. ?descargar fuerza la descarga.
// /archivos/logo devuelve el logo de Configuración → Apariencia. Pide sesión (middleware).
import { NextResponse } from "next/server";
import { BUCKET, db } from "@/lib/db";
import { leerApariencia } from "@/lib/datos";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const descargar = new URL(req.url).searchParams.has("descargar");
  let ruta: string | null = null;
  let nombre = "archivo";

  if (id === "logo") {
    ruta = (await leerApariencia()).logo_path;
  } else if (/^[0-9a-f-]{36}$/i.test(id)) {
    const { data } = await db().from("archivos").select("storage_path, nombre, tipo").eq("id", id).maybeSingle();
    if (data) {
      ruta = data.storage_path;
      nombre = data.nombre.toLowerCase().endsWith(`.${data.tipo}`) ? data.nombre : `${data.nombre}.${data.tipo}`;
    }
  }
  if (!ruta) return new NextResponse("No existe el archivo", { status: 404 });

  const { data, error } = await db().storage.from(BUCKET).createSignedUrl(ruta, 600, descargar ? { download: nombre } : undefined);
  if (error || !data) return new NextResponse("No se pudo abrir el archivo", { status: 502 });
  return NextResponse.redirect(data.signedUrl, { status: 302 });
}
