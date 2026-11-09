import { ordenarPlanos, type Plano } from "./planos";
import { crearClienteServidor } from "./supabase/server";
import type { Caja, CajaCompleta, Instrumental } from "./tipos";

const SELECT_INSTR = "*, partes(*)";

function ordenar(instrumentales: Instrumental[]): Instrumental[] {
  return [...instrumentales]
    .sort((a, b) => a.orden - b.orden || a.codigo.localeCompare(b.codigo, "es", { numeric: true }))
    .map((i) => ({ ...i, partes: [...(i.partes ?? [])].sort((a, b) => a.orden - b.orden) }));
}

export async function listarCajas(soloActivas = true): Promise<Caja[]> {
  const supabase = await crearClienteServidor();
  let q = supabase.from("cajas").select("*").order("numero");
  if (soloActivas) q = q.eq("activa", true);
  const { data, error } = await q;
  if (error) throw error;
  return data as Caja[];
}

export async function listarCajasCompletas(soloActivas = true): Promise<CajaCompleta[]> {
  const supabase = await crearClienteServidor();
  let q = supabase.from("cajas").select(`*, instrumentales(${SELECT_INSTR})`).order("numero");
  if (soloActivas) q = q.eq("activa", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data as CajaCompleta[]).map((c) => ({ ...c, instrumentales: ordenar(c.instrumentales ?? []) }));
}

export async function obtenerCaja(id: string, conNotas = false): Promise<CajaCompleta | null> {
  const supabase = await crearClienteServidor();
  const sel = conNotas ? `*, instrumentales(*, partes(*), notas(*))` : `*, instrumentales(${SELECT_INSTR})`;
  const { data, error } = await supabase.from("cajas").select(sel).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const caja = data as unknown as CajaCompleta;
  return { ...caja, instrumentales: ordenar(caja.instrumentales ?? []) };
}

export async function obtenerInstrumental(id: string): Promise<(Instrumental & { caja: { id: string; numero: number; nombre: string } }) | null> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("instrumentales")
    .select("*, partes(*), notas(*), caja:cajas(id, numero, nombre)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const i = data as unknown as Instrumental & { caja: { id: string; numero: number; nombre: string } };
  return {
    ...i,
    partes: [...(i.partes ?? [])].sort((a, b) => a.orden - b.orden),
    notas: [...(i.notas ?? [])].sort((a, b) => b.creado_en.localeCompare(a.creado_en)),
  };
}

// ---------------- Planos ----------------

export interface InstrumentalIndice {
  id: string;
  codigo: string;
  nombre: string;
  alias: string | null;
  orden: number;
  planos: Plano[];
}
export interface CajaIndice {
  id: string;
  numero: number;
  nombre: string;
  planosCaja: Plano[];
  instrumentales: InstrumentalIndice[];
}

/** Todas las cajas activas con sus instrumentales y planos (para el índice de planos). */
export async function listarIndicePlanos(): Promise<CajaIndice[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("cajas")
    .select("id, numero, nombre, instrumentales(id, codigo, nombre, alias, orden), planos(*)")
    .eq("activa", true)
    .order("numero");
  if (error) throw error;
  type Fila = { id: string; numero: number; nombre: string; instrumentales: Omit<InstrumentalIndice, "planos">[]; planos: Plano[] };
  return (data as unknown as Fila[]).map((c) => ({
    id: c.id,
    numero: c.numero,
    nombre: c.nombre,
    planosCaja: ordenarPlanos(c.planos.filter((p) => !p.instrumental_id)),
    instrumentales: [...c.instrumentales]
      .sort((a, b) => a.orden - b.orden || a.codigo.localeCompare(b.codigo, "es", { numeric: true }))
      .map((i) => ({ ...i, planos: ordenarPlanos(c.planos.filter((p) => p.instrumental_id === i.id)) })),
  }));
}

export async function listarPlanosInstrumental(instrumentalId: string): Promise<Plano[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("planos").select("*").eq("instrumental_id", instrumentalId);
  if (error) throw error;
  return ordenarPlanos(data as Plano[]);
}

export async function listarPlanosCaja(cajaId: string): Promise<Plano[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("planos").select("*").eq("caja_id", cajaId).is("instrumental_id", null);
  if (error) throw error;
  return ordenarPlanos(data as Plano[]);
}
