import Link from "next/link";
import { obtenerPerfil } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { listarTareas } from "@/lib/novedades";
import { formatearFecha } from "@/lib/historial";
import { PRIORIDAD_LABEL, type Prioridad, type Tarea } from "@/lib/tipos";
import FormAccion from "@/components/FormAccion";
import { borrarTarea, crearTarea, editarTarea, marcarTarea } from "./acciones";

export const dynamic = "force-dynamic";

type Estado = "pendientes" | "corregidas" | "todas";
interface CajaOpcion {
  id: string;
  numero: number;
  nombre: string;
  instrumentales: { id: string; codigo: string; nombre: string; orden: number }[];
}

const PRIORIDAD_CLASE: Record<Prioridad, string> = {
  alta: "bg-falta-bg text-falta",
  media: "bg-proceso-bg text-proceso",
  baja: "bg-sin-bg text-sin",
};
const PRIORIDAD_ICONO: Record<Prioridad, string> = { alta: "▲", media: "■", baja: "▼" };

export default async function TareasPage({ searchParams }: { searchParams: Promise<{ estado?: string; caja?: string }> }) {
  const perfil = await obtenerPerfil();
  const esAdmin = perfil.rol === "admin";
  const params = await searchParams;
  const estado: Estado = params.estado === "corregidas" || params.estado === "todas" ? params.estado : "pendientes";

  const supabase = await crearClienteServidor();
  const [tareas, { data: cajasData }] = await Promise.all([
    listarTareas(),
    supabase.from("cajas").select("id, numero, nombre, instrumentales(id, codigo, nombre, orden)").order("numero"),
  ]);
  const cajas = ((cajasData ?? []) as CajaOpcion[]).map((c) => ({
    ...c,
    instrumentales: [...c.instrumentales].sort((a, b) => a.orden - b.orden || a.codigo.localeCompare(b.codigo, "es", { numeric: true })),
  }));

  const deCaja = params.caja ? tareas.filter((t) => t.caja_id === params.caja) : tareas;
  const pendientes = deCaja.filter((t) => !t.hecha).length;
  const corregidas = deCaja.length - pendientes;
  const visibles = deCaja.filter((t) => (estado === "todas" ? true : estado === "corregidas" ? t.hecha : !t.hecha));
  const pct = deCaja.length ? Math.round((corregidas / deCaja.length) * 100) : 0;

  const enlace = (cambios: Partial<{ estado: Estado; caja: string }>) => {
    const p = new URLSearchParams();
    const e = cambios.estado ?? estado;
    const c = "caja" in cambios ? cambios.caja : params.caja;
    if (e !== "pendientes") p.set("estado", e);
    if (c) p.set("caja", c);
    const s = p.toString();
    return `/tareas${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-tenue">Aclaraciones de los médicos</p>
        <h1 className="titulo text-4xl">Tareas de mejora</h1>
        <p className="text-sm text-tenue mt-1 max-w-2xl">
          Cada pedido o comentario de un médico para mejorar el instrumental. Marcá la casilla cuando esté corregido: queda
          registrado quién lo marcó y cuándo, y aparece en <Link href="/novedades" className="underline">Novedades</Link>.
        </p>
      </div>

      {/* Progreso */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
          <Cifra valor={pendientes} label="Pendientes" clase="text-proceso" />
          <Cifra valor={corregidas} label="Corregidas" clase="text-disponible" />
          <Cifra valor={deCaja.length} label="Total" />
          <p className="ml-auto text-sm text-tenue">{pct}% corregido</p>
        </div>
        <div className="h-3 rounded bg-superficie-2 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Tareas corregidas">
          <div className="h-full bg-disponible transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Nueva tarea */}
      {esAdmin && (
        <details className="card p-4 group" open={tareas.length === 0}>
          <summary className="cursor-pointer font-semibold select-none">＋ Nueva tarea de mejora</summary>
          <FormAccion accion={crearTarea} className="mt-4 grid gap-3 sm:grid-cols-2">
            <CamposTarea cajas={cajas} />
            <div className="sm:col-span-2">
              <button className="btn btn-primario">Agregar tarea</button>
            </div>
          </FormAccion>
        </details>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {(["pendientes", "corregidas", "todas"] as Estado[]).map((e) => (
          <Link
            key={e}
            href={enlace({ estado: e })}
            aria-current={estado === e ? "page" : undefined}
            className={`btn text-sm ${estado === e ? "btn-primario" : ""}`}
          >
            {e === "pendientes" ? `○ Pendientes (${pendientes})` : e === "corregidas" ? `✓ Corregidas (${corregidas})` : "Todas"}
          </Link>
        ))}
        <form method="get" className="flex items-center gap-2 ml-auto">
          {estado !== "pendientes" && <input type="hidden" name="estado" value={estado} />}
          <label className="sr-only" htmlFor="filtro-caja">Caja</label>
          <select id="filtro-caja" name="caja" defaultValue={params.caja ?? ""} className="campo w-auto">
            <option value="">Todas las cajas</option>
            {cajas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.numero} · {c.nombre}
              </option>
            ))}
          </select>
          <button className="btn">Filtrar</button>
        </form>
      </div>

      {/* Lista */}
      {visibles.length === 0 ? (
        <p className="card p-6 text-center text-tenue">
          {tareas.length === 0
            ? "Todavía no hay tareas. Cargá la primera aclaración de un médico con «＋ Nueva tarea de mejora»."
            : estado === "pendientes"
              ? "✓ No hay tareas pendientes."
              : "No hay tareas con este filtro."}
        </p>
      ) : (
        <ul className="space-y-2">
          {visibles.map((t) => (
            <FilaTarea key={t.id} t={t} esAdmin={esAdmin} cajas={cajas} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Cifra({ valor, label, clase = "" }: { valor: number; label: string; clase?: string }) {
  return (
    <div>
      <p className={`font-mono text-3xl font-semibold leading-none ${clase}`}>{valor}</p>
      <p className="text-[11px] uppercase tracking-wider text-tenue mt-1">{label}</p>
    </div>
  );
}

function FilaTarea({ t, esAdmin, cajas }: { t: Tarea; esAdmin: boolean; cajas: CajaOpcion[] }) {
  return (
    <li className={`card p-3 flex gap-3 ${t.hecha ? "opacity-75" : ""}`}>
      {/* Casilla corregido */}
      {esAdmin ? (
        <FormAccion accion={marcarTarea} className="shrink-0">
          <input type="hidden" name="id" value={t.id} />
          <input type="hidden" name="hecha" value={t.hecha ? "0" : "1"} />
          <button
            className={`w-11 h-11 rounded border-2 text-xl font-bold flex items-center justify-center ${
              t.hecha ? "bg-disponible border-disponible text-superficie" : "border-borde hover:border-disponible"
            }`}
            aria-label={t.hecha ? `Desmarcar: ${t.titulo}` : `Marcar como corregida: ${t.titulo}`}
            title={t.hecha ? "Desmarcar (volver a pendiente)" : "Marcar como corregida"}
          >
            {t.hecha ? "✓" : ""}
          </button>
        </FormAccion>
      ) : (
        <span
          className={`shrink-0 w-11 h-11 rounded border-2 text-xl font-bold flex items-center justify-center ${
            t.hecha ? "bg-disponible border-disponible text-superficie" : "border-borde"
          }`}
          aria-label={t.hecha ? "Corregida" : "Pendiente"}
        >
          {t.hecha ? "✓" : ""}
        </span>
      )}

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`font-semibold ${t.hecha ? "line-through" : ""}`}>{t.titulo}</p>
          <span className={`text-xs font-semibold rounded px-1.5 py-0.5 ${PRIORIDAD_CLASE[t.prioridad]}`}>
            {PRIORIDAD_ICONO[t.prioridad]} {PRIORIDAD_LABEL[t.prioridad]}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {t.medico && <span>🩺 {t.medico}</span>}
          {t.caja && (
            <Link href={`/cajas/${t.caja.id}`} className="hover:underline">
              Caja {t.caja.numero} · {t.caja.nombre}
            </Link>
          )}
          {t.instrumental && (
            <Link href={`/planos/${t.instrumental.id}`} className="font-mono hover:underline">
              {t.instrumental.codigo} {t.instrumental.nombre}
            </Link>
          )}
        </div>
        {t.detalle && <p className="text-sm whitespace-pre-line">{t.detalle}</p>}
        <p className="text-xs text-tenue">
          Cargada por {t.creado_por_nombre ?? "—"} · {formatearFecha(t.creado_en)}
          {t.hecha && t.hecha_en && (
            <span className="text-disponible">
              {" "}
              · ✓ Corregida por {t.hecha_por_nombre ?? "—"} · {formatearFecha(t.hecha_en)}
            </span>
          )}
        </p>

        {esAdmin && (
          <details className="pt-1">
            <summary className="cursor-pointer text-xs text-tenue select-none">Editar o borrar</summary>
            <FormAccion accion={editarTarea} className="mt-3 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={t.id} />
              <CamposTarea cajas={cajas} t={t} />
              <div className="sm:col-span-2">
                <button className="btn btn-primario">Guardar cambios</button>
              </div>
            </FormAccion>
            <FormAccion accion={borrarTarea} confirmar={`¿Borrar la tarea «${t.titulo}»? No se puede deshacer.`} className="mt-2">
              <input type="hidden" name="id" value={t.id} />
              <button className="btn btn-peligro text-sm">Borrar tarea</button>
            </FormAccion>
          </details>
        )}
      </div>
    </li>
  );
}

function CamposTarea({ cajas, t }: { cajas: CajaOpcion[]; t?: Tarea }) {
  return (
    <>
      <label className="sm:col-span-2">
        <span className="etiqueta">Qué hay que mejorar *</span>
        <input name="titulo" className="campo" required defaultValue={t?.titulo} placeholder="Ej.: Mango del colocador 2 cm más largo" />
      </label>
      <label>
        <span className="etiqueta">Médico que lo pidió</span>
        <input name="medico" className="campo" defaultValue={t?.medico ?? ""} placeholder="Ej.: Dr. Pérez" />
      </label>
      <label>
        <span className="etiqueta">Prioridad</span>
        <select name="prioridad" className="campo" defaultValue={t?.prioridad ?? "media"}>
          <option value="alta">▲ Alta</option>
          <option value="media">■ Media</option>
          <option value="baja">▼ Baja</option>
        </select>
      </label>
      <label>
        <span className="etiqueta">Caja</span>
        <select name="caja_id" className="campo" defaultValue={t?.caja_id ?? ""}>
          <option value="">— Sin caja —</option>
          {cajas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.numero} · {c.nombre}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="etiqueta">Instrumental</span>
        <select name="instrumental_id" className="campo" defaultValue={t?.instrumental_id ?? ""}>
          <option value="">— Toda la caja / general —</option>
          {cajas.map((c) => (
            <optgroup key={c.id} label={`Caja ${c.numero} · ${c.nombre}`}>
              {c.instrumentales.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.codigo} {i.nombre}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="sm:col-span-2">
        <span className="etiqueta">Detalle</span>
        <textarea name="detalle" className="campo min-h-24" defaultValue={t?.detalle ?? ""} placeholder="Lo que dijo el médico, medidas, contexto de la cirugía…" />
      </label>
    </>
  );
}
