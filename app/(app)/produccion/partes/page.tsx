import Link from "next/link";
import { db, sinError } from "@/lib/db";
import { archivosDe, cargarCatalogo, composicionDe, usosDe } from "@/lib/datos";
import { leerEtapas } from "@/lib/pedidos";
import { componentesDe, nombreComponente, tiemposProcesos } from "@/lib/calculos";
import { fechaHora } from "@/lib/formato";
import { TIPOS_NOTA, type Instrumental, type Nota, type Proceso, type TipoInstrumental } from "@/lib/tipos";
import BotonAccion from "@/components/BotonAccion";
import Archivos from "@/components/Archivos";
import ControlStock from "@/components/ControlStock";
import FormAccion from "@/components/FormAccion";
import { Compartido } from "@/components/Estado";
import TextoFormato from "@/components/TextoFormato";
import { agregarNota } from "../../instrumental/acciones";
import { agregarProceso, borrarProceso, guardarDatosTaller, guardarEtapas } from "../acciones";
import SelectorEtapa from "./SelectorEtapa";

export const dynamic = "force-dynamic";

// Clasificación de la foto "Stock de partes".
const CLASIFICACION: Record<TipoInstrumental, { titulo: string; texto: string }> = {
  complejo: { titulo: "Compleja", texto: "Se conforma de varias partes." },
  simple: { titulo: "Simple", texto: "Es una sola parte." },
  medidas: { titulo: "Set completo", texto: "Son muchas medidas de la misma pieza." },
};

/**
 * 2 · Stock de partes. Elegís una caja → se ven sus piezas → al elegir una pieza aparece su clasificación,
 * cada parte que la conforma con su stock y en qué etapa del proceso está, y abajo los planos 2D / 3D,
 * el programa de mecanizado y los comentarios (mechas, machos, máquina).
 */
export default async function PartesPage({ searchParams }: { searchParams: Promise<{ caja?: string; pieza?: string }> }) {
  const { caja: codCaja, pieza } = await searchParams;
  const [cat, etapas] = await Promise.all([cargarCatalogo(), leerEtapas()]);
  const inst = pieza ? cat.porId.get(pieza) ?? null : null;
  const caja =
    cat.cajas.find((c) => c.codigo === codCaja) ??
    (inst ? usosDe(cat, inst.id)[0]?.caja : undefined) ??
    cat.cajas[0] ??
    null;
  const comp = caja ? composicionDe(cat, caja.id) : [];

  return (
    <div className="space-y-4">
      <nav aria-label="Cajas" className="flex flex-wrap gap-2">
        {cat.cajas.map((c) => (
          <Link key={c.id} href={`/produccion/partes?caja=${c.codigo}`} className={`btn ${c.id === caja?.id ? "btn-primario" : ""}`} aria-current={c.id === caja?.id ? "page" : undefined}>
            {c.nombre}
          </Link>
        ))}
      </nav>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <ul className="card divide-y divide-borde self-start">
          {comp.length === 0 && <li className="p-3 text-sm text-tenue">Esta caja no tiene piezas.</li>}
          {comp.map(({ inst: i }, n) => (
            <li key={i.id}>
              <Link
                href={`/produccion/partes?caja=${caja?.codigo}&pieza=${i.id}`}
                className={`block p-3 ${inst?.id === i.id ? "bg-acento/10 border-l-4 border-acento" : "hover:bg-superficie-2"}`}
                aria-current={inst?.id === i.id ? "true" : undefined}
              >
                <span className="font-mono text-xs text-tenue mr-1">{n + 1}.</span>
                <span className="font-semibold">{i.nombre}</span>
                <span className="block text-xs text-tenue">
                  {CLASIFICACION[i.tipo].titulo}
                  {i.etapa ? ` · ${i.etapa}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {inst ? (
          <DetallePieza inst={inst} etapas={etapas} usos={usosDe(cat, inst.id).map((u) => u.caja.codigo)} />
        ) : (
          <div className="card p-6 text-tenue">Elegí una pieza de la lista para ver sus partes, la etapa de producción, los planos y los comentarios.</div>
        )}
      </div>

      <details className="card p-4 max-w-2xl">
        <summary className="cursor-pointer font-semibold">Editar las etapas del proceso de producción</summary>
        <FormAccion accion={guardarEtapas} className="mt-3 space-y-2" limpiar={false} textoBoton="Guardar etapas">
          <p className="text-sm text-tenue">Una por renglón, en orden. La última se considera «terminada».</p>
          <textarea name="etapas" className="campo font-mono" rows={10} defaultValue={etapas.join("\n")} />
        </FormAccion>
      </details>
    </div>
  );
}

async function DetallePieza({ inst, etapas, usos }: { inst: Instrumental; etapas: string[]; usos: string[] }) {
  const partes = componentesDe(inst) as Instrumental["componentes"];
  const [archivos, archivosPartes, notas, procesos] = await Promise.all([
    archivosDe("instrumental", [inst.id]),
    archivosDe("componente", partes.map((p) => p.id)),
    db().from("notas").select("*").eq("instrumental_id", inst.id).order("creado_en", { ascending: false }).then((r) => sinError(r) as Nota[]),
    db().from("procesos").select("*").eq("instrumental_id", inst.id).order("orden").then((r) => sinError(r) as Proceso[]),
  ]);
  const cl = CLASIFICACION[inst.tipo];

  return (
    <article className="space-y-4 min-w-0">
      <header className="card p-4 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-mono text-xs text-tenue">{inst.codigo}</p>
            <h2 className="titulo text-3xl">
              {inst.nombre} <Compartido cajas={usos} />
            </h2>
            {inst.alias && <p className="text-sm text-tenue">{inst.alias}</p>}
          </div>
          <span className="rounded-full border-2 border-acento px-3 py-1 text-sm font-semibold text-acento">
            {cl.titulo} <span className="font-normal">· {cl.texto}</span>
          </span>
        </div>
        {usos.length > 1 && (
          <p className="text-sm text-proceso">⇄ Pieza compartida entre {usos.join(", ")}: el stock es uno solo; lo que se descuenta acá se descuenta en todas esas cajas.</p>
        )}
        <Link href={`/instrumental/${inst.id}`} className="text-sm underline">
          Abrir la ficha completa del instrumental
        </Link>
      </header>

      {/* Partes y etapa */}
      <section className="card p-4 space-y-3">
        <h3 className="titulo text-2xl">{inst.tipo === "simple" ? "Etapa de producción" : inst.tipo === "medidas" ? "Medidas del set" : "Partes que la conforman"}</h3>
        {inst.tipo === "simple" ? (
          <div className="flex flex-wrap items-center gap-3">
            <SelectorEtapa tabla="instrumentales" id={inst.id} etapa={inst.etapa} etapas={etapas} etiqueta={inst.nombre} />
            <p className="text-sm text-tenue">Las unidades terminadas se cargan en «Stock de piezas terminadas».</p>
          </div>
        ) : partes.length === 0 ? (
          <p className="text-tenue">
            Todavía no tiene {inst.tipo === "medidas" ? "medidas" : "partes"} cargadas.{" "}
            <Link href={`/instrumental/${inst.id}`} className="underline">
              Cargalas en la ficha
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>{inst.tipo === "medidas" ? "Medida" : "Parte"}</th>
                  <th>Etapa del proceso</th>
                  <th className="text-right">Stock</th>
                </tr>
              </thead>
              <tbody>
                {partes.map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono">
                      {nombreComponente(p)}
                      {p.cant_por_unidad > 1 && <span className="block text-xs text-tenue">× {p.cant_por_unidad} por unidad</span>}
                    </td>
                    <td>
                      <SelectorEtapa tabla="componentes" id={p.id} etapa={p.etapa} etapas={etapas} etiqueta={nombreComponente(p)} />
                    </td>
                    <td className="text-right">
                      <ControlStock objetivo="stock" id={p.id} valor={p.stock} etiqueta={`${inst.nombre} ${nombreComponente(p)}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Datos de taller */}
      <section className="card p-4 space-y-3">
        <h3 className="titulo text-2xl">Datos de taller</h3>
        <FormDatos tabla="instrumentales" id={inst.id} maquina={inst.maquina} herramientas={inst.herramientas} titulo={inst.tipo === "simple" ? null : "Pieza completa"} />
        {partes.map((p) => (
          <details key={p.id} className="border-t border-borde pt-2">
            <summary className="cursor-pointer font-mono text-sm">
              {nombreComponente(p)}
              {(p.maquina || p.herramientas) && <span className="text-tenue"> · {[p.maquina, p.herramientas].filter(Boolean).join(" · ")}</span>}
            </summary>
            <div className="mt-2 space-y-3">
              <FormDatos tabla="componentes" id={p.id} maquina={p.maquina} herramientas={p.herramientas} titulo={null} />
              <Archivos entidad="componente" entidadId={p.id} archivos={archivosPartes.filter((a) => a.entidad_id === p.id)} compacto />
            </div>
          </details>
        ))}
      </section>

      {/* Procesos y tiempos */}
      <section className="card p-4 space-y-3">
        <h3 className="titulo text-2xl">Procesos y tiempos de mecanizado</h3>
        <p className="text-sm text-tenue">
          Cada proceso en orden, con su máquina, los minutos por pieza y los de preparación de la máquina. Con esto la app calcula cuántas piezas
          salen por hora (y más adelante, el costo).
        </p>
        {[{ id: null as string | null, nombre: inst.tipo === "simple" ? inst.nombre : "Pieza completa (armado / terminación)" }, ...partes.map((p) => ({ id: p.id as string | null, nombre: nombreComponente(p) }))]
          .map((d) => ({ ...d, lista: procesos.filter((x) => x.componente_id === d.id) }))
          .filter((d) => d.lista.length > 0)
          .map((d) => {
            const t = tiemposProcesos(d.lista);
            return (
              <div key={d.id ?? "pieza"} className="space-y-1">
                <p className="font-semibold">
                  {d.nombre}{" "}
                  <span className="text-sm font-normal text-tenue">
                    · {t.minutosPieza} min por pieza{t.minutosPreparacion ? ` + ${t.minutosPreparacion} min de preparación` : ""}
                    {t.piezasPorHora !== null && <strong className="text-texto"> · ≈ {t.piezasPorHora} piezas por hora</strong>}
                  </span>
                </p>
                <div className="overflow-x-auto">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Proceso</th>
                        <th>Máquina</th>
                        <th className="text-right">Min / pieza</th>
                        <th className="text-right">Preparación</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {d.lista.map((x, i) => (
                        <tr key={x.id}>
                          <td className="font-mono text-tenue">{i + 1}</td>
                          <td>
                            {x.nombre}
                            {x.tercerizado && <span className="ml-1 text-xs text-proceso">⇄ tercerizado</span>}
                            {x.notas && <span className="block text-xs text-tenue">{x.notas}</span>}
                          </td>
                          <td className="text-sm">{x.maquina ?? "—"}</td>
                          <td className="text-right font-mono">{Number(x.minutos_pieza)}</td>
                          <td className="text-right font-mono">{Number(x.minutos_preparacion)}</td>
                          <td className="text-right">
                            <BotonAccion accion={borrarProceso.bind(null, x.id)} className="btn text-sm" confirmar={`¿Borrar el proceso «${x.nombre}»?`}>
                              Borrar
                            </BotonAccion>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        {procesos.length === 0 && <p className="text-sm text-tenue">Todavía no tiene procesos cargados.</p>}
        <details className="border-t border-borde pt-2">
          <summary className="cursor-pointer font-semibold">+ Agregar un proceso</summary>
          <FormAccion accion={agregarProceso.bind(null, inst.id)} className="mt-2 grid gap-2 sm:grid-cols-2" textoBoton="Agregar proceso" ok="Proceso agregado">
            {partes.length > 0 && (
              <label className="sm:col-span-2">
                <span className="etiqueta">¿De qué {inst.tipo === "medidas" ? "medida" : "parte"}?</span>
                <select name="componente_id" className="campo" defaultValue="">
                  <option value="">Pieza completa (armado / terminación)</option>
                  {partes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {nombreComponente(p)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              <span className="etiqueta">Proceso</span>
              <input name="nombre" className="campo" placeholder="Torneado, fresado, roscado, pulido…" required list="procesos-sugeridos" />
              <datalist id="procesos-sugeridos">
                {["Corte", "Torneado", "Fresado", "Agujereado / roscado", "Tratamiento térmico", "Rectificado", "Pulido", "Grabado láser", "Pasivado", "Control de calidad"].map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </label>
            <label>
              <span className="etiqueta">Máquina</span>
              <input name="maquina" className="campo" placeholder="Torno CNC, centro de mecanizado…" />
            </label>
            <label>
              <span className="etiqueta">Minutos por pieza</span>
              <input name="minutos_pieza" className="campo font-mono" inputMode="decimal" placeholder="4,5" />
            </label>
            <label>
              <span className="etiqueta">Minutos de preparación (por lote)</span>
              <input name="minutos_preparacion" className="campo font-mono" inputMode="decimal" placeholder="30" />
            </label>
            <label className="sm:col-span-2">
              <span className="etiqueta">Notas</span>
              <input name="notas" className="campo" placeholder="Programa O1234 · mecha Ø4,2 · se hace de a 4 piezas…" />
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="tercerizado" /> Lo hace un tercero (tercerizado)
            </label>
          </FormAccion>
        </details>
      </section>

      {/* Planos y programas */}
      <section className="card p-4 space-y-3">
        <h3 className="titulo text-2xl">Planos 2D, 3D y programa de mecanizado</h3>
        <p className="text-sm text-tenue">PDF y DWG (2D), STEP / STP (3D) y el código del programa (.txt, .nc, .gcode, .tap) del Bloc de notas.</p>
        <Archivos entidad="instrumental" entidadId={inst.id} archivos={archivos} />
      </section>

      {/* Comentarios */}
      <section className="card p-4 space-y-3">
        <h3 className="titulo text-2xl">Comentarios generales</h3>
        {inst.proceso && (
          <div>
            <h4 className="etiqueta">Proceso de trabajo</h4>
            <TextoFormato texto={inst.proceso} />
          </div>
        )}
        <FormAccion accion={agregarNota.bind(null, inst.id, null)} className="grid gap-2 sm:grid-cols-[10rem_1fr_auto] items-end" textoBoton="Agregar">
          <label>
            <span className="etiqueta">Tipo</span>
            <select name="tipo" className="campo" defaultValue="Herramienta">
              {TIPOS_NOTA.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="etiqueta">Comentario</span>
            <input name="texto" className="campo" placeholder="Ej.: agujero Ø4,2 con mecha HSS y macho M5 · se hizo en el torno CNC" required />
          </label>
        </FormAccion>
        {notas.length === 0 ? (
          <p className="text-sm text-tenue">Sin comentarios todavía.</p>
        ) : (
          <ul className="divide-y divide-borde">
            {notas.map((n) => (
              <li key={n.id} className="py-2 text-sm">
                <span className="font-mono text-xs text-tenue">[{n.tipo}]</span> {n.texto}
                <span className="block text-xs text-tenue">
                  {n.autor} · {fechaHora(n.creado_en)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

function FormDatos({ tabla, id, maquina, herramientas, titulo }: { tabla: "instrumentales" | "componentes"; id: string; maquina: string | null; herramientas: string | null; titulo: string | null }) {
  return (
    <FormAccion accion={guardarDatosTaller.bind(null, tabla, id)} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] items-end" limpiar={false}>
      {titulo && <p className="sm:col-span-3 etiqueta">{titulo}</p>}
      <label>
        <span className="etiqueta">Máquina</span>
        <input name="maquina" className="campo" defaultValue={maquina ?? ""} placeholder="Torno CNC, centro de mecanizado…" />
      </label>
      <label>
        <span className="etiqueta">Mechas / machos / herramientas</span>
        <input name="herramientas" className="campo" defaultValue={herramientas ?? ""} placeholder="Mecha Ø4,2 · macho M5 · fresa Ø6" />
      </label>
    </FormAccion>
  );
}
