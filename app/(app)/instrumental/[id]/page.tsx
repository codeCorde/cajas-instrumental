import Link from "next/link";
import { notFound } from "next/navigation";
import { db, sinError } from "@/lib/db";
import { archivosDe, cargarCatalogo, usosDe } from "@/lib/datos";
import { listarMovimientos } from "@/lib/historial";
import { completosConComponentes, estadoEnCaja, filasComponentes, nombreComponente, stockCompleto, TIPO_LABEL } from "@/lib/calculos";
import { fecha, fechaHora } from "@/lib/formato";
import { RESULTADO_LABEL, TIPOS_NOTA, type Inspeccion, type Nota } from "@/lib/tipos";
import { Cifra, Compartido, EstadoChip, Etiqueta } from "@/components/Estado";
import ControlStock from "@/components/ControlStock";
import EditorTexto from "@/components/EditorTexto";
import Archivos from "@/components/Archivos";
import FormAccion from "@/components/FormAccion";
import BotonAccion from "@/components/BotonAccion";
import TablaMovimientos from "@/components/TablaMovimientos";
import {
  agregarComponente,
  agregarNota,
  agregarRango,
  armarUnidad,
  borrarComponente,
  borrarInstrumental,
  borrarNota,
  editarComponente,
  editarInstrumental,
  moverComponente,
} from "../acciones";

export default async function FichaInstrumental({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const cat = await cargarCatalogo();
  const inst = cat.porId.get(id);
  if (!inst) notFound();

  const usos = usosDe(cat, id);
  const clase = inst.tipo === "medidas" ? "medida" : "pieza";
  const comps = inst.componentes.filter((c) => c.clase === clase);
  const compIds = comps.map((c) => c.id);
  const [archivos, archivosComp, notas, movimientos, inspecciones] = await Promise.all([
    archivosDe("instrumental", [id]),
    archivosDe("componente", compIds),
    db().from("notas").select("*").eq("instrumental_id", id).order("creado_en", { ascending: false }).then((r) => sinError(r) as Nota[]),
    listarMovimientos({ instrumental: id, limite: 50 }),
    db().from("inspecciones").select("*").eq("instrumental_id", id).order("fecha", { ascending: false }).limit(20).then((r) => sinError(r) as Inspeccion[]),
  ]);
  const filasComp = filasComponentes(inst);
  const est = estadoEnCaja(inst, Math.max(1, ...usos.map((u) => u.cantPorCaja)));
  const palabra = inst.tipo === "medidas" ? "medida" : "pieza";

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-widest text-tenue">
          <Link href={`/instrumental?tipo=${inst.tipo}`} className="hover:underline">
            Instrumental · {TIPO_LABEL[inst.tipo]}
          </Link>{" "}
          / {inst.codigo}
        </p>
        <h1 className="titulo text-4xl">{inst.nombre}</h1>
        {inst.alias && <p className="text-tenue">{inst.alias}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <EstadoChip estado={est.estado} />
          {est.falta && <span className="text-sm text-tenue">{est.falta}</span>}
          <Compartido cajas={usos.map((u) => u.caja.codigo)} />
          {inst.origen === "tercerizado" && <Etiqueta tono="acento">Tercerizado{inst.proveedor ? ` · ${inst.proveedor}` : ""}</Etiqueta>}
          {inst.a_confirmar && <Etiqueta tono="proceso">A confirmar</Etiqueta>}
        </div>
        <p className="text-sm">
          {usos.length === 0 ? (
            <span className="text-falta">No está en ninguna caja.</span>
          ) : (
            <>
              Se usa en:{" "}
              {usos.map((u, n) => (
                <span key={u.caja.id}>
                  {n > 0 && " · "}
                  <Link href={`/cajas/${u.caja.codigo}`} className="underline">
                    {u.caja.nombre}
                  </Link>{" "}
                  <span className="text-tenue">({u.cantPorCaja} por caja)</span>
                </span>
              ))}
            </>
          )}
        </p>
      </div>

      {/* Stock */}
      <section className="card p-4 space-y-4">
        <h2 className="titulo text-2xl">Stock</h2>
        <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
          <Cifra valor={stockCompleto(inst)} label={inst.tipo === "medidas" ? "Juegos completos" : "Stock completo"} />
          {inst.tipo === "simple" && (
            <div>
              <span className="etiqueta">Stock terminado</span>
              <ControlStock objetivo="stock_terminado" id={inst.id} valor={inst.stock_terminado} etiqueta={`Stock terminado de ${inst.nombre}`} />
            </div>
          )}
          {inst.tipo === "complejo" && (
            <>
              <div>
                <span className="etiqueta">Unidades armadas</span>
                <ControlStock objetivo="unidades_armadas" id={inst.id} valor={inst.unidades_armadas} etiqueta={`Unidades armadas de ${inst.nombre}`} />
              </div>
              <div>
                <span className="etiqueta">Con piezas sueltas se arman</span>
                <p className="font-mono text-2xl">{completosConComponentes(inst)}</p>
              </div>
              <BotonAccion
                accion={armarUnidad.bind(null, inst.id)}
                className="btn btn-primario"
                confirmar={`¿Armar 1 "${inst.nombre}"? Se descuentan ${comps.map((c) => `${c.cant_por_unidad}× ${nombreComponente(c)}`).join(", ") || "sus piezas"}.`}
              >
                ⚒ Armar 1 unidad
              </BotonAccion>
            </>
          )}
        </div>
      </section>

      {/* Medidas o piezas */}
      {inst.tipo !== "simple" && (
        <section className="card p-4 space-y-3">
          <h2 className="titulo text-2xl">{inst.tipo === "medidas" ? "Medidas" : "Piezas"}</h2>
          {comps.length === 0 ? (
            <p className="text-sm text-tenue">
              Todavía no cargaste {palabra}s. {inst.tipo === "medidas" ? "Usá «Agregar rango» para cargar varias de una vez." : "Tocá «Agregar pieza»."}
            </p>
          ) : (
            <ul className="divide-y divide-borde">
              {filasComp.map((f, idx) => {
                const c = comps.find((x) => x.id === f.componente.id)!;
                return (
                  <li key={c.id} className="py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-40 flex-1">
                        <p className="font-mono font-semibold">{c.codigo_o_medida}</p>
                        {c.nombre && <p className="text-sm">{c.nombre}</p>}
                        <p className="text-xs text-tenue">
                          {c.cant_por_unidad} por {inst.tipo === "medidas" ? "juego" : "instrumental"} · alcanza {f.alcanza} · faltan {f.faltanProximo} p/ el próximo ·{" "}
                          {f.estado === "ok" ? <span className="text-disponible font-semibold">✓ OK</span> : <span className="text-proceso font-semibold">◐ Fabricar</span>}
                        </p>
                      </div>
                      <ControlStock objetivo="stock" id={c.id} valor={c.stock} etiqueta={`Stock de ${nombreComponente(c)}`} />
                      <div className="flex gap-1">
                        <BotonAccion accion={moverComponente.bind(null, c.id, -1)} className="btn min-h-9 px-2" etiqueta={`Subir ${c.codigo_o_medida}`}>
                          <span className={idx === 0 ? "opacity-30" : ""}>↑</span>
                        </BotonAccion>
                        <BotonAccion accion={moverComponente.bind(null, c.id, 1)} className="btn min-h-9 px-2" etiqueta={`Bajar ${c.codigo_o_medida}`}>
                          <span className={idx === comps.length - 1 ? "opacity-30" : ""}>↓</span>
                        </BotonAccion>
                      </div>
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-acento">
                        Editar, proceso y archivos de {c.codigo_o_medida}
                        {archivosComp.some((a) => a.entidad_id === c.id) && " · 📎"}
                        {c.proceso ? " · 📝" : ""}
                      </summary>
                      <div className="mt-3 space-y-4 rounded border border-borde p-3 bg-superficie-2">
                        <FormAccion accion={editarComponente.bind(null, c.id)} className="grid gap-3 sm:grid-cols-[8rem_1fr_7rem]" limpiar={false}>
                          <label>
                            <span className="etiqueta">{inst.tipo === "medidas" ? "Medida" : "Código"}</span>
                            <input name="codigo_o_medida" defaultValue={c.codigo_o_medida} className="campo font-mono" required />
                          </label>
                          <label>
                            <span className="etiqueta">Nombre</span>
                            <input name="nombre" defaultValue={c.nombre ?? ""} className="campo" />
                          </label>
                          <label>
                            <span className="etiqueta">Por {inst.tipo === "medidas" ? "juego" : "instr."}</span>
                            <input name="cant_por_unidad" type="number" min={1} defaultValue={c.cant_por_unidad} className="campo font-mono" required />
                          </label>
                        </FormAccion>
                        <EditorTexto tabla="componentes" id={c.id} campo="proceso" valor={c.proceso} titulo={`Descripción y proceso de ${c.codigo_o_medida}`} />
                        <div>
                          <h3 className="titulo text-lg mb-1">Archivos de {c.codigo_o_medida}</h3>
                          <Archivos entidad="componente" entidadId={c.id} archivos={archivosComp.filter((a) => a.entidad_id === c.id)} />
                        </div>
                        <BotonAccion
                          accion={borrarComponente.bind(null, c.id)}
                          className="btn btn-peligro text-sm"
                          confirmar={`¿Borrar la ${palabra} ${c.codigo_o_medida}? Se borran también sus archivos.`}
                          ok="Borrada"
                        >
                          Borrar {palabra}
                        </BotonAccion>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="grid gap-3 lg:grid-cols-2 pt-2 border-t border-borde">
            <FormAccion accion={agregarComponente.bind(null, inst.id, clase)} className="grid gap-2 grid-cols-[1fr_1fr_5rem] items-end" textoBoton={`+ Agregar ${palabra}`}>
              <label>
                <span className="etiqueta">{inst.tipo === "medidas" ? "Medida" : "Código"}</span>
                <input name="codigo_o_medida" className="campo font-mono" required placeholder={inst.tipo === "medidas" ? "Ø44" : "1/4"} />
              </label>
              <label>
                <span className="etiqueta">Nombre (opcional)</span>
                <input name="nombre" className="campo" placeholder={inst.tipo === "medidas" ? "" : "Mango"} />
              </label>
              <label>
                <span className="etiqueta">Por {inst.tipo === "medidas" ? "juego" : "instr."}</span>
                <input name="cant_por_unidad" type="number" min={1} defaultValue={1} className="campo font-mono" required />
              </label>
            </FormAccion>
            {inst.tipo === "medidas" && (
              <FormAccion accion={agregarRango.bind(null, inst.id)} className="grid gap-2 grid-cols-[1fr_auto] items-end" textoBoton="+ Agregar rango">
                <label>
                  <span className="etiqueta">Rango rápido</span>
                  <input name="rango" className="campo font-mono" required placeholder="Ø44 a Ø62 de a 2" />
                </label>
              </FormAccion>
            )}
          </div>
        </section>
      )}

      {/* Descripción y procesos */}
      <section className="card p-4 space-y-5">
        <EditorTexto tabla="instrumentales" id={inst.id} campo="descripcion" valor={inst.descripcion} titulo="Descripción" ayuda="Para qué se usa, cómo se reconoce, en qué cajas va…" />
        <EditorTexto tabla="instrumentales" id={inst.id} campo="proceso" valor={inst.proceso} titulo="Procesos de trabajo" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Datos técnicos */}
        <section className="card p-4 space-y-3">
          <h2 className="titulo text-2xl">Datos técnicos</h2>
          <FormAccion accion={editarInstrumental.bind(null, inst.id)} className="grid gap-3 sm:grid-cols-2" limpiar={false}>
            <label>
              <span className="etiqueta">Código</span>
              <input name="codigo" defaultValue={inst.codigo} className="campo font-mono" required />
            </label>
            <label>
              <span className="etiqueta">Tipo</span>
              <select name="tipo" defaultValue={inst.tipo} className="campo">
                <option value="simple">Simple</option>
                <option value="medidas">Medidas</option>
                <option value="complejo">Complejo</option>
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="etiqueta">Nombre</span>
              <input name="nombre" defaultValue={inst.nombre} className="campo" required />
            </label>
            <label className="sm:col-span-2">
              <span className="etiqueta">Alias / otros nombres</span>
              <input name="alias" defaultValue={inst.alias ?? ""} className="campo" />
            </label>
            <label>
              <span className="etiqueta">Material</span>
              <input name="material" defaultValue={inst.material ?? ""} className="campo" placeholder="AISI 420" />
            </label>
            <label>
              <span className="etiqueta">Terminación</span>
              <input name="terminacion" defaultValue={inst.terminacion ?? ""} className="campo" placeholder="Pulido espejo" />
            </label>
            <label>
              <span className="etiqueta">Origen</span>
              <select name="origen" defaultValue={inst.origen} className="campo">
                <option value="propia">Fabricación propia</option>
                <option value="tercerizado">Tercerizado</option>
              </select>
            </label>
            <label>
              <span className="etiqueta">Proveedor (si es tercerizado)</span>
              <input name="proveedor" defaultValue={inst.proveedor ?? ""} className="campo" />
            </label>
            <label className="sm:col-span-2 flex items-center gap-2 font-semibold">
              <input type="checkbox" name="a_confirmar" defaultChecked={inst.a_confirmar} className="w-5 h-5" />
              A confirmar (dato precargado que hay que revisar)
            </label>
          </FormAccion>
        </section>

        {/* Notas */}
        <section className="card p-4 space-y-3">
          <h2 className="titulo text-2xl">Notas</h2>
          <FormAccion accion={agregarNota.bind(null, inst.id, null)} className="grid gap-2 sm:grid-cols-[9rem_1fr]" textoBoton="Agregar nota" ok="Nota agregada">
            <label>
              <span className="etiqueta">Tipo</span>
              <select name="tipo" className="campo" defaultValue="General">
                {TIPOS_NOTA.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="etiqueta">Nota</span>
              <input name="texto" className="campo" required />
            </label>
          </FormAccion>
          {notas.length === 0 ? (
            <p className="text-sm text-tenue">Sin notas.</p>
          ) : (
            <ul className="divide-y divide-borde">
              {notas.map((n) => (
                <li key={n.id} className="py-2 flex gap-3 items-start">
                  <Etiqueta>{n.tipo}</Etiqueta>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{n.texto}</p>
                    <p className="text-xs text-tenue">
                      {n.autor ?? "—"} · {fechaHora(n.creado_en)}
                    </p>
                  </div>
                  <BotonAccion accion={borrarNota.bind(null, n.id)} className="btn min-h-8 px-2 text-xs" confirmar="¿Borrar la nota?" etiqueta="Borrar nota">
                    ✕
                  </BotonAccion>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Archivos */}
      <section className="card p-4 space-y-3">
        <h2 className="titulo text-2xl">Archivos</h2>
        <Archivos entidad="instrumental" entidadId={inst.id} archivos={archivos} />
      </section>

      {/* Calidad */}
      <section className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="titulo text-2xl">Control de calidad</h2>
          <Link href={`/admin/calidad/nueva?entidad=instrumental&id=${inst.id}`} className="btn">
            + Nueva inspección
          </Link>
        </div>
        {inspecciones.length === 0 ? (
          <p className="text-sm text-tenue">Sin inspecciones registradas.</p>
        ) : (
          <ul className="divide-y divide-borde">
            {inspecciones.map((x) => (
              <li key={x.id} className="py-2 flex flex-wrap gap-3 items-center">
                <span className="font-mono text-xs">{fecha(x.fecha)}</span>
                <Link href={`/admin/calidad/${x.id}`} className="font-semibold underline">
                  {RESULTADO_LABEL[x.resultado]}
                </Link>
                <span className="text-sm text-tenue">
                  {x.inspector}
                  {x.cantidad ? ` · ${x.cantidad} u.` : ""}
                  {x.resultado === "no_conforme" && !x.accion_cerrada ? " · acción abierta" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Historial */}
      <section className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="titulo text-2xl">Historial de movimientos</h2>
          <Link href={`/stock/historial?instrumental=${inst.id}`} className="text-sm underline">
            Ver todo
          </Link>
        </div>
        <TablaMovimientos movimientos={movimientos} sinInstrumental />
      </section>

      <div className="border-t border-borde pt-4">
        <BotonAccion
          accion={borrarInstrumental.bind(null, inst.id)}
          className="btn btn-peligro"
          confirmar={`¿Borrar "${inst.nombre}" del catálogo? Se quita de todas las cajas y se borran sus ${palabra}s, notas y archivos. El historial de stock se conserva. No se puede deshacer.`}
        >
          Borrar instrumental
        </BotonAccion>
      </div>
    </div>
  );
}
