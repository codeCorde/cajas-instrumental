import { NextResponse } from "next/server";
import { armarRecordatorio, armarResumenDiario } from "@/lib/resumen";
import { hayCanales, notificar, urlApp } from "@/lib/notificar";
import { revisarStockEmergencia } from "@/lib/emergencia";
import { bloquePreguntas, leerPreguntasAviso, quitarPreguntasEnviadas } from "@/lib/preguntas";

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
  if (tipo === "resumen") await revisarStockEmergencia("Claude"); // por si algo cambió el stock sin pasar por la app
  const hora = url.searchParams.get("hora") ?? "";
  let msg = tipo === "recordatorio" ? await armarRecordatorio(hora) : await armarResumenDiario();
  // preguntas puntuales que esperan el próximo aviso: van adentro de este mensaje (nunca en uno aparte)
  const preguntas = await leerPreguntasAviso();
  if (preguntas.length) {
    msg = msg ?? { titulo: `⏰ Recordatorio ${hora.replace(/^0/, "")}`, texto: "" };
    msg = { ...msg, texto: [msg.texto, ...bloquePreguntas(preguntas)].join("\n").trim() };
  }
  if (!msg) return NextResponse.json({ enviado: false, motivo: "Nada pendiente" });
  const errores = await notificar(msg.titulo, msg.texto, urlApp("/produccion"));
  if (errores.length === 0) await quitarPreguntasEnviadas(preguntas);
  return NextResponse.json({ enviado: errores.length === 0, errores, preguntas: preguntas.length });
}
