"use server";
import { db, sinError, BUCKET } from "@/lib/db";
import { quienSoy } from "@/lib/sesion-servidor";
import { registrarNovedad } from "@/lib/datos";
import { entero, obligatorio, seguro, texto, textoONull } from "@/lib/acciones";
import { generarRango } from "@/lib/calculos";
import { TIPOS_NOTA, type TipoInstrumental } from "@/lib/tipos";
import type { ResultadoAccion } from "@/components/FormAccion";
import { armarInstrumental } from "../acciones-stock";

const tipoValido = (t: string): TipoInstrumental => {
  if (t !== "simple" && t !== "medidas" && t !== "complejo") throw new Error("Elegí el tipo.");
  return t;
};

export async function crearInstrumental(fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const i = sinError(
      await db()
        .from("instrumentales")
        .insert({ codigo: obligatorio(fd, "codigo", "el código"), nombre: obligatorio(fd, "nombre", "el nombre"), tipo: tipoValido(texto(fd, "tipo")), orden: 999 })
        .select("id, nombre")
        .single(),
    );
    await registrarNovedad(yo, "instrumentales", `Nuevo instrumental: ${i.nombre}`);
    return { ir: `/instrumental/${i.id}` };
  });
}

export async function editarInstrumental(id: string, fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const origen = texto(fd, "origen") === "tercerizado" ? "tercerizado" : "propia";
    const nuevoTipo = tipoValido(texto(fd, "tipo"));
    const antes = sinError(await db().from("instrumentales").select("tipo, stock_terminado, unidades_armadas").eq("id", id).single());
    if (antes.tipo !== nuevoTipo && (antes.stock_terminado > 0 || antes.unidades_armadas > 0)) {
      throw new Error("Para cambiar el tipo, primero dejá en 0 el stock terminado y las unidades armadas.");
    }
    const datos = {
      codigo: obligatorio(fd, "codigo", "el código"),
      nombre: obligatorio(fd, "nombre", "el nombre"),
      alias: textoONull(fd, "alias"),
      tipo: nuevoTipo,
      material: textoONull(fd, "material"),
      terminacion: textoONull(fd, "terminacion"),
      origen,
      proveedor: origen === "tercerizado" ? textoONull(fd, "proveedor") : null,
      a_confirmar: fd.get("a_confirmar") === "on",
    };
    sinError(await db().from("instrumentales").update(datos).eq("id", id));
    await registrarNovedad(yo, "instrumentales", `Edición: ${datos.nombre}`);
  });
}

/** Guardado automático de descripción / procesos de trabajo (instrumental o componente). */
export async function guardarTexto(tabla: "instrumentales" | "componentes", id: string, campo: "descripcion" | "proceso", valor: string): Promise<ResultadoAccion> {
  if (!["instrumentales", "componentes"].includes(tabla) || !["descripcion", "proceso"].includes(campo)) return { ok: false, error: "Campo no válido" };
  try {
    await quienSoy();
    sinError(await db().from(tabla).update({ [campo]: valor.trim() || null }).eq("id", id));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function borrarInstrumental(id: string): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const i = sinError(await db().from("instrumentales").select("nombre").eq("id", id).single());
    const comps = sinError(await db().from("componentes").select("id").eq("instrumental_id", id)) as { id: string }[];
    const archivos = sinError(
      await db()
        .from("archivos")
        .select("id, storage_path")
        .or(`and(entidad.eq.instrumental,entidad_id.eq.${id})${comps.length ? `,and(entidad.eq.componente,entidad_id.in.(${comps.map((c) => c.id).join(",")}))` : ""}`),
    ) as { id: string; storage_path: string }[];
    if (archivos.length) {
      await db().storage.from(BUCKET).remove(archivos.map((a) => a.storage_path));
      await db().from("archivos").delete().in("id", archivos.map((a) => a.id));
    }
    sinError(await db().from("instrumentales").delete().eq("id", id));
    await registrarNovedad(yo, "instrumentales", `Baja de instrumental: ${i.nombre}`, "Se quitó de todas las cajas; el historial de stock se conserva.");
    return { ir: "/instrumental" };
  });
}

/** "Armar 1 unidad" de un complejo: descuenta las piezas y suma a unidades armadas (RPC). */
export async function armarUnidad(id: string): Promise<ResultadoAccion> {
  const r = await armarInstrumental(id);
  return r.ok ? { ok: true, mensaje: `Armado ✓ Ahora hay ${r.valor} armados` } : { ok: false, error: r.error };
}

// ---------------- notas ----------------
export async function agregarNota(instrumentalId: string, componenteId: string | null, fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const tipo = texto(fd, "tipo");
    if (!(TIPOS_NOTA as readonly string[]).includes(tipo)) throw new Error("Elegí el tipo de nota.");
    sinError(await db().from("notas").insert({ instrumental_id: instrumentalId, componente_id: componenteId, tipo, texto: obligatorio(fd, "texto", "el texto"), autor: yo }));
  });
}

export async function borrarNota(id: string): Promise<ResultadoAccion> {
  return seguro(async () => {
    await quienSoy();
    sinError(await db().from("notas").delete().eq("id", id));
  });
}

// ---------------- componentes (medidas o piezas) ----------------
async function siguienteOrden(instrumentalId: string) {
  const { data } = await db().from("componentes").select("orden").eq("instrumental_id", instrumentalId).order("orden", { ascending: false }).limit(1).maybeSingle();
  return (data?.orden ?? 0) + 1;
}

export async function agregarComponente(instrumentalId: string, clase: "medida" | "pieza", fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const codigo = obligatorio(fd, "codigo_o_medida", clase === "medida" ? "la medida" : "el código de la pieza");
    sinError(
      await db()
        .from("componentes")
        .insert({
          instrumental_id: instrumentalId,
          clase,
          codigo_o_medida: codigo,
          nombre: textoONull(fd, "nombre"),
          cant_por_unidad: entero(fd, "cant_por_unidad", 1),
          orden: await siguienteOrden(instrumentalId),
        }),
    );
    const { data: i } = await db().from("instrumentales").select("nombre").eq("id", instrumentalId).single();
    await registrarNovedad(yo, "componentes", `${clase === "medida" ? "Nueva medida" : "Nueva pieza"} en ${i?.nombre}: ${codigo}`);
  });
}

/** Rango rápido: "Ø44 a Ø62 de a 2". No duplica las medidas que ya están. */
export async function agregarRango(instrumentalId: string, fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const medidas = generarRango(texto(fd, "rango"));
    if (!medidas) throw new Error('No entendí el rango. Escribilo así: "Ø44 a Ø62 de a 2".');
    const existentes = new Set(
      (sinError(await db().from("componentes").select("codigo_o_medida").eq("instrumental_id", instrumentalId).eq("clase", "medida")) as { codigo_o_medida: string }[]).map(
        (c) => c.codigo_o_medida,
      ),
    );
    const nuevas = medidas.filter((m) => !existentes.has(m));
    if (nuevas.length === 0) throw new Error("Esas medidas ya están cargadas.");
    let orden = await siguienteOrden(instrumentalId);
    sinError(await db().from("componentes").insert(nuevas.map((m) => ({ instrumental_id: instrumentalId, clase: "medida", codigo_o_medida: m, cant_por_unidad: 1, orden: orden++ }))));
    const { data: i } = await db().from("instrumentales").select("nombre").eq("id", instrumentalId).single();
    await registrarNovedad(yo, "componentes", `Medidas agregadas en ${i?.nombre}`, nuevas.join(", "));
    return { mensaje: `${nuevas.length} medidas agregadas` };
  });
}

export async function editarComponente(id: string, fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    await quienSoy();
    sinError(
      await db()
        .from("componentes")
        .update({ codigo_o_medida: obligatorio(fd, "codigo_o_medida", "el código"), nombre: textoONull(fd, "nombre"), cant_por_unidad: entero(fd, "cant_por_unidad", 1) })
        .eq("id", id),
    );
  });
}

export async function moverComponente(id: string, direccion: -1 | 1): Promise<ResultadoAccion> {
  return seguro(async () => {
    await quienSoy();
    const c = sinError(await db().from("componentes").select("instrumental_id, clase").eq("id", id).single());
    const filas = sinError(await db().from("componentes").select("id").eq("instrumental_id", c.instrumental_id).eq("clase", c.clase).order("orden").order("codigo_o_medida")) as { id: string }[];
    const i = filas.findIndex((f) => f.id === id);
    const j = i + direccion;
    if (i < 0 || j < 0 || j >= filas.length) return;
    [filas[i], filas[j]] = [filas[j], filas[i]];
    await Promise.all(filas.map((f, n) => db().from("componentes").update({ orden: n + 1 }).eq("id", f.id)));
  });
}

export async function borrarComponente(id: string): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const c = sinError(await db().from("componentes").select("codigo_o_medida, stock, instrumental_id").eq("id", id).single());
    if (c.stock > 0) throw new Error(`Tiene ${c.stock} en stock. Bajalo a 0 antes de borrarlo (así queda en el historial).`);
    const archivos = sinError(await db().from("archivos").select("id, storage_path").eq("entidad", "componente").eq("entidad_id", id)) as { id: string; storage_path: string }[];
    if (archivos.length) {
      await db().storage.from(BUCKET).remove(archivos.map((a) => a.storage_path));
      await db().from("archivos").delete().in("id", archivos.map((a) => a.id));
    }
    sinError(await db().from("componentes").delete().eq("id", id));
    const { data: i } = await db().from("instrumentales").select("nombre").eq("id", c.instrumental_id).single();
    await registrarNovedad(yo, "componentes", `Baja en ${i?.nombre}: ${c.codigo_o_medida}`);
  });
}

// ---------------- bandeja Sin clasificar ----------------
/** Convierte una pieza sin clasificar en instrumental (con sus archivos) y opcionalmente la suma a una caja. */
export async function convertirEnInstrumental(sinId: string, fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const s = sinError(await db().from("sin_clasificar").select("*").eq("id", sinId).single());
    const i = sinError(
      await db()
        .from("instrumentales")
        .insert({ codigo: obligatorio(fd, "codigo", "el código"), nombre: texto(fd, "nombre") || s.nombre, tipo: tipoValido(texto(fd, "tipo")), descripcion: s.nota, a_confirmar: true, orden: 999 })
        .select("id, nombre")
        .single(),
    );
    const cajaId = texto(fd, "caja_id");
    if (cajaId) sinError(await db().from("composicion_caja").insert({ caja_id: cajaId, instrumental_id: i.id, cant_por_caja: 1, orden: 999 }));
    await db().from("archivos").update({ entidad: "instrumental", entidad_id: i.id }).eq("entidad", "sin_clasificar").eq("entidad_id", sinId);
    sinError(await db().from("sin_clasificar").delete().eq("id", sinId));
    await registrarNovedad(yo, "instrumentales", `"${s.nombre}" pasó de Sin clasificar a instrumental: ${i.nombre}`);
    return { ir: `/instrumental/${i.id}` };
  });
}

/** Mueve una pieza sin clasificar como pieza de un instrumental complejo (con sus archivos). */
export async function moverComoPieza(sinId: string, fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const s = sinError(await db().from("sin_clasificar").select("*").eq("id", sinId).single());
    const instId = obligatorio(fd, "instrumental_id", "el instrumental complejo");
    const inst = sinError(await db().from("instrumentales").select("id, nombre, tipo").eq("id", instId).single());
    if (inst.tipo !== "complejo") throw new Error("Solo se puede mover como pieza de un instrumental complejo.");
    const c = sinError(
      await db()
        .from("componentes")
        .insert({ instrumental_id: instId, clase: "pieza", codigo_o_medida: texto(fd, "codigo") || s.nombre, nombre: s.nombre, descripcion: s.nota, orden: await siguienteOrden(instId) })
        .select("id")
        .single(),
    );
    await db().from("archivos").update({ entidad: "componente", entidad_id: c.id }).eq("entidad", "sin_clasificar").eq("entidad_id", sinId);
    sinError(await db().from("sin_clasificar").delete().eq("id", sinId));
    await registrarNovedad(yo, "componentes", `"${s.nombre}" pasó de Sin clasificar a pieza de ${inst.nombre}`);
    return { ir: `/instrumental/${instId}` };
  });
}

export async function agregarSinClasificar(fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    await quienSoy();
    sinError(await db().from("sin_clasificar").insert({ nombre: obligatorio(fd, "nombre", "el nombre"), nota: textoONull(fd, "nota"), caja_id: texto(fd, "caja_id") || null }));
  });
}

export async function borrarSinClasificar(id: string): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const archivos = sinError(await db().from("archivos").select("id, storage_path").eq("entidad", "sin_clasificar").eq("entidad_id", id)) as { id: string; storage_path: string }[];
    if (archivos.length) {
      await db().storage.from(BUCKET).remove(archivos.map((a) => a.storage_path));
      await db().from("archivos").delete().in("id", archivos.map((a) => a.id));
    }
    const s = sinError(await db().from("sin_clasificar").delete().eq("id", id).select("nombre").single());
    await registrarNovedad(yo, "instrumentales", `Borrado de Sin clasificar: ${s.nombre}`);
  });
}
