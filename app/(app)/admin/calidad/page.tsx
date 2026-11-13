import Link from "next/link";
import { db, sinError } from "@/lib/db";
import { cargarCatalogo } from "@/lib/datos";
import { nombreInspeccionado, opcionesInspeccion } from "@/lib/calidad";
import { fecha } from "@/lib/formato";
import { RESULTADO_LABEL, type Inspeccion } from "@/lib/tipos";
import { Cifra } from "@/components/Estado";
import { RESULTADO_CLASE } from "./estilos";


export default async function CalidadPage({
  searchParams,
}: {
  searchParams: Promise<{ resultado?: string; instrumental?: string; caja?: string; pedido?: string; desde?: string; hasta?: string; abiertas?: string }>;
}) {
  const sp = await searchParams;
  const cat = await cargarCatalogo();
  let q = db().from("inspecciones").select("*").order("fecha", { ascending: false }).order("creado_en", { ascending: false }).limit(300);
  if (sp.resultado) q = q.eq("resultado", sp.resultado);
  if (sp.instrumental) q = q.eq("instrumental_id", sp.instrumental);
  if (sp.caja) q = q.eq("caja_id", sp.caja);
  if (sp.pedido) q = q.eq("pedido_id", sp.pedido);
  if (sp.desde) q = q.gte("fecha", sp.desde);
  if (sp.hasta) q = q.lte("fecha", sp.hasta);
  if (sp.abiertas) q = q.eq("resultado", "no_conforme").eq("accion_cerrada", false);
  const [lista, opciones, { count: abiertas }] = await Promise.all([
    q.then((r) => sinError(r) as Inspeccion[]),
    opcionesInspeccion(cat),
    db().from("inspecciones").select("id", { count: "exact", head: true }).eq("resultado", "no_conforme").eq("accion_cerrada", false),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-tenue">
            <Link href="/admin" className="hover:underline">
              Administración
            </Link>{" "}
            / Control de calidad
          </p>
          <h1 className="titulo text-4xl">Notas de conformidad</h1>
        </div>
        <Link href="/admin/calidad/nueva" className="btn btn-primario">
          + Nueva inspección
        </Link>
      </div>

      <div className="card p-4 flex flex-wrap items-center gap-8">
        <Cifra valor={abiertas ?? 0} label="No conformidades abiertas" clase={(abiertas ?? 0) > 0 ? "text-falta" : "text-disponible"} />
        {(abiertas ?? 0) > 0 && (
          <Link href="/admin/calidad?abiertas=1" className="btn">
            Ver las abiertas
          </Link>
        )}
      </div>

      <form className="card p-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6 items-end" action="/admin/calidad">
        <label>
          <span className="etiqueta">Resultado</span>
          <select name="resultado" defaultValue={sp.resultado ?? ""} className="campo">
            <option value="">Todos</option>
            {Object.entries(RESULTADO_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="etiqueta">Instrumental</span>
          <select name="instrumental" defaultValue={sp.instrumental ?? ""} className="campo">
            <option value="">Todos</option>
            {opciones.instrumental.map((o) => (
              <option key={o.id} value={o.id}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="etiqueta">Caja</span>
          <select name="caja" defaultValue={sp.caja ?? ""} className="campo">
            <option value="">Todas</option>
            {opciones.caja.map((o) => (
              <option key={o.id} value={o.id}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="etiqueta">Pedido</span>
          <select name="pedido" defaultValue={sp.pedido ?? ""} className="campo">
            <option value="">Todos</option>
            {opciones.pedido.map((o) => (
              <option key={o.id} value={o.id}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="etiqueta">Desde</span>
          <input type="date" name="desde" defaultValue={sp.desde} className="campo" />
        </label>
        <label>
          <span className="etiqueta">Hasta</span>
          <input type="date" name="hasta" defaultValue={sp.hasta} className="campo" />
        </label>
        <div className="flex gap-2 sm:col-span-3 lg:col-span-6">
          <button className="btn btn-primario">Filtrar</button>
          <Link href="/admin/calidad" className="btn">
            Limpiar
          </Link>
        </div>
      </form>

      {lista.length === 0 ? (
        <p className="card p-6 text-tenue">No hay inspecciones con ese filtro.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Inspeccionado</th>
                <th>Inspector</th>
                <th className="text-right">Cant.</th>
                <th>Resultado</th>
                <th>Acción correctiva</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((x) => (
                <tr key={x.id}>
                  <td className="font-mono text-xs">{fecha(x.fecha)}</td>
                  <td>
                    <Link href={`/admin/calidad/${x.id}`} className="font-semibold underline">
                      {nombreInspeccionado(x, opciones)}
                    </Link>
                    {x.lote && <span className="block font-mono text-xs text-tenue">Lote {x.lote}</span>}
                  </td>
                  <td>{x.inspector}</td>
                  <td className="text-right font-mono">{x.cantidad ?? "—"}</td>
                  <td>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${RESULTADO_CLASE[x.resultado]}`}>
                      {x.resultado === "conforme" ? "✓" : x.resultado === "observaciones" ? "◐" : "✕"} {RESULTADO_LABEL[x.resultado]}
                    </span>
                  </td>
                  <td className="text-xs">{x.accion_correctiva ? (x.accion_cerrada ? <span className="text-disponible">✓ Cerrada</span> : <span className="text-falta font-semibold">Abierta</span>) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
