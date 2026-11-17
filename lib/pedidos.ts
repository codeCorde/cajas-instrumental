import "server-only";
import { db, sinError } from "./db";
import { archivosDe, cargarCatalogo, composicionDe, usosDe } from "./datos";
import { IMAGENES } from "./formato";
import type { EstadoPedido, Pedido } from "./tipos";

const SELECT_PEDIDO = "*, items:pedido_items(*), piezas:pedido_piezas(*), entregas(*, piezas:entrega_piezas(*))";

export async function cargarPedidos(estados: EstadoPedido[], orden: { col: string; asc?: boolean } = { col: "creado_en", asc: true }): Promise<Pedido[]> {
  return sinError(await db().from("pedidos").select(SELECT_PEDIDO).in("estado", estados).order(orden.col, { ascending: orden.asc ?? true })) as Pedido[];
}

export async function pedidoPorId(id: string): Promise<Pedido | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db().from("pedidos").select(SELECT_PEDIDO).eq("id", id).maybeSingle();
  return (data as Pedido) ?? null;
}

export async function pedidoPorToken(token: string): Promise<Pedido | null> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const { data } = await db().from("pedidos").select(SELECT_PEDIDO).eq("token", token).maybeSingle();
  return (data as Pedido) ?? null;
}

/** Lo que ve el solicitante en /pedir: cajas y sus piezas, SIN stock (es una página pública). */
export interface CajaParaPedir {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  fotoId: string | null;
  piezas: { id: string; nombre: string; alias: string | null; tipo: string; compartida: string[]; medidas: { id: string; nombre: string }[] }[];
}

export async function catalogoParaPedir(): Promise<CajaParaPedir[]> {
  const cat = await cargarCatalogo();
  const fotos = await archivosDe("caja", cat.cajas.map((c) => c.id));
  return cat.cajas.map((c) => ({
    id: c.id,
    codigo: c.codigo,
    nombre: c.nombre,
    descripcion: c.descripcion,
    fotoId: fotos.find((a) => a.entidad_id === c.id && a.vigente && IMAGENES.includes(a.tipo))?.id ?? null,
    piezas: composicionDe(cat, c.id).map(({ inst }) => ({
      id: inst.id,
      nombre: inst.nombre,
      alias: inst.alias,
      tipo: inst.tipo,
      compartida: usosDe(cat, inst.id).map((u) => u.caja.nombre).filter((n) => n !== c.nombre),
      medidas: inst.tipo === "medidas" ? inst.componentes.filter((x) => x.clase === "medida").map((x) => ({ id: x.id, nombre: x.codigo_o_medida })) : [],
    })),
  }));
}

/** Etapas del proceso de producción (se editan en Producción → Stock de partes). */
export const ETAPAS_POR_DEFECTO = ["Sin empezar", "Corte", "Torneado", "Fresado", "Agujereado / roscado", "Tratamiento térmico", "Terminación / pulido", "Grabado", "Control de calidad", "Terminada"];

export async function leerEtapas(): Promise<string[]> {
  const { data } = await db().from("config").select("valor").eq("clave", "etapas").maybeSingle();
  return Array.isArray(data?.valor) && data.valor.length ? (data.valor as string[]) : ETAPAS_POR_DEFECTO;
}

/** Nombre de una línea de pedido: «Fresas acetabulares Ø52» si es una medida suelta, «… (set completo)» si es el set entero. */
export function nombreLinea(cat: Awaited<ReturnType<typeof cargarCatalogo>>, instrumentalId: string, componenteId?: string | null): string {
  const inst = cat.porId.get(instrumentalId);
  if (!inst) return "Pieza";
  if (componenteId) return `${inst.nombre} ${inst.componentes.find((c) => c.id === componenteId)?.codigo_o_medida ?? ""}`.trim();
  return inst.tipo === "medidas" ? `${inst.nombre} (set completo)` : inst.nombre;
}

/** Clave secreta del QR de pedidos (/pedir?k=…). La crea la migración 0010; se cambia desde Producción → QR de pedidos. */
export async function clavePedir(): Promise<string | null> {
  const { data } = await db().from("config").select("valor").eq("clave", "pedir").maybeSingle();
  const k = (data?.valor as { clave?: string } | null)?.clave;
  return typeof k === "string" && k.length >= 16 ? k : null;
}
