// ★ Lógica de negocio (la misma del Excel). Funciones puras: sin base de datos ni React.
// Cualquier cambio acá lleva su test en tests/calculos.test.ts.
// La regla de armado de caja (planArmadoCaja) está duplicada a propósito en SQL: taller.armar_caja (0007_taller.sql).

import type { Componente, Instrumental, TipoInstrumental } from "./tipos";

export type Estado = "disponible" | "en_proceso" | "falta" | "sin_definir";
export const ESTADO_INFO: Record<Estado, { label: string; icono: string }> = {
  disponible: { label: "Disponible", icono: "✓" },
  en_proceso: { label: "En proceso", icono: "◐" },
  falta: { label: "Falta", icono: "✕" },
  sin_definir: { label: "Sin definir", icono: "○" },
};

type CompCalc = Pick<Componente, "id" | "clase" | "codigo_o_medida" | "nombre" | "cant_por_unidad" | "stock">;
export type InstCalc = Pick<Instrumental, "id" | "nombre" | "tipo" | "stock_terminado" | "unidades_armadas"> & { componentes: CompCalc[] };

/** Medidas (si es de medidas) o piezas (si es complejo). Los simples no tienen. */
export function componentesDe(inst: InstCalc): CompCalc[] {
  if (inst.tipo === "simple") return [];
  const clase = inst.tipo === "medidas" ? "medida" : "pieza";
  return inst.componentes.filter((c) => c.clase === clase);
}

export const nombreComponente = (c: Pick<Componente, "codigo_o_medida" | "nombre">) =>
  c.nombre ? `${c.codigo_o_medida} · ${c.nombre}` : c.codigo_o_medida;

/** Medidas o Complejo sin medidas/piezas cargadas. */
export function sinDefinir(inst: InstCalc): boolean {
  return inst.tipo !== "simple" && componentesDe(inst).length === 0;
}

/** Juegos (medidas) o instrumentales (piezas) completos que se arman con los componentes sueltos. Lo limita el que menos hay. */
export function completosConComponentes(inst: InstCalc): number {
  const comps = componentesDe(inst);
  if (comps.length === 0) return 0;
  return Math.min(...comps.map((c) => Math.floor(c.stock / c.cant_por_unidad)));
}

/** Stock completo. Simple: stock terminado. Medidas: juegos completos. Complejo: armados + los que salen de las piezas. */
export function stockCompleto(inst: InstCalc): number {
  if (inst.tipo === "simple") return inst.stock_terminado;
  if (inst.tipo === "medidas") return completosConComponentes(inst);
  return inst.unidades_armadas + completosConComponentes(inst);
}

/** ¿Hay algo de stock (aunque no alcance para uno completo)? */
export function hayAlgo(inst: InstCalc): boolean {
  if (inst.tipo === "simple") return inst.stock_terminado > 0;
  if (inst.tipo === "complejo" && inst.unidades_armadas > 0) return true;
  return componentesDe(inst).some((c) => c.stock > 0);
}

export interface FilaComponente {
  componente: CompCalc;
  alcanza: number; // juegos / instrumentales que alcanza esta medida o pieza
  faltanProximo: number; // cuántas faltan para completar uno más
  estado: "ok" | "fabricar";
}

/** Sub-tabla de medidas o piezas (como en el Excel): qué falta para completar el próximo juego o instrumental. */
export function filasComponentes(inst: InstCalc): FilaComponente[] {
  const comps = componentesDe(inst);
  const proximo = completosConComponentes(inst) + 1;
  return comps.map((c) => {
    const faltanProximo = Math.max(0, c.cant_por_unidad * proximo - c.stock);
    return { componente: c, alcanza: Math.floor(c.stock / c.cant_por_unidad), faltanProximo, estado: faltanProximo > 0 ? "fabricar" : "ok" };
  });
}

export interface EstadoEnCaja {
  estado: Estado;
  completo: number;
  alcanza: number; // cajas que alcanza
  falta: string | null; // "Falta: Ø52, Ø58" · "Hay 1 de 2 por caja"
}

/** Estado de un instrumental dentro de una caja que lleva `cantPorCaja`. */
export function estadoEnCaja(inst: InstCalc, cantPorCaja: number): EstadoEnCaja {
  const completo = stockCompleto(inst);
  const alcanza = cantPorCaja > 0 ? Math.floor(completo / cantPorCaja) : 0;
  if (sinDefinir(inst)) {
    return { estado: "sin_definir", completo, alcanza: 0, falta: inst.tipo === "medidas" ? "Sin medidas cargadas" : "Sin piezas cargadas" };
  }
  if (alcanza >= 1) return { estado: "disponible", completo, alcanza, falta: null };
  if (!hayAlgo(inst)) return { estado: "falta", completo, alcanza, falta: "No hay stock" };

  let falta: string;
  if (inst.tipo === "medidas") {
    const faltan = componentesDe(inst).filter((c) => c.stock < c.cant_por_unidad * cantPorCaja);
    falta = `Falta: ${faltan.map((c) => c.codigo_o_medida).join(", ")}`;
  } else if (inst.tipo === "complejo" && completo === 0) {
    const resto = Math.max(0, cantPorCaja - inst.unidades_armadas);
    const faltan = componentesDe(inst).filter((c) => c.stock < c.cant_por_unidad * resto);
    falta = `Falta: ${faltan.map(nombreComponente).join(", ")}`;
  } else {
    falta = `Hay ${completo} de ${cantPorCaja} por caja`;
  }
  return { estado: "en_proceso", completo, alcanza, falta };
}

export interface FilaCaja<I extends InstCalc = InstCalc> extends EstadoEnCaja {
  inst: I;
  cantPorCaja: number;
}
export interface ResumenCaja<I extends InstCalc = InstCalc> {
  filas: FilaCaja<I>[];
  posibles: number; // cajas completas que se pueden armar
  limitante: FilaCaja<I> | null; // el instrumental que menos alcanza
  contadores: Record<Estado, number>;
}

/** Resumen de una caja con el stock compartido. Si la caja no tiene instrumental, se pueden armar 0. */
export function resumenCaja<I extends InstCalc>(composicion: { inst: I; cantPorCaja: number }[]): ResumenCaja<I> {
  const filas = composicion.map(({ inst, cantPorCaja }) => ({ inst, cantPorCaja, ...estadoEnCaja(inst, cantPorCaja) }));
  const contadores: Record<Estado, number> = { disponible: 0, en_proceso: 0, falta: 0, sin_definir: 0 };
  for (const f of filas) contadores[f.estado]++;
  if (filas.length === 0) return { filas, posibles: 0, limitante: null, contadores };
  const limitante = filas.reduce((min, f) => (f.alcanza < min.alcanza ? f : min));
  return { filas, posibles: limitante.alcanza, limitante, contadores };
}

// ---------------------------------------------------------------------------
// Armado de caja (vista previa; la base hace lo mismo en taller.armar_caja)
// ---------------------------------------------------------------------------

export interface Descuento {
  instrumental_id: string;
  componente_id: string | null;
  campo: "stock_terminado" | "unidades_armadas" | "stock";
  cantidad: number;
  etiqueta: string;
}
export interface PlanArmado {
  ok: boolean;
  descuentos: Descuento[];
  faltantes: string[];
}

/**
 * Qué se descuenta para armar 1 caja.
 *  Simple   → cant_por_caja del stock terminado.
 *  Medidas  → cant_por_unidad × cant_por_caja de cada medida.
 *  Complejo → primero unidades armadas; lo que falte, con piezas sueltas.
 */
export function planArmadoCaja(composicion: { inst: InstCalc; cantPorCaja: number }[]): PlanArmado {
  const descuentos: Descuento[] = [];
  const faltantes: string[] = [];
  if (composicion.length === 0) return { ok: false, descuentos, faltantes: ["La caja no tiene instrumental cargado"] };

  for (const { inst, cantPorCaja } of composicion) {
    if (inst.tipo === "simple") {
      if (inst.stock_terminado < cantPorCaja) faltantes.push(`${inst.nombre}: hay ${inst.stock_terminado} de ${cantPorCaja}`);
      descuentos.push({ instrumental_id: inst.id, componente_id: null, campo: "stock_terminado", cantidad: cantPorCaja, etiqueta: inst.nombre });
    } else if (inst.tipo === "medidas") {
      const comps = componentesDe(inst);
      if (comps.length === 0) faltantes.push(`${inst.nombre}: sin medidas cargadas`);
      for (const c of comps) {
        const n = c.cant_por_unidad * cantPorCaja;
        if (c.stock < n) faltantes.push(`${inst.nombre} ${c.codigo_o_medida}: hay ${c.stock} de ${n}`);
        descuentos.push({ instrumental_id: inst.id, componente_id: c.id, campo: "stock", cantidad: n, etiqueta: `${inst.nombre} ${c.codigo_o_medida}` });
      }
    } else {
      const usaArmadas = Math.min(inst.unidades_armadas, cantPorCaja);
      const resto = cantPorCaja - usaArmadas;
      if (usaArmadas > 0) {
        descuentos.push({ instrumental_id: inst.id, componente_id: null, campo: "unidades_armadas", cantidad: usaArmadas, etiqueta: `${inst.nombre} (armados)` });
      }
      if (resto > 0) {
        const comps = componentesDe(inst);
        if (comps.length === 0) faltantes.push(`${inst.nombre}: hay ${inst.unidades_armadas} armados de ${cantPorCaja} y no tiene piezas cargadas`);
        for (const c of comps) {
          const n = c.cant_por_unidad * resto;
          if (c.stock < n) faltantes.push(`${inst.nombre} · ${nombreComponente(c)}: hay ${c.stock} de ${n}`);
          descuentos.push({ instrumental_id: inst.id, componente_id: c.id, campo: "stock", cantidad: n, etiqueta: `${inst.nombre} · ${nombreComponente(c)}` });
        }
      }
    }
  }
  return { ok: faltantes.length === 0, descuentos, faltantes };
}

// ---------------------------------------------------------------------------
// Qué fabricar (con stock compartido: se suma lo que piden todas las cajas)
// ---------------------------------------------------------------------------

export interface FilaFabricar<I extends InstCalc = InstCalc> {
  inst: I;
  componente: CompCalc | null;
  cantidad: number;
  nota: string | null;
}

/**
 * Qué hay que fabricar para armar `cajas` (caja → cantidad de cajas a armar).
 * Como el instrumental es compartido, se suma lo que necesitan todas las cajas antes de comparar con el stock.
 */
export function queFabricar<I extends InstCalc>(
  necesidades: { composicion: { inst: I; cantPorCaja: number }[]; cajas: number }[],
): FilaFabricar<I>[] {
  const total = new Map<string, { inst: I; unidades: number }>();
  for (const n of necesidades) {
    if (n.cajas <= 0) continue;
    for (const { inst, cantPorCaja } of n.composicion) {
      const t = total.get(inst.id) ?? { inst, unidades: 0 };
      t.unidades += cantPorCaja * n.cajas;
      total.set(inst.id, t);
    }
  }

  const filas: FilaFabricar<I>[] = [];
  for (const { inst, unidades } of total.values()) {
    if (inst.tipo === "simple") {
      const f = unidades - inst.stock_terminado;
      if (f > 0) filas.push({ inst, componente: null, cantidad: f, nota: null });
      continue;
    }
    const aArmar = inst.tipo === "complejo" ? Math.max(0, unidades - inst.unidades_armadas) : unidades;
    if (aArmar === 0) continue;
    const comps = componentesDe(inst);
    if (comps.length === 0) {
      filas.push({ inst, componente: null, cantidad: aArmar, nota: inst.tipo === "medidas" ? "Sin medidas cargadas" : "Sin piezas cargadas" });
      continue;
    }
    for (const c of comps) {
      const f = c.cant_por_unidad * aArmar - c.stock;
      if (f > 0) filas.push({ inst, componente: c, cantidad: f, nota: null });
    }
  }
  return filas;
}

/** Cajas que faltan armar para cubrir lo pedido: lo pedido menos las cajas ya armadas (por caja). */
export function cajasFaltantesParaPedidos(
  items: { caja_id: string; cantidad: number }[],
  cajasArmadas: Record<string, number>,
): Record<string, number> {
  const pedido: Record<string, number> = {};
  for (const it of items) pedido[it.caja_id] = (pedido[it.caja_id] ?? 0) + it.cantidad;
  const faltan: Record<string, number> = {};
  for (const [caja, n] of Object.entries(pedido)) {
    const f = n - (cajasArmadas[caja] ?? 0);
    if (f > 0) faltan[caja] = f;
  }
  return faltan;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

export const TIPO_LABEL: Record<TipoInstrumental, string> = { simple: "Simple", medidas: "Medidas", complejo: "Complejo" };

/**
 * Rango rápido de medidas: "Ø44 a Ø62 de a 2" → Ø44, Ø46, … Ø62. También "N°7.5 a N°20 de a 2.5" o "44-62/2".
 * Devuelve null si no se entiende.
 */
export function generarRango(texto: string): string[] | null {
  const m = texto
    .trim()
    .replace(/,/g, ".")
    .match(/^([^\d\s.]*)\s*(\d+(?:\.\d+)?)\s*(?:a|-|al|hasta)\s*\1?\s*(\d+(?:\.\d+)?)\s*(?:(?:de a|cada|\/|paso)\s*(\d+(?:\.\d+)?))?$/i);
  if (!m) return null;
  const [, prefijo, d, h, p] = m;
  const desde = Number(d);
  const hasta = Number(h);
  const paso = p ? Number(p) : 1;
  if (!(paso > 0) || hasta < desde || (hasta - desde) / paso > 200) return null;
  const decimales = Math.max(...[d, h, p ?? "1"].map((x) => (x.split(".")[1] ?? "").length));
  const salida: string[] = [];
  for (let v = desde; v <= hasta + 1e-9; v += paso) salida.push(`${prefijo}${Number(v.toFixed(decimales))}`);
  return salida;
}

// ---------------------------------------------------------------------------
// Piezas terminadas y pedidos por pieza (flujo del QR de pedidos)
// ---------------------------------------------------------------------------

/**
 * Piezas terminadas (listas para entregar).
 *  Simple   → stock terminado.
 *  Medidas  → sets completos (lo limita la medida que menos hay).
 *  Complejo → unidades armadas (las piezas sueltas todavía son "stock de partes").
 */
export function piezasTerminadas(inst: InstCalc): number {
  if (inst.tipo === "simple") return inst.stock_terminado;
  if (inst.tipo === "medidas") return completosConComponentes(inst);
  return inst.unidades_armadas;
}

export type EstadoTerminadas = "completa" | "incompleta" | "vacia";
/** Íconos pedidos en las fotos: círculo verde, cuadrado naranja, cruz roja. */
export const ESTADO_TERMINADAS_INFO: Record<EstadoTerminadas, { label: string; icono: string }> = {
  completa: { label: "Completa", icono: "●" },
  incompleta: { label: "Incompleta", icono: "■" },
  vacia: { label: "Vacía", icono: "✕" },
};

/** Caja según las piezas terminadas: completa si alcanza para 1 caja, vacía si no hay ninguna pieza terminada. */
export function estadoTerminadasCaja(composicion: { inst: InstCalc; cantPorCaja: number }[]): EstadoTerminadas {
  if (composicion.length === 0) return "vacia";
  if (composicion.every(({ inst, cantPorCaja }) => piezasTerminadas(inst) >= cantPorCaja)) return "completa";
  if (composicion.every(({ inst }) => piezasTerminadas(inst) === 0)) return "vacia";
  return "incompleta";
}

/** Clave de una línea de pedido: la pieza, o la pieza + la medida suelta de un set personalizado. */
export const claveLinea = (instrumentalId: string, componenteId?: string | null) => (componenteId ? `${instrumentalId}|${componenteId}` : instrumentalId);

/**
 * Listado general: suma lo que FALTA entregar de cada pieza en todas las órdenes (cantidad − entregada).
 * Las medidas sueltas de un set personalizado van en su propia línea (clave `pieza|medida`).
 */
export function listadoGeneral(
  pedidos: { piezas: { instrumental_id: string; componente_id?: string | null; cantidad: number; entregada?: number }[] }[],
): Record<string, number> {
  const total: Record<string, number> = {};
  for (const p of pedidos)
    for (const it of p.piezas) {
      const n = it.cantidad - (it.entregada ?? 0);
      if (n <= 0) continue;
      const k = claveLinea(it.instrumental_id, it.componente_id);
      total[k] = (total[k] ?? 0) + n;
    }
  return total;
}

export interface PlanPedido {
  ok: boolean;
  faltantes: string[];
  descuentos: { etiqueta: string; cantidad: number; hay: number }[];
}

/**
 * Qué se descuenta al finalizar o entregar (parcial) un pedido. Misma regla que taller._necesidades (0010):
 *  Simple → stock terminado · Complejo → unidades armadas · Set entero → cada medida × cant_por_unidad ·
 *  Medida suelta (set personalizado) → esa medida × cant_por_unidad. Se suma por destino (una medida pedida
 *  en el set y suelta cuenta una vez con el total). Cajas (pedidos viejos) → cajas armadas.
 */
export function planFinalizarPedido(
  piezas: { inst: InstCalc; componenteId?: string | null; cantidad: number }[],
  cajas: { nombre: string; cajas_armadas: number; cantidad: number }[] = [],
): PlanPedido {
  const destinos = new Map<string, { etiqueta: string; orden: [string, string]; cantidad: number; hay: number; sinMedidas?: boolean }>();
  const sumar = (k: string, etiqueta: string, orden: [string, string], cantidad: number, hay: number, sinMedidas = false) => {
    const d = destinos.get(k) ?? { etiqueta, orden, cantidad: 0, hay, sinMedidas };
    d.cantidad += cantidad;
    destinos.set(k, d);
  };
  for (const { inst, componenteId, cantidad } of piezas) {
    if (cantidad <= 0) continue;
    if (componenteId) {
      const c = inst.componentes.find((x) => x.id === componenteId);
      if (c) sumar(`c:${c.id}`, `${inst.nombre} ${c.codigo_o_medida}`, [inst.nombre, c.codigo_o_medida], c.cant_por_unidad * cantidad, c.stock);
    } else if (inst.tipo === "simple") {
      sumar(`t:${inst.id}`, inst.nombre, [inst.nombre, ""], cantidad, inst.stock_terminado);
    } else if (inst.tipo === "complejo") {
      sumar(`a:${inst.id}`, `${inst.nombre} (armados)`, [inst.nombre, ""], cantidad, inst.unidades_armadas);
    } else {
      const comps = componentesDe(inst);
      if (comps.length === 0) sumar(`s:${inst.id}`, inst.nombre, [inst.nombre, ""], 1, 0, true);
      for (const c of comps) sumar(`c:${c.id}`, `${inst.nombre} ${c.codigo_o_medida}`, [inst.nombre, c.codigo_o_medida], c.cant_por_unidad * cantidad, c.stock);
    }
  }
  if (destinos.size === 0 && cajas.length === 0) return { ok: false, faltantes: ["El pedido no tiene piezas"], descuentos: [] };

  const lista = [...destinos.values()].sort((a, b) => a.orden[0].localeCompare(b.orden[0], "es") || a.orden[1].localeCompare(b.orden[1], "es", { numeric: true }));
  const faltantes = lista.filter((d) => d.sinMedidas || d.hay < d.cantidad).map((d) => (d.sinMedidas ? `${d.etiqueta}: sin medidas cargadas` : `${d.etiqueta}: hay ${d.hay} de ${d.cantidad}`));
  const descuentos = lista.filter((d) => !d.sinMedidas).map(({ etiqueta, cantidad, hay }) => ({ etiqueta, cantidad, hay }));
  for (const c of cajas) {
    if (c.cajas_armadas < c.cantidad) faltantes.push(`${c.nombre}: hay ${c.cajas_armadas} cajas armadas de ${c.cantidad}`);
    descuentos.push({ etiqueta: `${c.nombre} (cajas armadas)`, cantidad: c.cantidad, hay: c.cajas_armadas });
  }
  return { ok: faltantes.length === 0, faltantes, descuentos };
}

// ---------------------------------------------------------------------------
// Información que falta cargar (para preguntarle al dueño en los recordatorios)
// ---------------------------------------------------------------------------

export interface DatosFicha {
  nombre: string;
  tipo: TipoInstrumental;
  origen: "propia" | "tercerizado";
  a_confirmar: boolean;
  proceso: string | null;
  maquina: string | null;
  herramientas: string | null;
  etapa: string | null;
  partes: { nombre: string; etapa: string | null }[]; // medidas o piezas
  archivos: string[]; // extensiones de los archivos vigentes
}
export type ClaveFaltante = "foto" | "plano2d" | "modelo3d" | "programa" | "maquina" | "herramientas" | "proceso" | "etapa" | "medidas" | "confirmar";

const EXT_FOTO = ["png", "jpg", "jpeg", "webp", "gif"];
const EXT_2D = ["pdf", "dwg", "dxf"];
const EXT_3D = ["stp", "step"];
const EXT_CNC = ["txt", "nc", "gcode", "ngc", "tap", "cnc"];

/** Qué le falta a la ficha de una pieza, como preguntas cortas. Las tercerizadas no piden programa, máquina ni herramientas. */
export function infoFaltante(f: DatosFicha): { clave: ClaveFaltante; pregunta: string }[] {
  const tiene = (exts: string[]) => f.archivos.some((a) => exts.includes(a));
  const propia = f.origen === "propia";
  const out: { clave: ClaveFaltante; pregunta: string }[] = [];
  if (f.tipo !== "simple" && f.partes.length === 0) out.push({ clave: "medidas", pregunta: `¿Qué ${f.tipo === "medidas" ? "medidas" : "partes"} lleva «${f.nombre}»?` });
  if (f.a_confirmar) out.push({ clave: "confirmar", pregunta: `¿Confirmás cuántas «${f.nombre}» lleva cada caja?` });
  if (!tiene(EXT_FOTO)) out.push({ clave: "foto", pregunta: `Mandame una foto de «${f.nombre}».` });
  if (!tiene(EXT_2D)) out.push({ clave: "plano2d", pregunta: `¿Tenés el plano 2D (PDF o DWG) de «${f.nombre}»?` });
  if (!tiene(EXT_3D)) out.push({ clave: "modelo3d", pregunta: `¿Tenés el modelo 3D (STEP) de «${f.nombre}»?` });
  if (propia && !tiene(EXT_CNC)) out.push({ clave: "programa", pregunta: `¿Tenés el programa de mecanizado (Bloc de notas) de «${f.nombre}»?` });
  if (propia && !f.maquina) out.push({ clave: "maquina", pregunta: `¿En qué máquina se hace «${f.nombre}»?` });
  if (propia && !f.herramientas) out.push({ clave: "herramientas", pregunta: `¿Qué mechas y machos usa «${f.nombre}»?` });
  if (!f.proceso) out.push({ clave: "proceso", pregunta: `¿Cuántos procesos lleva «${f.nombre}» y cuáles son?` });
  const sinEtapa = f.tipo === "simple" ? (f.etapa ? [] : [f.nombre]) : f.partes.filter((p) => !p.etapa).map((p) => p.nombre);
  if (sinEtapa.length) out.push({ clave: "etapa", pregunta: `¿En qué etapa está «${f.nombre}»${f.tipo === "simple" ? "" : ` (${sinEtapa.slice(0, 4).join(", ")}${sinEtapa.length > 4 ? "…" : ""})`}?` });
  return out;
}

/** Terminadas de una línea de pedido: la pieza/set entero, o las unidades de una medida suelta. */
export function terminadasLinea(inst: InstCalc, componenteId?: string | null): number {
  if (!componenteId) return piezasTerminadas(inst);
  const c = inst.componentes.find((x) => x.id === componenteId);
  return c ? Math.floor(c.stock / c.cant_por_unidad) : 0;
}
