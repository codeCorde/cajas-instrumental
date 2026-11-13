import "server-only";
import { cache } from "react";
import { db, sinError } from "./db";
import { resumenCaja } from "./calculos";
import type { Apariencia, Archivo, Caja, Componente, Composicion, EntidadArchivo, Instrumental, Persona } from "./tipos";

const ordenarComps = (c: Componente[]) => [...c].sort((a, b) => a.orden - b.orden || a.codigo_o_medida.localeCompare(b.codigo_o_medida, "es", { numeric: true }));

export interface Catalogo {
  cajas: Caja[];
  instrumentales: Instrumental[];
  composicion: Composicion[];
  porId: Map<string, Instrumental>;
}

/** Todo el catálogo (es chico: decenas de instrumentales). Se cachea por pedido. */
export const cargarCatalogo = cache(async (): Promise<Catalogo> => {
  const [cajas, inst, comp] = await Promise.all([
    db().from("cajas").select("*").eq("activa", true).order("orden").order("nombre"),
    db().from("instrumentales").select("*, componentes(*)").order("orden").order("codigo"),
    db().from("composicion_caja").select("*").order("orden"),
  ]);
  const instrumentales = (sinError(inst) as Instrumental[]).map((i) => ({ ...i, componentes: ordenarComps(i.componentes ?? []) }));
  return {
    cajas: sinError(cajas) as Caja[],
    instrumentales,
    composicion: sinError(comp) as Composicion[],
    porId: new Map(instrumentales.map((i) => [i.id, i])),
  };
});

/** Instrumental de una caja, en orden, con su cantidad por caja. */
export function composicionDe(cat: Catalogo, cajaId: string) {
  return cat.composicion
    .filter((c) => c.caja_id === cajaId && cat.porId.has(c.instrumental_id))
    .map((c) => ({ inst: cat.porId.get(c.instrumental_id)!, cantPorCaja: c.cant_por_caja, orden: c.orden }));
}

/** En qué cajas se usa un instrumental y cuántos lleva cada una. */
export function usosDe(cat: Catalogo, instrumentalId: string) {
  return cat.composicion
    .filter((c) => c.instrumental_id === instrumentalId)
    .map((c) => ({ caja: cat.cajas.find((k) => k.id === c.caja_id)!, cantPorCaja: c.cant_por_caja }))
    .filter((u) => u.caja);
}

export function resumenDe(cat: Catalogo, caja: Caja) {
  return resumenCaja(composicionDe(cat, caja.id));
}

export async function cajaPorCodigo(codigo: string): Promise<Caja | null> {
  const cat = await cargarCatalogo();
  return cat.cajas.find((c) => c.codigo.toLowerCase() === codigo.toLowerCase()) ?? null;
}

export async function archivosDe(entidad: EntidadArchivo, ids: string[]): Promise<Archivo[]> {
  if (ids.length === 0) return [];
  const r = await db().from("archivos").select("*").eq("entidad", entidad).in("entidad_id", ids).order("vigente", { ascending: false }).order("creado_en", { ascending: false });
  return sinError(r) as Archivo[];
}

export const APARIENCIA_POR_DEFECTO: Apariencia = { empresa: "Cajas de Instrumental", color: "#1d4f7c", logo_path: null, modo: "auto" };

export const leerApariencia = cache(async (): Promise<Apariencia> => {
  const { data } = await db().from("config").select("valor").eq("clave", "apariencia").maybeSingle();
  return { ...APARIENCIA_POR_DEFECTO, ...((data?.valor as Partial<Apariencia>) ?? {}) };
});

export async function leerConfig<T>(clave: string, porDefecto: T): Promise<T> {
  const { data } = await db().from("config").select("valor").eq("clave", clave).maybeSingle();
  return (data?.valor as T) ?? porDefecto;
}

export async function listarPersonas(incluirInactivas = false): Promise<Persona[]> {
  let q = db().from("personas").select("*").order("nombre");
  if (!incluirInactivas) q = q.eq("activa", true);
  return sinError(await q) as Persona[];
}

/** Registra un cambio de estructura en Novedades (no los de stock: esos quedan en el historial). */
export async function registrarNovedad(autor: string, seccion: string, titulo: string, detalle?: string | null) {
  await db().from("novedades").insert({ autor, origen: "app", seccion, titulo, detalle: detalle ?? null });
}
