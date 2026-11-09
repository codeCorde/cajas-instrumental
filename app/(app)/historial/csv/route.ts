import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { buscarMovimientos, formatearFecha } from "@/lib/historial";
import { aCSV } from "@/lib/csv";
import { CAMPO_LABEL, MOTIVO_LABEL } from "@/lib/tipos";

export async function GET(request: NextRequest) {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("No autorizado", { status: 401 });
  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).single();
  if (perfil?.rol !== "admin") return new NextResponse("Solo admin", { status: 403 });

  const p = request.nextUrl.searchParams;
  const movs = await buscarMovimientos(
    {
      caja: p.get("caja") ?? undefined,
      instrumental: p.get("instrumental") ?? undefined,
      usuario: p.get("usuario") ?? undefined,
      desde: p.get("desde") ?? undefined,
      hasta: p.get("hasta") ?? undefined,
    },
    10000,
  );

  const csv = aCSV(
    ["Fecha", "Usuario", "Caja", "Instrumental", "Medida/Parte", "Campo", "Cantidad", "Stock resultante", "Motivo", "Nota"],
    movs.map((m) => [
      formatearFecha(m.creado_en),
      m.usuario_nombre,
      m.caja_nombre,
      m.instrumental_nombre,
      m.parte_nombre,
      CAMPO_LABEL[m.campo] ?? m.campo,
      m.delta,
      m.stock_resultante,
      MOTIVO_LABEL[m.motivo],
      m.nota,
    ]),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="historial-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
