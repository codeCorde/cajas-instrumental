import { listarMovimientos } from "@/lib/historial";
import { aCSV } from "@/lib/csv";
import { fechaHora } from "@/lib/formato";
import { CAMPO_LABEL, MOTIVO_LABEL } from "@/lib/tipos";

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const movs = await listarMovimientos({
    desde: p.get("desde") ?? undefined,
    hasta: p.get("hasta") ?? undefined,
    caja: p.get("caja") ?? undefined,
    instrumental: p.get("instrumental") ?? undefined,
    motivo: p.get("motivo") ?? undefined,
    autor: p.get("autor") ?? undefined,
    limite: 20000,
  });
  const csv = aCSV(
    ["Fecha", "Persona", "Caja", "Instrumental", "Medida / pieza", "Campo", "Cantidad", "Stock resultante", "Motivo", "Nota"],
    movs.map((m) => [
      fechaHora(m.creado_en),
      m.autor,
      m.caja_nombre,
      m.instrumental_nombre,
      m.componente_nombre,
      CAMPO_LABEL[m.campo],
      m.delta,
      m.stock_resultante,
      MOTIVO_LABEL[m.motivo],
      m.nota,
    ]),
  );
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="historial-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
