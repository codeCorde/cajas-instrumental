import { NextResponse } from "next/server";
import { armarRecordatorio, armarResumenDiario } from "@/lib/resumen";
import { hayCanales, notificar, urlApp } from "@/lib/notificar";

export const dynamic = "force-dynamic";

// Lo llama GitHub Actions (.github/workflows/avisos.yml) con "Authorization: Bearer <CRON_SECRET>".
//   ?tipo=resumen                     → resumen del día (6:40)
//   ?tipo=recordatorio&hora=09:40     → recordatorio corto con preguntas de información faltante (9:40, 12:40, 15:40)
export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) return new NextResponse("No autorizado", { status: 401 });
  if (!hayCanales()) return NextResponse.json({ enviado: false, motivo: "No hay canales de aviso configurados" });
  const url = new URL(req.url);
  const tipo = url.searchParams.get("tipo") ?? "resumen";
  const msg = tipo === "recordatorio" ? await armarRecordatorio(url.searchParams.get("hora") ?? "") : await armarResumenDiario();
  if (!msg) return NextResponse.json({ enviado: false, motivo: "Nada pendiente" });
  const errores = await notificar(msg.titulo, msg.texto, urlApp("/produccion"));
  return NextResponse.json({ enviado: errores.length === 0, errores });
}
