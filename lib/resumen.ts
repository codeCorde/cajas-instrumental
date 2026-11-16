import "server-only";
import { db } from "./db";
import { cargarCatalogo, composicionDe } from "./datos";
import { cargarPedidos } from "./pedidos";
import { ESTADO_TERMINADAS_INFO, estadoTerminadasCaja, listadoGeneral, piezasTerminadas } from "./calculos";
import { urlApp } from "./notificar";

/**
 * Resumen diario para el celular: pedidos por recepcionar, órdenes y lo que falta, finalizados sin firmar,
 * estado de cada caja, movimientos de stock de las últimas 24 h y links para cargar stock o un pedido.
 */
export async function armarResumenDiario(): Promise<{ titulo: string; texto: string }> {
  const desde = new Date(Date.now() - 86_400_000).toISOString();
  const [cat, pendientes, ordenes, sinFirmar, entregadosHoy, movs] = await Promise.all([
    cargarCatalogo(),
    cargarPedidos(["pendiente"]),
    cargarPedidos(["en_produccion"]),
    cargarPedidos(["listo"]),
    db().from("pedidos").select("numero", { count: "exact" }).eq("estado", "entregado").gte("recibido_en", desde),
    db().from("movimientos").select("id", { count: "exact", head: true }).gte("creado_en", desde),
  ]);

  const l: string[] = [];
  l.push(`📥 Por recepcionar: ${pendientes.length}${pendientes.length ? ` (${pendientes.map((p) => `${p.numero} ${p.cliente}`).join(", ")})` : ""}`);
  l.push(`🛠 Órdenes en producción: ${ordenes.length}`);
  const faltan = Object.entries(listadoGeneral(ordenes))
    .map(([id, n]) => ({ inst: cat.porId.get(id), n }))
    .filter((x) => x.inst)
    .map((x) => ({ nombre: x.inst!.nombre, falta: x.n - piezasTerminadas(x.inst!) }))
    .filter((x) => x.falta > 0);
  if (faltan.length) l.push(`   Falta terminar: ${faltan.slice(0, 12).map((x) => `${x.falta} ${x.nombre}`).join(" · ")}${faltan.length > 12 ? " …" : ""}`);
  else if (ordenes.length) l.push("   ✓ Hay piezas terminadas para todas las órdenes: se pueden armar.");
  l.push(`■ Finalizados sin firmar: ${sinFirmar.length}${sinFirmar.length ? ` (${sinFirmar.map((p) => p.numero).join(", ")})` : ""}`);
  l.push(`✓ Entregados en las últimas 24 h: ${entregadosHoy.count ?? 0}`);
  l.push("");
  l.push("Cajas (piezas terminadas):");
  for (const c of cat.cajas) {
    const e = estadoTerminadasCaja(composicionDe(cat, c.id));
    l.push(`  ${ESTADO_TERMINADAS_INFO[e].icono} ${c.nombre}: ${ESTADO_TERMINADAS_INFO[e].label.toLowerCase()}`);
  }
  l.push("");
  l.push((movs.count ?? 0) === 0 ? "⚠ Nadie cargó stock en las últimas 24 h. ¿Hay algo para cargar hoy?" : `Movimientos de stock en 24 h: ${movs.count}`);
  l.push(`• Cargar piezas terminadas: ${urlApp("/produccion/terminadas")}`);
  l.push(`• Cargar stock de partes: ${urlApp("/produccion/partes")}`);
  l.push(`• Cargar un pedido a mano: ${urlApp("/pedir")}`);

  const fechaHoy = new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "long", day: "numeric", month: "numeric" });
  return { titulo: `📋 Resumen del taller · ${fechaHoy}`, texto: l.join("\n") };
}
