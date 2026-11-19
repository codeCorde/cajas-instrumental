import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { BUCKET, db, sinError } from "@/lib/db";
import { cargarCatalogo, composicionDe } from "@/lib/datos";
import { cargarFaltantes } from "@/lib/faltantes";
import { cargarPedidos } from "@/lib/pedidos";
import { EXTENSIONES_OK, TAMANO_MAX, extension, slug } from "@/lib/formato";
import { TIPOS_NOTA } from "@/lib/tipos";
import { ordenesReposicionAbiertas, revisarStockEmergencia } from "@/lib/emergencia";
import { agregarPreguntaAviso } from "@/lib/preguntas";

export const dynamic = "force-dynamic";

/**
 * API para que Claude cargue la información que el dueño le dicta o le manda (fotos, planos, programas, máquinas, etapas,
 * stock, pedidos). Protegida con CLAUDE_API_TOKEN (solo servidor). Todo queda con autor «Claude» en el historial y en Novedades.
 * El stock se mueve SOLO por RPC, igual que en la app.
 *
 *   GET  ?que=faltantes | catalogo | pedidos | emergencia | procesos
 *   POST { accion: "ajustar_stock", objetivo, id, delta, motivo?, nota? }
 *        { accion: "armar_instrumental", id }
 *        { accion: "datos", tabla: "instrumentales"|"componentes", id, campos: { maquina?, herramientas?, etapa?, proceso?, descripcion? } }
 *        { accion: "confirmar_cantidad", caja_id, instrumental_id, cant_por_caja }
 *        { accion: "nota", instrumental_id, componente_id?, tipo, texto }
 *        { accion: "crear_pedido", solicitante, items: [{ instrumental_id, caja_id?, componente_id?, cantidad }] }
 *        { accion: "preparar_subida", entidad, entidad_id, nombre, tamano }  → { ruta, url } (PUT del archivo a url)
 *        { accion: "confirmar_subida", entidad, entidad_id, nombre, tamano, ruta }
 *        { accion: "proceso", instrumental_id, componente_id?, nombre, maquina?, minutos_pieza?, minutos_preparacion?, tercerizado?, notas? }
 *        { accion: "minimo", caja_id, minimo }   (stock de emergencia: cajas armadas mínimas)
 *        { accion: "pregunta_aviso", texto }      (sale UNA vez, dentro del próximo aviso programado)
 */
const AUTOR = "Claude";
const UUID = /^[0-9a-f-]{36}$/i;
const CAMPOS_TEXTO = ["maquina", "herramientas", "etapa", "proceso", "descripcion"] as const;
const ENTIDADES = ["instrumental", "componente", "caja"] as const;

function autorizado(req: Request): boolean {
  const esperado = process.env.CLAUDE_API_TOKEN ?? "";
  const dado = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (esperado.length < 32 || dado.length !== esperado.length) return false;
  return timingSafeEqual(Buffer.from(dado), Buffer.from(esperado));
}

const error = (msg: string, status = 400) => NextResponse.json({ ok: false, error: msg }, { status });
const uuid = (v: unknown, nombre: string) => {
  if (typeof v !== "string" || !UUID.test(v)) throw new Error(`${nombre} no es un id válido`);
  return v;
};
async function novedad(titulo: string, detalle?: string | null) {
  await db().from("novedades").insert({ autor: AUTOR, origen: "claude", seccion: "carga", titulo, detalle: detalle ?? null });
}

export async function GET(req: Request) {
  if (!autorizado(req)) return error("No autorizado", 401);
  const que = new URL(req.url).searchParams.get("que") ?? "faltantes";
  if (que === "faltantes") return NextResponse.json({ ok: true, faltantes: await cargarFaltantes() });
  if (que === "catalogo") {
    const cat = await cargarCatalogo();
    return NextResponse.json({
      ok: true,
      cajas: cat.cajas.map((c) => ({
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        piezas: composicionDe(cat, c.id).map(({ inst, cantPorCaja }) => ({
          id: inst.id,
          codigo: inst.codigo,
          nombre: inst.nombre,
          tipo: inst.tipo,
          cant_por_caja: cantPorCaja,
          stock_terminado: inst.stock_terminado,
          unidades_armadas: inst.unidades_armadas,
          maquina: inst.maquina,
          herramientas: inst.herramientas,
          etapa: inst.etapa,
          partes: inst.componentes.map((x) => ({ id: x.id, clase: x.clase, codigo: x.codigo_o_medida, nombre: x.nombre, stock: x.stock, etapa: x.etapa, maquina: x.maquina })),
        })),
      })),
    });
  }
  if (que === "pedidos") return NextResponse.json({ ok: true, pedidos: await cargarPedidos(["pendiente", "en_produccion", "listo"]) });
  if (que === "emergencia") {
    const cajas = sinError(await db().from("cajas").select("id, codigo, nombre, cajas_armadas, stock_minimo").eq("activa", true).order("orden"));
    return NextResponse.json({ ok: true, cajas, ordenes: await ordenesReposicionAbiertas() });
  }
  if (que === "procesos") return NextResponse.json({ ok: true, procesos: sinError(await db().from("procesos").select("*").order("instrumental_id").order("orden")) });
  return error("«que» no válido");
}

export async function POST(req: Request) {
  if (!autorizado(req)) return error("No autorizado", 401);
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return error("El cuerpo tiene que ser JSON");
  }
  try {
    switch (b.accion) {
      case "ajustar_stock": {
        const delta = Number(b.delta);
        if (!Number.isInteger(delta) || delta === 0) throw new Error("delta tiene que ser un entero distinto de 0");
        const r = sinError(
          await db().rpc("ajustar_stock", {
            p_objetivo: String(b.objetivo),
            p_id: uuid(b.id, "id"),
            p_delta: delta,
            p_autor: AUTOR,
            p_motivo: b.motivo === "correccion" ? "correccion" : "carga",
            p_nota: typeof b.nota === "string" ? b.nota.slice(0, 300) : "Cargado por Claude",
            p_caja_id: null,
          }),
        );
        if (b.objetivo === "cajas_armadas") await revisarStockEmergencia(AUTOR);
        return NextResponse.json({ ok: true, stock: r });
      }
      case "proceso": {
        const nombre = String(b.nombre ?? "").trim().slice(0, 80);
        if (!nombre) throw new Error("Falta el nombre del proceso");
        const min = (v: unknown, k: string) => {
          const n = v === undefined || v === null || v === "" ? 0 : Number(String(v).replace(",", "."));
          if (!Number.isFinite(n) || n < 0) throw new Error(`${k} tiene que ser un número ≥ 0`);
          return Math.round(n * 100) / 100;
        };
        const inst = uuid(b.instrumental_id, "instrumental_id");
        const { count } = await db().from("procesos").select("id", { count: "exact", head: true }).eq("instrumental_id", inst);
        sinError(
          await db().from("procesos").insert({
            instrumental_id: inst,
            componente_id: b.componente_id ? uuid(b.componente_id, "componente_id") : null,
            orden: (count ?? 0) + 1,
            nombre,
            maquina: typeof b.maquina === "string" && b.maquina.trim() ? b.maquina.trim().slice(0, 120) : null,
            minutos_pieza: min(b.minutos_pieza, "minutos_pieza"),
            minutos_preparacion: min(b.minutos_preparacion, "minutos_preparacion"),
            tercerizado: b.tercerizado === true,
            notas: typeof b.notas === "string" && b.notas.trim() ? b.notas.trim().slice(0, 500) : null,
          }),
        );
        const r = sinError(await db().from("instrumentales").select("nombre").eq("id", inst).single()) as { nombre: string };
        await novedad(`Proceso «${nombre}» en ${r.nombre}`);
        return NextResponse.json({ ok: true });
      }
      case "pregunta_aviso": {
        const n = await agregarPreguntaAviso(String(b.texto ?? ""), AUTOR);
        return NextResponse.json({ ok: true, pendientes: n });
      }
      case "minimo": {
        const n = Number(b.minimo);
        if (!Number.isInteger(n) || n < 0) throw new Error("minimo tiene que ser un entero ≥ 0");
        const c = sinError(await db().from("cajas").update({ stock_minimo: n }).eq("id", uuid(b.caja_id, "caja_id")).select("nombre").single()) as { nombre: string };
        await novedad(`Stock de emergencia de ${c.nombre}: mínimo ${n}`);
        return NextResponse.json({ ok: true, revision: await revisarStockEmergencia(AUTOR) });
      }
      case "armar_instrumental": {
        const r = sinError(await db().rpc("armar_instrumental", { p_instrumental: uuid(b.id, "id"), p_autor: AUTOR }));
        return NextResponse.json({ ok: true, unidades_armadas: r });
      }
      case "datos": {
        const tabla = b.tabla === "componentes" ? "componentes" : b.tabla === "instrumentales" ? "instrumentales" : null;
        if (!tabla) throw new Error("tabla: instrumentales o componentes");
        const campos = (b.campos ?? {}) as Record<string, unknown>;
        const cambios: Record<string, string | null> = {};
        for (const k of CAMPOS_TEXTO) if (k in campos) cambios[k] = typeof campos[k] === "string" && (campos[k] as string).trim() ? (campos[k] as string).trim().slice(0, 4000) : null;
        if (Object.keys(cambios).length === 0) throw new Error(`campos: alguno de ${CAMPOS_TEXTO.join(", ")}`);
        const r = sinError(await db().from(tabla).update(cambios).eq("id", uuid(b.id, "id")).select("*").single()) as { nombre?: string; codigo_o_medida?: string };
        await novedad(`Datos cargados: ${r.nombre ?? r.codigo_o_medida}`, Object.entries(cambios).map(([k, v]) => `${k}: ${v ?? "—"}`).join(" · "));
        return NextResponse.json({ ok: true });
      }
      case "confirmar_cantidad": {
        const n = Number(b.cant_por_caja);
        if (!Number.isInteger(n) || n < 1) throw new Error("cant_por_caja tiene que ser un entero ≥ 1");
        const inst = uuid(b.instrumental_id, "instrumental_id");
        sinError(await db().from("composicion_caja").update({ cant_por_caja: n }).eq("caja_id", uuid(b.caja_id, "caja_id")).eq("instrumental_id", inst));
        const r = sinError(await db().from("instrumentales").update({ a_confirmar: false }).eq("id", inst).select("nombre").single());
        await novedad(`Cantidad por caja confirmada: ${r.nombre} = ${n}`);
        return NextResponse.json({ ok: true });
      }
      case "nota": {
        const tipo = String(b.tipo ?? "General");
        if (!(TIPOS_NOTA as readonly string[]).includes(tipo)) throw new Error(`tipo: ${TIPOS_NOTA.join(", ")}`);
        const texto = String(b.texto ?? "").trim();
        if (!texto) throw new Error("Falta el texto");
        sinError(
          await db().from("notas").insert({
            instrumental_id: uuid(b.instrumental_id, "instrumental_id"),
            componente_id: b.componente_id ? uuid(b.componente_id, "componente_id") : null,
            tipo,
            texto: texto.slice(0, 2000),
            autor: AUTOR,
          }),
        );
        return NextResponse.json({ ok: true });
      }
      case "crear_pedido": {
        const r = sinError(
          await db().rpc("crear_pedido", { p_solicitante: String(b.solicitante ?? ""), p_items: b.items ?? [], p_origen: "interno", p_firma: null, p_ip: null, p_notas: "Cargado por Claude" }),
        );
        await novedad(`Pedido cargado por Claude: ${(r as { numero: string }).numero}`, `Solicitante: ${b.solicitante}`);
        return NextResponse.json({ ok: true, pedido: r });
      }
      case "preparar_subida": {
        const entidad = String(b.entidad);
        if (!(ENTIDADES as readonly string[]).includes(entidad)) throw new Error(`entidad: ${ENTIDADES.join(", ")}`);
        const id = uuid(b.entidad_id, "entidad_id");
        const nombre = String(b.nombre ?? "");
        if (!EXTENSIONES_OK.includes(extension(nombre))) throw new Error(`Tipo no permitido: ${EXTENSIONES_OK.join(", ")}`);
        if (Number(b.tamano) > TAMANO_MAX) throw new Error("Pesa más de 50 MB");
        const ruta = `taller/${entidad}/${id}/${Date.now()}-${slug(nombre)}`;
        const { data, error: e } = await db().storage.from(BUCKET).createSignedUploadUrl(ruta);
        if (e || !data) throw new Error(e?.message ?? "No se pudo preparar la subida");
        return NextResponse.json({ ok: true, ruta, url: data.signedUrl });
      }
      case "confirmar_subida": {
        const entidad = String(b.entidad);
        if (!(ENTIDADES as readonly string[]).includes(entidad)) throw new Error("entidad no válida");
        const id = uuid(b.entidad_id, "entidad_id");
        const ruta = String(b.ruta ?? "");
        if (!ruta.startsWith(`taller/${entidad}/${id}/`)) throw new Error("Ruta no válida");
        const archivo = String(b.nombre ?? "");
        const tipo = extension(archivo);
        const nombre = archivo.replace(/\.[^.]+$/, "");
        await db().from("archivos").update({ vigente: false }).eq("entidad", entidad).eq("entidad_id", id).eq("nombre", nombre).eq("tipo", tipo);
        sinError(await db().from("archivos").insert({ entidad, entidad_id: id, nombre, tipo, tamano: Number(b.tamano) || 0, storage_path: ruta, subido_por: AUTOR, vigente: true }));
        await novedad(`Archivo subido por Claude: ${archivo}`);
        return NextResponse.json({ ok: true });
      }
      default:
        return error("accion no válida");
    }
  } catch (e) {
    return error(e instanceof Error ? e.message : String(e));
  }
}
