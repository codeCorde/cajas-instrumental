import { db, sinError } from "@/lib/db";
import { fechaHora } from "@/lib/formato";
import type { Novedad } from "@/lib/tipos";
import FormAccion from "@/components/FormAccion";
import { agregarNovedad } from "../equipo/acciones";

const ORIGEN: Record<Novedad["origen"], { label: string; clase: string }> = {
  app: { label: "App", clase: "bg-sin-bg text-sin" },
  manual: { label: "Nota", clase: "bg-proceso-bg text-proceso" },
  claude: { label: "Claude", clase: "bg-acento text-acento-texto" },
  sistema: { label: "Versión", clase: "bg-disponible-bg text-disponible" },
};

export default async function NovedadesPage() {
  const novedades = sinError(await db().from("novedades").select("*").order("creado_en", { ascending: false }).order("id", { ascending: false }).limit(300)) as Novedad[];
  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-tenue">Registro de cambios</p>
        <h1 className="titulo text-4xl">Novedades</h1>
        <p className="text-sm text-tenue mt-1">Qué se cambió en la estructura (cajas, instrumental, archivos, pedidos…), quién y cuándo. Los movimientos de stock están en Stock → Historial.</p>
      </div>
      <details className="card p-4">
        <summary className="cursor-pointer font-semibold">+ Escribir una novedad</summary>
        <FormAccion accion={agregarNovedad} className="mt-3 grid gap-3" textoBoton="Publicar">
          <label>
            <span className="etiqueta">Título</span>
            <input name="titulo" className="campo" required />
          </label>
          <label>
            <span className="etiqueta">Detalle</span>
            <textarea name="detalle" className="campo" rows={3} />
          </label>
        </FormAccion>
      </details>
      {novedades.length === 0 ? (
        <p className="card p-6 text-tenue">Todavía no hay novedades.</p>
      ) : (
        <ol className="space-y-2">
          {novedades.map((n) => (
            <li key={n.id} className="card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded px-1.5 py-px text-[10px] font-semibold uppercase ${ORIGEN[n.origen].clase}`}>{ORIGEN[n.origen].label}</span>
                <p className="font-semibold">{n.titulo}</p>
              </div>
              {n.detalle && <p className="text-sm mt-1 whitespace-pre-line">{n.detalle}</p>}
              <p className="text-xs text-tenue mt-1">
                {n.autor} · {fechaHora(n.creado_en)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
