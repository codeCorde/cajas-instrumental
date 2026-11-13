"use server";
import { db, sinError } from "@/lib/db";
import { quienSoy } from "@/lib/sesion-servidor";
import { registrarNovedad } from "@/lib/datos";
import { entero, obligatorio, seguro, texto, textoONull } from "@/lib/acciones";
import type { ResultadoAccion } from "@/components/FormAccion";
import type { TipoInstrumental } from "@/lib/tipos";

export async function crearCaja(fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const codigo = obligatorio(fd, "codigo", "el código").toUpperCase();
    const nombre = obligatorio(fd, "nombre", "el nombre");
    const { data: max } = await db().from("cajas").select("orden").order("orden", { ascending: false }).limit(1).maybeSingle();
    sinError(await db().from("cajas").insert({ codigo, nombre, descripcion: textoONull(fd, "descripcion"), orden: (max?.orden ?? 0) + 1 }));
    await registrarNovedad(yo, "cajas", `Nueva caja: ${nombre}`);
    return { ir: `/cajas/${codigo}` };
  });
}

export async function editarCaja(id: string, fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const codigo = obligatorio(fd, "codigo", "el código").toUpperCase();
    const nombre = obligatorio(fd, "nombre", "el nombre");
    sinError(await db().from("cajas").update({ codigo, nombre, descripcion: textoONull(fd, "descripcion") }).eq("id", id));
    await registrarNovedad(yo, "cajas", `Edición de caja: ${nombre}`);
    return { ir: `/cajas/${codigo}` };
  });
}

export async function archivarCaja(id: string): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const c = sinError(await db().from("cajas").update({ activa: false }).eq("id", id).select("nombre").single());
    await registrarNovedad(yo, "cajas", `Caja archivada: ${c.nombre}`);
    return { ir: "/" };
  });
}

/** Agrega a la caja un instrumental del catálogo o uno nuevo (código + nombre + tipo). */
export async function agregarACaja(cajaId: string, fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const cant = entero(fd, "cant_por_caja", 1);
    let instId = texto(fd, "instrumental_id");
    if (!instId) {
      const tipo = texto(fd, "tipo") as TipoInstrumental;
      if (!["simple", "medidas", "complejo"].includes(tipo)) throw new Error("Elegí el tipo.");
      const nuevo = sinError(
        await db()
          .from("instrumentales")
          .insert({ codigo: obligatorio(fd, "codigo", "el código del instrumental nuevo"), nombre: obligatorio(fd, "nombre", "el nombre del instrumental nuevo"), tipo })
          .select("id, nombre")
          .single(),
      );
      instId = nuevo.id;
      await registrarNovedad(yo, "instrumentales", `Nuevo instrumental: ${nuevo.nombre}`);
    }
    const { data: max } = await db().from("composicion_caja").select("orden").eq("caja_id", cajaId).order("orden", { ascending: false }).limit(1).maybeSingle();
    sinError(await db().from("composicion_caja").insert({ caja_id: cajaId, instrumental_id: instId, cant_por_caja: cant, orden: (max?.orden ?? 0) + 1 }));
    const [{ data: c }, { data: i }] = await Promise.all([
      db().from("cajas").select("nombre").eq("id", cajaId).single(),
      db().from("instrumentales").select("nombre").eq("id", instId).single(),
    ]);
    await registrarNovedad(yo, "cajas", `${i?.nombre} agregado a ${c?.nombre}`, `${cant} por caja`);
  });
}

export async function cambiarCantidadEnCaja(cajaId: string, instId: string, fd: FormData): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    const cant = entero(fd, "cant_por_caja", 1);
    sinError(await db().from("composicion_caja").update({ cant_por_caja: cant }).eq("caja_id", cajaId).eq("instrumental_id", instId));
    const { data: i } = await db().from("instrumentales").select("nombre").eq("id", instId).single();
    await registrarNovedad(yo, "cajas", `Cantidad por caja de ${i?.nombre}: ${cant}`);
  });
}

export async function quitarDeCaja(cajaId: string, instId: string): Promise<ResultadoAccion> {
  return seguro(async () => {
    const yo = await quienSoy();
    sinError(await db().from("composicion_caja").delete().eq("caja_id", cajaId).eq("instrumental_id", instId));
    const [{ data: c }, { data: i }] = await Promise.all([
      db().from("cajas").select("nombre").eq("id", cajaId).single(),
      db().from("instrumentales").select("nombre").eq("id", instId).single(),
    ]);
    await registrarNovedad(yo, "cajas", `${i?.nombre} quitado de ${c?.nombre}`, "Sigue en el catálogo de instrumental.");
  });
}

/** Sube o baja un instrumental en la lista de la caja (renumera el orden). */
export async function moverEnCaja(cajaId: string, instId: string, direccion: -1 | 1): Promise<ResultadoAccion> {
  return seguro(async () => {
    await quienSoy();
    const filas = sinError(await db().from("composicion_caja").select("instrumental_id, orden").eq("caja_id", cajaId).order("orden")) as { instrumental_id: string }[];
    const i = filas.findIndex((f) => f.instrumental_id === instId);
    const j = i + direccion;
    if (i < 0 || j < 0 || j >= filas.length) return;
    [filas[i], filas[j]] = [filas[j], filas[i]];
    await Promise.all(filas.map((f, n) => db().from("composicion_caja").update({ orden: n + 1 }).eq("caja_id", cajaId).eq("instrumental_id", f.instrumental_id)));
  });
}
