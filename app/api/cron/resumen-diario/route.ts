import { NextResponse } from "next/server";
import { armarResumenDiario } from "@/lib/resumen";
import { hayCanales, notificar, urlApp } from "@/lib/notificar";

export const dynamic = "force-dynamic";

// Lo llama Vercel Cron todos los días (vercel.json). Vercel manda "Authorization: Bearer <CRON_SECRET>".
export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) return new NextResponse("No autorizado", { status: 401 });
  if (!hayCanales()) return NextResponse.json({ enviado: false, motivo: "No hay canales de aviso configurados" });
  const { titulo, texto } = await armarResumenDiario();
  const errores = await notificar(titulo, texto, urlApp("/produccion"));
  return NextResponse.json({ enviado: errores.length === 0, errores });
}
