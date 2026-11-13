import Link from "next/link";
import { cargarCatalogo, listarPersonas } from "@/lib/datos";
import { listarMovimientos, type FiltroHistorial } from "@/lib/historial";
import { MOTIVO_LABEL } from "@/lib/tipos";
import TablaMovimientos from "@/components/TablaMovimientos";

export default async function HistorialPage({ searchParams }: { searchParams: Promise<FiltroHistorial & Record<string, string>> }) {
  const sp = await searchParams;
  const filtro: FiltroHistorial = { desde: sp.desde, hasta: sp.hasta, caja: sp.caja, instrumental: sp.instrumental, motivo: sp.motivo, autor: sp.autor };
  const [cat, personas, movimientos] = await Promise.all([cargarCatalogo(), listarPersonas(true), listarMovimientos({ ...filtro, limite: 500 })]);
  const csv = new URLSearchParams(Object.entries(filtro).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div className="space-y-5">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-tenue">
          <Link href="/stock" className="hover:underline">
            Stock
          </Link>{" "}
          / Historial
        </p>
        <h1 className="titulo text-4xl">Historial de movimientos</h1>
        <p className="text-sm text-tenue">Cada cambio de stock queda registrado con fecha, persona y motivo. No se puede editar ni borrar.</p>
      </div>

      <form className="card p-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6 items-end" action="/stock/historial">
        <label>
          <span className="etiqueta">Desde</span>
          <input type="date" name="desde" defaultValue={sp.desde} className="campo" />
        </label>
        <label>
          <span className="etiqueta">Hasta</span>
          <input type="date" name="hasta" defaultValue={sp.hasta} className="campo" />
        </label>
        <label>
          <span className="etiqueta">Caja</span>
          <select name="caja" defaultValue={sp.caja ?? ""} className="campo">
            <option value="">Todas</option>
            {cat.cajas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="etiqueta">Instrumental</span>
          <select name="instrumental" defaultValue={sp.instrumental ?? ""} className="campo">
            <option value="">Todos</option>
            {cat.instrumentales.map((i) => (
              <option key={i.id} value={i.id}>
                {i.codigo} · {i.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="etiqueta">Motivo</span>
          <select name="motivo" defaultValue={sp.motivo ?? ""} className="campo">
            <option value="">Todos</option>
            {Object.entries(MOTIVO_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="etiqueta">Persona</span>
          <select name="autor" defaultValue={sp.autor ?? ""} className="campo">
            <option value="">Todas</option>
            {personas.map((p) => (
              <option key={p.id}>{p.nombre}</option>
            ))}
          </select>
        </label>
        <div className="flex gap-2 sm:col-span-3 lg:col-span-6">
          <button className="btn btn-primario">Filtrar</button>
          <Link href="/stock/historial" className="btn">
            Limpiar
          </Link>
          <a href={`/stock/historial/csv${csv ? `?${csv}` : ""}`} className="btn ml-auto">
            ⇩ Exportar CSV
          </a>
        </div>
      </form>

      <section className="card p-4">
        <p className="text-xs text-tenue mb-2">{movimientos.length === 500 ? "Se muestran los últimos 500. Exportá a CSV para ver todo." : `${movimientos.length} movimientos`}</p>
        <TablaMovimientos movimientos={movimientos} />
      </section>
    </div>
  );
}
