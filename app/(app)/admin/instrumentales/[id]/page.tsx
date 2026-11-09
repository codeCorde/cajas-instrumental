import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { listarPlanosInstrumental, obtenerInstrumental } from "@/lib/datos";
import AdminPlanos from "@/components/AdminPlanos";
import { TIPOS_NOTA } from "@/lib/tipos";
import { formatearFecha } from "@/lib/historial";
import { EtiquetaEjemplo } from "@/components/Estado";
import FormAccion from "@/components/FormAccion";
import SelectTipo from "./SelectTipo";
import {
  agregarNota,
  agregarRangoMedidas,
  borrarInstrumental,
  borrarNota,
  borrarParte,
  guardarInstrumental,
  guardarParte,
  moverParte,
} from "../../acciones";

export const dynamic = "force-dynamic";

function Campo({ name, label, valor, className, placeholder }: { name: string; label: string; valor: string | null; className?: string; placeholder?: string }) {
  return (
    <label className={className ?? "flex-1 min-w-44"}>
      <span className="etiqueta">{label}</span>
      <input name={name} defaultValue={valor ?? ""} className="campo" placeholder={placeholder} />
    </label>
  );
}

export default async function AdminInstrumentalPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdmin();
  const { id } = await params;
  const [i, planos] = await Promise.all([obtenerInstrumental(id), listarPlanosInstrumental(id)]);
  if (!i) notFound();
  const esMedidas = i.tipo === "medidas";
  const nombreParte = esMedidas ? "medida" : "parte";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/admin/cajas/${i.caja.id}`} className="btn px-3" aria-label={`Volver a ${i.caja.nombre}`}>
          ‹
        </Link>
        <div>
          <p className="font-mono text-xs text-tenue">
            CAJA {i.caja.numero} · {i.caja.nombre}
          </p>
          <h1 className="titulo text-4xl">
            {i.codigo} {i.nombre}
          </h1>
        </div>
        {i.ejemplo && <EtiquetaEjemplo />}
        <Link href={`/cajas/${i.caja.id}?i=${i.id}`} className="ml-auto text-sm text-acento hover:underline">
          Ver / cargar stock
        </Link>
        <Link href={`/planos/${i.id}`} className="text-sm text-acento hover:underline">
          Ver planos
        </Link>
      </div>

      {/* ---------- Datos ---------- */}
      <section className="card p-4 space-y-3">
        <h2 className="titulo text-2xl">Datos</h2>
        <FormAccion accion={guardarInstrumental} className="flex flex-wrap gap-3 items-start">
          <input type="hidden" name="id" value={i.id} />
          <Campo name="codigo" label="Código" valor={i.codigo} className="w-28" />
          <Campo name="nombre" label="Nombre" valor={i.nombre} />
          <Campo name="alias" label="Alias" valor={i.alias} />
          <SelectTipo actual={i.tipo} cantPartes={i.partes.length} />
          <label className="w-32">
            <span className="etiqueta">Cant. por caja</span>
            <input name="cant_por_caja" type="number" min={1} defaultValue={i.cant_por_caja} className="campo font-mono" required />
          </label>
          <div className="basis-full" />
          <Campo name="material" label="Material" valor={i.material} />
          <Campo name="terminacion" label="Terminación" valor={i.terminacion} />
          <Campo name="barra" label="Barra / materia prima" valor={i.barra} />
          <div className="basis-full" />
          <label>
            <span className="etiqueta">Origen</span>
            <select name="origen" defaultValue={i.origen} className="campo">
              <option value="propio">Fabricación propia</option>
              <option value="tercerizado">Tercerizado</option>
            </select>
          </label>
          <Campo name="proveedor" label="Proveedor (si es tercerizado)" valor={i.proveedor} />
          <Campo name="foto_url" label="Foto (URL)" valor={i.foto_url} placeholder="https://…" />
          <div className="basis-full" />
          <Campo name="link_2d" label="Planos 2D (Drive)" valor={i.link_2d} placeholder="https://drive.google.com/…" />
          <Campo name="link_3d" label="Planos 3D (Drive)" valor={i.link_3d} placeholder="https://drive.google.com/…" />
          <Campo name="link_cnc" label="Programa CNC (Drive)" valor={i.link_cnc} placeholder="https://drive.google.com/…" />
          <Campo name="link_fotos" label="Fotos (Drive)" valor={i.link_fotos} placeholder="https://drive.google.com/…" />
          <div className="basis-full">
            <button className="btn btn-primario">Guardar datos</button>
          </div>
        </FormAccion>
      </section>

      {/* ---------- Medidas / partes ---------- */}
      {i.tipo !== "simple" && (
        <section className="card p-4 space-y-3">
          <h2 className="titulo text-2xl">{esMedidas ? "Medidas del juego" : "Partes del instrumental"}</h2>
          <p className="text-sm text-tenue">
            {esMedidas
              ? "«Cant. por juego»: cuántas de esa medida lleva un juego (normalmente 1)."
              : "«Cant. por instrumental»: cuántas de esa pieza lleva un instrumental armado."}{" "}
            El stock se carga con + / − desde el detalle de la caja o la carga rápida.
          </p>

          {i.partes.length > 0 && (
            <ul className="divide-y divide-borde">
              {i.partes.map((p, idx) => (
                <li key={p.id} className="py-2 flex flex-wrap items-end gap-2">
                  <div className="flex gap-1">
                    <FormAccion accion={moverParte}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="dir" value="arriba" />
                      <button className="btn px-0 w-11" disabled={idx === 0} aria-label={`Subir ${p.codigo_o_medida}`}>
                        ↑
                      </button>
                    </FormAccion>
                    <FormAccion accion={moverParte}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="dir" value="abajo" />
                      <button className="btn px-0 w-11" disabled={idx === i.partes.length - 1} aria-label={`Bajar ${p.codigo_o_medida}`}>
                        ↓
                      </button>
                    </FormAccion>
                  </div>
                  <FormAccion accion={guardarParte} className="flex flex-1 flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={p.id} />
                    <label className="w-28">
                      <span className="etiqueta">{esMedidas ? "Medida" : "Código"}</span>
                      <input name="codigo_o_medida" defaultValue={p.codigo_o_medida} className="campo font-mono" required />
                    </label>
                    {!esMedidas && (
                      <label className="flex-1 min-w-32">
                        <span className="etiqueta">Nombre</span>
                        <input name="nombre" defaultValue={p.nombre ?? ""} className="campo" />
                      </label>
                    )}
                    <label className="w-28">
                      <span className="etiqueta">{esMedidas ? "Por juego" : "Por instr."}</span>
                      <input name="cant_por_unidad" type="number" min={1} defaultValue={p.cant_por_unidad} className="campo font-mono" required />
                    </label>
                    <label className="flex-1 min-w-32">
                      <span className="etiqueta">Nota</span>
                      <input name="nota" defaultValue={p.nota ?? ""} className="campo" />
                    </label>
                    <span className="font-mono text-sm text-tenue min-h-11 inline-flex items-center">stock {p.stock}</span>
                    <button className="btn">Guardar</button>
                  </FormAccion>
                  <FormAccion
                    accion={borrarParte}
                    confirmar={`¿Borrar ${nombreParte} ${p.codigo_o_medida}${p.stock ? ` (tiene ${p.stock} en stock)` : ""}?`}
                  >
                    <input type="hidden" name="id" value={p.id} />
                    <button className="btn btn-peligro px-3" aria-label={`Borrar ${p.codigo_o_medida}`}>
                      ✕
                    </button>
                  </FormAccion>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded bg-superficie-2 p-3 space-y-3">
            <h3 className="etiqueta">Agregar {nombreParte}</h3>
            <FormAccion accion={guardarParte} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="instrumental_id" value={i.id} />
              <label className="w-28">
                <span className="etiqueta">{esMedidas ? "Medida" : "Código"}</span>
                <input name="codigo_o_medida" className="campo font-mono" placeholder={esMedidas ? "Ø44" : "A"} required />
              </label>
              {!esMedidas && (
                <label className="flex-1 min-w-32">
                  <span className="etiqueta">Nombre</span>
                  <input name="nombre" className="campo" placeholder="Base" />
                </label>
              )}
              <label className="w-28">
                <span className="etiqueta">{esMedidas ? "Por juego" : "Por instr."}</span>
                <input name="cant_por_unidad" type="number" min={1} defaultValue={1} className="campo font-mono" required />
              </label>
              <button className="btn btn-primario">Agregar</button>
            </FormAccion>

            {esMedidas && (
              <>
                <h3 className="etiqueta pt-2">Agregar un rango de medidas</h3>
                <FormAccion accion={agregarRangoMedidas} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="instrumental_id" value={i.id} />
                  <label className="w-20">
                    <span className="etiqueta">Prefijo</span>
                    <input name="prefijo" defaultValue="Ø" className="campo font-mono" />
                  </label>
                  <label className="w-24">
                    <span className="etiqueta">Desde</span>
                    <input name="desde" type="number" step="any" placeholder="44" className="campo font-mono" required />
                  </label>
                  <label className="w-24">
                    <span className="etiqueta">Hasta</span>
                    <input name="hasta" type="number" step="any" placeholder="60" className="campo font-mono" required />
                  </label>
                  <label className="w-24">
                    <span className="etiqueta">De a</span>
                    <input name="paso" type="number" step="any" defaultValue={2} className="campo font-mono" required />
                  </label>
                  <label className="w-28">
                    <span className="etiqueta">Por juego</span>
                    <input name="cant_por_unidad" type="number" min={1} defaultValue={1} className="campo font-mono" />
                  </label>
                  <button className="btn">Agregar rango</button>
                </FormAccion>
              </>
            )}
          </div>
        </section>
      )}

      {/* ---------- Planos ---------- */}
      <AdminPlanos titulo="Planos" planos={planos} cajaId={i.caja.id} cajaNumero={i.caja.numero} instrumentalId={i.id} />

      {/* ---------- Notas ---------- */}
      <section className="card p-4 space-y-3">
        <h2 className="titulo text-2xl">Notas de fabricación</h2>
        <FormAccion accion={agregarNota} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="instrumental_id" value={i.id} />
          <label>
            <span className="etiqueta">Tipo</span>
            <select name="tipo" className="campo" defaultValue="General">
              {TIPOS_NOTA.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="flex-1 min-w-60">
            <span className="etiqueta">Texto</span>
            <textarea name="texto" rows={2} className="campo" required />
          </label>
          <button className="btn btn-primario">Agregar nota</button>
        </FormAccion>
        {(i.notas ?? []).length > 0 && (
          <ul className="space-y-2">
            {(i.notas ?? []).map((n) => (
              <li key={n.id} className="rounded bg-superficie-2 p-3 flex gap-3 items-start">
                <div className="flex-1">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-tenue">
                    {n.tipo} · {formatearFecha(n.creado_en)}
                  </p>
                  <p className="whitespace-pre-line text-sm">{n.texto}</p>
                </div>
                <FormAccion accion={borrarNota} confirmar="¿Borrar esta nota?">
                  <input type="hidden" name="id" value={n.id} />
                  <button className="btn btn-peligro px-3" aria-label="Borrar nota">
                    ✕
                  </button>
                </FormAccion>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-4 border-falta space-y-2">
        <h2 className="titulo text-xl text-falta">Zona peligrosa</h2>
        <FormAccion accion={borrarInstrumental} confirmar={`¿Borrar «${i.codigo} ${i.nombre}» con sus medidas/partes y notas? No se puede deshacer.`}>
          <input type="hidden" name="id" value={i.id} />
          <button className="btn btn-peligro">Borrar instrumental</button>
        </FormAccion>
      </section>
    </div>
  );
}
