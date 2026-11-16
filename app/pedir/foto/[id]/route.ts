import { NextResponse } from "next/server";
import { BUCKET, db } from "@/lib/db";
import { IMAGENES } from "@/lib/formato";

// Foto de una caja para la página pública del QR. Solo imágenes de cajas (nunca planos ni otros archivos).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("No encontrado", { status: 404 });
  const { data: a } = await db().from("archivos").select("storage_path, tipo, entidad, vigente").eq("id", id).maybeSingle();
  if (!a || a.entidad !== "caja" || !a.vigente || !IMAGENES.includes(a.tipo)) return new NextResponse("No encontrado", { status: 404 });
  const { data, error } = await db().storage.from(BUCKET).createSignedUrl(a.storage_path, 600);
  if (error || !data) return new NextResponse("No se pudo abrir la foto", { status: 500 });
  return NextResponse.redirect(data.signedUrl, { status: 302 });
}
