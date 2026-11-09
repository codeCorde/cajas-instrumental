import Link from "next/link";
import { obtenerPerfil } from "@/lib/auth";
import { diaLegible, esOrigen, horaLegible, listarNovedades } from "@/lib/novedades";
import { ORIGEN_NOVEDAD_LABEL, SECCION_NOVEDAD_LABEL, type Novedad, type OrigenNovedad } from "@/lib/tipos";
import FormAccion from "@/components/FormAccion";
import { agregarNovedad } from "../tareas/acciones";

export const dynamic = "force-dynamic";

const ORIGEN_CLASE: Record<OrigenNovedad, string> = {
  app: "bg-sin-bg text-sin",
  manual: "bg-proceso-bg text-proceso",
  claude: "bg-acento text-acento-texto",
  sistema: "bg-disponible-bg text-disponible",
};
const ORIGEN_AYUDA: Record<OrigenNovedad, string> = {
  app: "Se registró sola al modificar algo en la app",
  manual: "Nota escrita por un admin",
  claude: "Cambio hecho por Claude",
  sistema: "Nueva versión de la app",
};

/** Color del punto de la línea de tiempo según la acción. */
function colorPunto(n: Novedad): string {
  if (n.titulo.startsWith("Baja") || n.titulo.startsWith("Tarea borrada")) return "bg-falta";
  if (n.titulo.startsWith("✓")) return "bg-disponible";
  if (n.titulo.startsWith("Alta") || n.titulo.startsWith("Nueva")) return "bg-acento";
  if (n.origen === "manual") return "bg-proceso";
  return "bg-tenue";
}

export default async function NovedadesPage({ searchParams }: { searchParams: Promise<{ origen?: string }> }) {
  const perfil = await obtenerPerfil();
  const esAdmin = perfil.rol === "admin";
  const { origen } = await searchParams;
  const filtro = esOrigen(origen) ? origen : undefined;
  const novedades = await listarNovedades(filtro);

  // Agrupar por día (hora de Argentina)
  const dias: { dia: string; items: Novedad[] }[] = [];
  for (const n of novedades) {
    const dia = diaLegible(n.creado_en);
    if (dias.at(-1)?.dia !== dia) dias.push({ dia, items: [] });
    dias.at(-1)!.items.push(n);
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-tenue">Registro de cambios · no se edita ni se borra</p>
        <h1 className="titulo text-4xl">Novedades</h1>
        <p className="text-sm text-tenue mt-1">
          Qué se modificó, cuándo y quién: altas, ediciones y bajas de cajas, instrumentales, medidas, planos y{" "}
          <Link href="/tareas" className="underline">tareas</Link>, más las notas del equipo y los cambios de Claude. Los
          movimientos de stock están en {esAdmin ? <Link href="/historial" className="underline">Historial</Link> : "Historial"}.
        </p>
      </div>

      {esAdmin && (
        <details className="card p-4">
          <summary className="cursor-pointer font-semibold select-none">＋ Agregar una nota</summary>
          <FormAccion accion={agregarNovedad} className="mt-4 space-y-3">
            <label className="block">
              <span className="etiqueta">Título *</span>
              <input name="titulo" className="campo" required placeholder="Ej.: Reunión con el Dr. Pérez por la caja de cadera" />
            </label>
            <label className="block">
              <span className="etiqueta">Detalle</span>
              <textarea name="detalle" className="campo min-h-24" placeholder="Qué se decidió, qué hay que tener en cuenta…" />
            </label>
            <button className="btn btn-primario">Guardar nota</button>
          </FormAccion>
        </details>
      )}

      {/* Filtro por origen */}
      <nav aria-label="Filtrar novedades" className="flex flex-wrap gap-2">
        <Link href="/novedades" aria-current={!filtro ? "page" : undefined} className={`btn text-sm ${!filtro ? "btn-primario" : ""}`}>
          Todas
        </Link>
        {(Object.keys(ORIGEN_NOVEDAD_LABEL) as OrigenNovedad[]).map((o) => (
          <Link
            key={o}
            href={`/novedades?origen=${o}`}
            title={ORIGEN_AYUDA[o]}
            aria-current={filtro === o ? "page" : undefined}
            className={`btn text-sm ${filtro === o ? "btn-primario" : ""}`}
          >
            {ORIGEN_NOVEDAD_LABEL[o]}
          </Link>
        ))}
      </nav>

      {dias.length === 0 && <p className="card p-6 text-center text-tenue">No hay novedades con este filtro.</p>}

      {dias.map(({ dia, items }) => (
        <section key={dia} aria-label={dia}>
          <h2 className="font-mono text-xs uppercase tracking-widest text-tenue mb-2 first-letter:uppercase">{dia}</h2>
          <ol className="card divide-y divide-borde">
            {items.map((n) => (
              <li key={n.id} className="flex gap-3 p-3">
                <div className="w-12 shrink-0 pt-0.5 text-right font-mono text-sm text-tenue">{horaLegible(n.creado_en)}</div>
                <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${colorPunto(n)}`} />
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="font-semibold leading-snug">{n.titulo}</p>
                  {n.detalle && <p className="text-sm text-tenue whitespace-pre-line break-words">{n.detalle}</p>}
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-tenue">
                    <span>{n.autor_nombre ?? "—"}</span>
                    <span className={`rounded px-1.5 py-0.5 font-semibold ${ORIGEN_CLASE[n.origen]}`} title={ORIGEN_AYUDA[n.origen]}>
                      {ORIGEN_NOVEDAD_LABEL[n.origen]}
                    </span>
                    <span className="rounded border border-borde px-1.5 py-0.5">{SECCION_NOVEDAD_LABEL[n.seccion] ?? n.seccion}</span>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}

      {novedades.length === 300 && <p className="text-sm text-tenue">Se muestran las últimas 300 novedades.</p>}
    </div>
  );
}
