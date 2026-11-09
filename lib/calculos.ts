// =============================================================
// Cálculos del control de producción.
// ÚNICO lugar donde vive la lógica que antes estaba en las fórmulas del Excel.
// Funciones puras: no tocan la base ni la interfaz → fáciles de testear.
// =============================================================

export type Tipo = "simple" | "medidas" | "complejo";
export type Estado = "disponible" | "en_proceso" | "falta" | "sin_partes";
export type EstadoCaja = "completa" | "en_proceso" | "no_disponible" | "vacia";

export interface ParteCalc {
  id: string;
  codigo_o_medida: string;
  nombre?: string | null;
  /** Cant. por juego (Medidas) o cant. por instrumental (Complejo) */
  cant_por_unidad: number;
  stock: number;
}

export interface InstrumentalCalc {
  id: string;
  codigo: string;
  nombre: string;
  tipo: Tipo;
  cant_por_caja: number;
  stock_terminado: number;
  unidades_armadas: number;
  partes: ParteCalc[];
}

export interface ResultadoInstrumental {
  estado: Estado;
  stockCompleto: number;
  cajasQueAlcanza: number;
  /** Texto corto de qué falta para UNA caja (null si está disponible) */
  faltaTexto: string | null;
}

export interface ResumenCaja {
  cajasCompletas: number;
  total: number;
  disponibles: number;
  enProceso: number;
  faltan: number;
  sinPartes: number;
  estado: EstadoCaja;
}

const n = (x: number | null | undefined) => (Number.isFinite(x) ? Math.max(0, Math.trunc(x as number)) : 0);

/** Partes válidas para el cálculo (en el Excel, filas sin cantidad se ignoran). */
function partesValidas(i: InstrumentalCalc): ParteCalc[] {
  return (i.partes ?? []).filter((p) => n(p.cant_por_unidad) > 0);
}

export function etiquetaParte(p: ParteCalc): string {
  return p.nombre ? `${p.codigo_o_medida} ${p.nombre}` : p.codigo_o_medida;
}

/** MIN( floor(stock / cant) ) sobre las partes; 0 si no hay partes (igual que el Excel). */
function minJuegos(partes: ParteCalc[]): number {
  if (partes.length === 0) return 0;
  return Math.min(...partes.map((p) => Math.floor(n(p.stock) / n(p.cant_por_unidad))));
}

/**
 * Stock completo:
 *  Simple   → stock_terminado
 *  Medidas  → juegos completos = MIN(floor(stock_medida / cant_por_juego))
 *  Complejo → unidades_armadas + MIN(floor(stock_parte / cant_por_instrumental))
 */
export function stockCompleto(i: InstrumentalCalc): number {
  switch (i.tipo) {
    case "simple":
      return n(i.stock_terminado);
    case "medidas":
      return minJuegos(partesValidas(i));
    case "complejo":
      return n(i.unidades_armadas) + minJuegos(partesValidas(i));
  }
}

/** Cajas que alcanza = floor(stock_completo / cant_por_caja). */
export function cajasQueAlcanza(i: InstrumentalCalc): number {
  const cpc = n(i.cant_por_caja);
  if (cpc <= 0) return 0;
  return Math.floor(stockCompleto(i) / cpc);
}

/** ¿Hay "algo" hecho? (stock > 0, alguna medida/parte con stock, o unidades armadas > 0) */
function hayAlgo(i: InstrumentalCalc): boolean {
  switch (i.tipo) {
    case "simple":
      return n(i.stock_terminado) > 0;
    case "medidas":
      return partesValidas(i).some((p) => n(p.stock) > 0);
    case "complejo":
      return n(i.unidades_armadas) > 0 || partesValidas(i).some((p) => n(p.stock) > 0);
  }
}

/**
 * "Sin partes cargadas": Medidas sin medidas, o Complejo sin partes y sin unidades armadas.
 * (Un complejo con unidades armadas se evalúa normal aunque no tenga partes definidas.)
 */
export function sinPartes(i: InstrumentalCalc): boolean {
  if (i.tipo === "simple") return false;
  if (partesValidas(i).length > 0) return false;
  return i.tipo === "medidas" || n(i.unidades_armadas) === 0;
}

/** Medidas/partes que no alcanzan para UNA caja. */
export function partesQueFaltan(i: InstrumentalCalc): ParteCalc[] {
  const cpc = n(i.cant_por_caja);
  if (i.tipo === "medidas") {
    return partesValidas(i).filter((p) => n(p.stock) < n(p.cant_por_unidad) * cpc);
  }
  if (i.tipo === "complejo") {
    const resto = Math.max(0, cpc - n(i.unidades_armadas));
    if (resto === 0) return [];
    return partesValidas(i).filter((p) => n(p.stock) < n(p.cant_por_unidad) * resto);
  }
  return [];
}

export function evaluarInstrumental(i: InstrumentalCalc): ResultadoInstrumental {
  const sc = stockCompleto(i);
  const cqa = cajasQueAlcanza(i);
  const cpc = n(i.cant_por_caja);

  if (sinPartes(i)) {
    return {
      estado: "sin_partes",
      stockCompleto: sc,
      cajasQueAlcanza: cqa,
      faltaTexto: i.tipo === "medidas" ? "Falta cargar las medidas" : "Falta cargar las partes",
    };
  }
  if (cqa >= 1) {
    return { estado: "disponible", stockCompleto: sc, cajasQueAlcanza: cqa, faltaTexto: null };
  }
  if (!hayAlgo(i)) {
    return { estado: "falta", stockCompleto: sc, cajasQueAlcanza: cqa, faltaTexto: "Sin stock" };
  }

  let faltaTexto: string;
  if (i.tipo === "simple") {
    faltaTexto = `Hay ${sc} de ${cpc} unid. por caja`;
  } else {
    const faltan = partesQueFaltan(i).map(etiquetaParte);
    faltaTexto = faltan.length > 0 ? `Falta: ${faltan.join(", ")}` : "Faltan partes por definir";
    if (i.tipo === "complejo" && n(i.unidades_armadas) > 0) {
      faltaTexto = `Armadas ${n(i.unidades_armadas)} de ${cpc} · ${faltaTexto}`;
    }
  }
  return { estado: "en_proceso", stockCompleto: sc, cajasQueAlcanza: cqa, faltaTexto };
}

/** Cajas completas = MIN(cajas que alcanza) de todos los instrumentales (0 si no hay). */
export function cajasCompletas(instrumentales: InstrumentalCalc[]): number {
  if (instrumentales.length === 0) return 0;
  return Math.min(...instrumentales.map(cajasQueAlcanza));
}

export function resumenCaja(instrumentales: InstrumentalCalc[]): ResumenCaja {
  const evals = instrumentales.map(evaluarInstrumental);
  const cuenta = (e: Estado) => evals.filter((x) => x.estado === e).length;
  const r = {
    cajasCompletas: cajasCompletas(instrumentales),
    total: instrumentales.length,
    disponibles: cuenta("disponible"),
    enProceso: cuenta("en_proceso"),
    faltan: cuenta("falta"),
    sinPartes: cuenta("sin_partes"),
  };
  let estado: EstadoCaja;
  if (r.total === 0) estado = "vacia";
  else if (r.disponibles === r.total) estado = "completa";
  else if (r.disponibles === 0 && r.enProceso === 0) estado = "no_disponible";
  else estado = "en_proceso";
  return { ...r, estado };
}

// -------------------------------------------------------------
// Lista de qué fabricar
// -------------------------------------------------------------

export interface FilaFabricar {
  /** null = fila del instrumental (Simple / unidades a armar de un Complejo) */
  parteId: string | null;
  etiqueta: string;
  /** null = no se puede calcular (sin medidas/partes cargadas) */
  cantidad: number | null;
}

/**
 * Qué hace falta para llegar a `objetivo` cajas completas.
 *  Simple   → max(0, cpc × obj − stock_terminado)
 *  Medidas  → por medida: max(0, cant_por_juego × cpc × obj − stock)
 *  Complejo → unidades = max(0, cpc × obj − unidades_armadas);
 *             por parte: max(0, cant_por_instrumental × unidades − stock_parte)
 */
export function aFabricar(i: InstrumentalCalc, objetivo: number): FilaFabricar[] {
  const obj = n(objetivo);
  const cpc = n(i.cant_por_caja);
  const partes = partesValidas(i);

  if (i.tipo === "simple") {
    return [{ parteId: null, etiqueta: "Terminado", cantidad: Math.max(0, cpc * obj - n(i.stock_terminado)) }];
  }
  if (i.tipo === "medidas") {
    if (partes.length === 0) return [{ parteId: null, etiqueta: "Sin medidas cargadas", cantidad: null }];
    return partes.map((p) => ({
      parteId: p.id,
      etiqueta: etiquetaParte(p),
      cantidad: Math.max(0, n(p.cant_por_unidad) * cpc * obj - n(p.stock)),
    }));
  }
  const unidades = Math.max(0, cpc * obj - n(i.unidades_armadas));
  const filas: FilaFabricar[] = [{ parteId: null, etiqueta: "Unidades a armar", cantidad: unidades }];
  if (partes.length === 0) {
    if (unidades > 0) filas.push({ parteId: null, etiqueta: "Sin partes cargadas", cantidad: null });
    return filas;
  }
  for (const p of partes) {
    filas.push({
      parteId: p.id,
      etiqueta: etiquetaParte(p),
      cantidad: Math.max(0, n(p.cant_por_unidad) * unidades - n(p.stock)),
    });
  }
  return filas;
}

// -------------------------------------------------------------
// Textos y estilos de estado (para que toda la UI use lo mismo)
// -------------------------------------------------------------

export const ESTADO_INFO: Record<Estado, { label: string; icono: string }> = {
  disponible: { label: "Disponible", icono: "✓" },
  en_proceso: { label: "En proceso", icono: "◐" },
  falta: { label: "Falta", icono: "✕" },
  sin_partes: { label: "Sin partes cargadas", icono: "○" },
};

export const ESTADO_CAJA_INFO: Record<EstadoCaja, { label: string; estado: Estado }> = {
  completa: { label: "Caja completa", estado: "disponible" },
  en_proceso: { label: "Caja en proceso", estado: "en_proceso" },
  no_disponible: { label: "Caja no disponible", estado: "falta" },
  vacia: { label: "Sin instrumentales", estado: "sin_partes" },
};
