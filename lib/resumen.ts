import "server-only";
import { db } from "./db";
import { cargarCatalogo, composicionDe } from "./datos";
import { cargarPedidos, nombreLinea } from "./pedidos";
import { ESTADO_EMERGENCIA_INFO, ESTADO_TERMINADAS_INFO, estadoTerminadasCaja, faltanteEmergencia, listadoGeneral, terminadasLinea } from "./calculos";
import { ordenesReposicionAbiertas } from "./emergencia";
import { urlApp } from "./notificar";
import { cargarFaltantes, elegirPreguntas } from "./faltantes";

/**
 * Resumen diario (6:40) para el celular: pedidos por recepcionar, órdenes y lo que falta, finalizados sin firmar,
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
    .map(([clave, n]) => {
      const [id, comp = null] = clave.split("|");
      return { id, comp, inst: cat.porId.get(id), n };
    })
    .filter((x) => x.inst)
    .map((x) => ({ nombre: nombreLinea(cat, x.id, x.comp), falta: x.n - terminadasLinea(x.inst!, x.comp) }))
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
  const reposicion = await ordenesReposicionAbiertas();
  const conMinimo = cat.cajas.filter((c) => c.stock_minimo > 0);
  if (conMinimo.length) {
    l.push("");
    l.push("🛟 Stock de emergencia (cajas armadas / mínimo):");
    for (const c of conMinimo) {
      const abiertas = reposicion.filter((o) => o.caja_id === c.id);
      const e = faltanteEmergencia(c.stock_minimo, c.cajas_armadas, abiertas.reduce((s, o) => s + o.cantidad, 0));
      l.push(`  ${ESTADO_EMERGENCIA_INFO[e.estado].icono} ${c.nombre}: ${c.cajas_armadas} de ${c.stock_minimo}${abiertas.length ? ` · en reposición: ${abiertas.map((o) => o.numero).join(", ")}` : ""}`);
    }
  }
  l.push("");
  l.push((movs.count ?? 0) === 0 ? "⚠ Nadie cargó stock en las últimas 24 h. ¿Hay algo para cargar hoy?" : `Movimientos de stock en 24 h: ${movs.count}`);
  const faltantes = await cargarFaltantes();
  const totalFaltan = faltantes.reduce((s, f) => s + f.preguntas.length, 0);
  if (totalFaltan) l.push(`❓ Faltan ${totalFaltan} datos por cargar (fotos, planos, programas, máquinas, etapas): ${urlApp("/produccion/faltantes")}`);
  l.push(`• Cargar piezas terminadas: ${urlApp("/produccion/terminadas")}`);
  l.push(`• Cargar stock de partes: ${urlApp("/produccion/partes")}`);
  l.push(`• Cargar un pedido a mano: ${urlApp("/pedir")}`);

  const fechaHoy = new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "long", day: "numeric", month: "numeric" });
  return { titulo: `📋 Resumen del taller · ${fechaHoy}`, texto: l.join("\n") };
}

/**
 * Recordatorio corto (9:40, 12:40 y 15:40): lo que está esperando al dueño (recepcionar, firmar) y
 * 3 preguntas sobre información que falta cargar, distintas en cada horario.
 */
export async function armarRecordatorio(hora: string): Promise<{ titulo: string; texto: string } | null> {
  const [pendientes, sinFirmar, faltantes] = await Promise.all([cargarPedidos(["pendiente"]), cargarPedidos(["listo"]), cargarFaltantes()]);
  const hoy = new Date();
  const diaDelAnio = Math.floor((hoy.getTime() - new Date(hoy.getFullYear(), 0, 0).getTime()) / 86_400_000);
  const slot = ["09:40", "12:40", "15:40"].indexOf(hora);
  const preguntas = elegirPreguntas(faltantes, 3, diaDelAnio * 3 + Math.max(0, slot));
  const l: string[] = [];
  if (pendientes.length) l.push(`📥 ${pendientes.length} por recepcionar: ${pendientes.map((p) => `${p.numero} ${p.cliente}`).join(", ")}`);
  if (sinFirmar.length) l.push(`■ ${sinFirmar.length} finalizados sin firmar: ${sinFirmar.map((p) => p.numero).join(", ")}`);
  if (preguntas.length) {
    l.push("");
    l.push("❓ Para completar la información (respondeme en el chat con Claude: dictado, texto o fotos):");
    preguntas.forEach((p, i) => l.push(`${i + 1}. ${p}`));
    const total = faltantes.reduce((s, f) => s + f.preguntas.length, 0);
    l.push(`(Quedan ${total} datos por cargar: ${urlApp("/produccion/faltantes")})`);
  }
  if (l.length === 0) return null; // nada pendiente: no molesta
  return { titulo: `⏰ Recordatorio ${hora.replace(/^0/, "")}`, texto: l.join("\n") };
}
