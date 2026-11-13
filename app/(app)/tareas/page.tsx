import Link from "next/link";
import { db, sinError } from "@/lib/db";
import { cargarCatalogo } from "@/lib/datos";
import { fechaHora } from "@/lib/formato";
import type { Prioridad, Tarea } from "@/lib/tipos";
import FormAccion from "@/components/FormAccion";
import BotonAccion from "@/components/BotonAccion";
import { Cifra } from "@/components/Estado";
import { borrarTarea, crearTarea, marcarTarea } from "../equipo/acciones";

const PRIORIDAD: Record<Prioridad, { clase: string; icono: string; orden: number }> = {
  alta: { clase: "bg-falta-bg text-falta", icono: "▲", orden: 0 },
  media: { clase: "bg-proceso-bg text-proceso", icono: "■", orden: 1 },
  baja: { clase: "bg-sin-bg text-sin", icono: "▼", orden: 2 },
};

export default async function TareasPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { estado = "pendientes" } = await searchParams;
  const [cat, tareas] = await Promise.all([cargarCatalogo(), db().from("tareas").select("*").order("creado_en").then((r) => sinError(r) as Tarea[])]);
  const pendientes = tareas.filter((t) => !t.hecha).sort((a, b) => PRIORIDAD[a.prioridad].orden - PRIORIDAD[b.prioridad].orden);
  const hechas = tareas.filter((t) => t.hecha).sort((a, b) => (b.hecha_en ?? "").localeCompare(a.hecha_en ?? ""));
  const visibles = estado === "corregidas" ? hechas : estado === "todas" ? [...pendientes, ...hechas] : pendientes;
  const pct = tareas.length ? Math.round((hechas.length / tareas.length) * 100) : 0;

  return (
    <div className="space-y-5">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-tenue">Aclaraciones de los médicos</p>
        <h1 className="titulo text-4xl">Tareas de mejora</h1>
        <p className="text-sm text-tenue mt-1 max-w-2xl">Cada pedido o comentario para mejorar el instrumental. Marcalo cuando esté corregido: queda quién y cuándo, y aparece en Novedades.</p>
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
          <Cifra valor={pendientes.length} label="Pendientes" clase="text-proceso" />
          <Cifra valor={hechas.length} label="Corregidas" clase="text-disponible" />
          <p className="ml-auto text-sm text-tenue">{pct}% corregido</p>
        </div>
        <div className="h-3 rounded bg-superficie-2 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Tareas corregidas">
          <div className="h-full bg-disponible" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="flex gap-2">
        {(["pendientes", "corregidas", "todas"] as const).map((e) => (
          <Link key={e} href={e === "pendientes" ? "/tareas" : `/tareas?estado=${e}`} className={`btn ${estado === e ? "btn-primario" : ""}`}>
            {e[0].toUpperCase() + e.slice(1)}
          </Link>
        ))}
      </div>

      {visibles.length === 0 ? (
        <p className="card p-6 text-tenue">{estado === "pendientes" ? "No hay tareas pendientes. ✓" : "No hay tareas."}</p>
      ) : (
        <ul className="space-y-2">
          {visibles.map((t) => {
            const inst = t.instrumental_id ? cat.porId.get(t.instrumental_id) : null;
            const caja = t.caja_id ? cat.cajas.find((c) => c.id === t.caja_id) : null;
            return (
              <li key={t.id} className={`card p-3 flex gap-3 items-start ${t.hecha ? "opacity-70" : ""}`}>
                <BotonAccion accion={marcarTarea.bind(null, t.id, !t.hecha)} className={`btn min-h-10 w-10 px-0 shrink-0 ${t.hecha ? "btn-primario" : ""}`} etiqueta={t.hecha ? `Reabrir: ${t.titulo}` : `Marcar corregido: ${t.titulo}`}>
                  {t.hecha ? "✓" : ""}
                </BotonAccion>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORIDAD[t.prioridad].clase}`}>
                      {PRIORIDAD[t.prioridad].icono} {t.prioridad}
                    </span>
                    <p className={`font-semibold ${t.hecha ? "line-through" : ""}`}>{t.titulo}</p>
                  </div>
                  {t.detalle && <p className="text-sm whitespace-pre-line">{t.detalle}</p>}
                  <p className="text-xs text-tenue">
                    {t.medico && `Dr/a. ${t.medico} · `}
                    {caja && `${caja.nombre} · `}
                    {inst && (
                      <>
                        <Link href={`/instrumental/${inst.id}`} className="underline">
                          {inst.nombre}
                        </Link>{" "}
                        ·{" "}
                      </>
                    )}
                    Cargada por {t.creado_por ?? "—"} el {fechaHora(t.creado_en)}
                    {t.hecha && t.hecha_en && ` · ✓ ${t.hecha_por ?? ""} el ${fechaHora(t.hecha_en)}`}
                  </p>
                </div>
                <BotonAccion accion={borrarTarea.bind(null, t.id)} className="btn min-h-8 px-2 text-xs" confirmar={`¿Borrar la tarea "${t.titulo}"?`} etiqueta="Borrar tarea">
                  ✕
                </BotonAccion>
              </li>
            );
          })}
        </ul>
      )}

      <details className="card p-4 max-w-3xl">
        <summary className="cursor-pointer font-semibold">+ Nueva tarea</summary>
        <FormAccion accion={crearTarea} className="mt-4 grid gap-3 sm:grid-cols-2" textoBoton="Agregar tarea">
          <label className="sm:col-span-2">
            <span className="etiqueta">Qué hay que corregir</span>
            <input name="titulo" className="campo" required />
          </label>
          <label className="sm:col-span-2">
            <span className="etiqueta">Detalle</span>
            <textarea name="detalle" className="campo" rows={2} />
          </label>
          <label>
            <span className="etiqueta">Médico/a</span>
            <input name="medico" className="campo" />
          </label>
          <label>
            <span className="etiqueta">Prioridad</span>
            <select name="prioridad" className="campo" defaultValue="media">
              <option value="alta">▲ Alta</option>
              <option value="media">■ Media</option>
              <option value="baja">▼ Baja</option>
            </select>
          </label>
          <label>
            <span className="etiqueta">Caja</span>
            <select name="caja_id" className="campo" defaultValue="">
              <option value="">—</option>
              {cat.cajas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="etiqueta">Instrumental</span>
            <select name="instrumental_id" className="campo" defaultValue="">
              <option value="">—</option>
              {cat.instrumentales.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.codigo} · {i.nombre}
                </option>
              ))}
            </select>
          </label>
        </FormAccion>
      </details>
    </div>
  );
}
