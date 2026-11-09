import { exigirAdmin } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { buscarMovimientos, formatearFecha, type FiltrosHistorial } from "@/lib/historial";
import { CAMPO_LABEL, MOTIVO_LABEL } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function HistorialPage({ searchParams }: { searchParams: Promise<FiltrosHistorial> }) {
  await exigirAdmin();
  const filtros = await searchParams;
  const supabase = await crearClienteServidor();
  const [movs, { data: cajas }, { data: instrumentales }, { data: usuarios }] = await Promise.all([
    buscarMovimientos(filtros),
    supabase.from("cajas").select("id, numero, nombre").order("numero"),
    supabase.from("instrumentales").select("id, codigo, nombre, caja_id").order("orden"),
    supabase.from("perfiles").select("id, nombre, email").order("nombre"),
  ]);

  const instrDeCaja = (instrumentales ?? []).filter((i) => !filtros.caja || i.caja_id === filtros.caja);
  const qs = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-tenue">Solo lectura · no se puede editar ni borrar</p>
          <h1 className="titulo text-4xl">Historial de movimientos</h1>
        </div>
        <a href={`/historial/csv${qs ? `?${qs}` : ""}`} className="btn">
          Exportar CSV
        </a>
      </div>

      <form className="card p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6 items-end" method="get">
        <label>
          <span className="etiqueta">Caja</span>
          <select name="caja" defaultValue={filtros.caja ?? ""} className="campo">
            <option value="">Todas</option>
            {(cajas ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.numero} · {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="etiqueta">Instrumental</span>
          <select name="instrumental" defaultValue={filtros.instrumental ?? ""} className="campo">
            <option value="">Todos</option>
            {instrDeCaja.map((i) => (
              <option key={i.id} value={i.id}>
                {i.codigo} {i.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="etiqueta">Usuario</span>
          <select name="usuario" defaultValue={filtros.usuario ?? ""} className="campo">
            <option value="">Todos</option>
            {(usuarios ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre || u.email}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="etiqueta">Desde</span>
          <input type="date" name="desde" defaultValue={filtros.desde ?? ""} className="campo" />
        </label>
        <label>
          <span className="etiqueta">Hasta</span>
          <input type="date" name="hasta" defaultValue={filtros.hasta ?? ""} className="campo" />
        </label>
        <div className="flex gap-2">
          <button className="btn btn-primario flex-1">Filtrar</button>
          <a href="/historial" className="btn">
            Limpiar
          </a>
        </div>
      </form>

      <p className="text-sm text-tenue">
        {movs.length === 500 ? "Mostrando los últimos 500 movimientos (el CSV trae hasta 10.000)." : `${movs.length} movimientos.`}
      </p>

      <div className="card overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Usuario</th>
              <th>Caja</th>
              <th>Instrumental</th>
              <th>Medida / parte</th>
              <th>Campo</th>
              <th className="text-right">Cantidad</th>
              <th className="text-right">Stock result.</th>
              <th>Motivo</th>
              <th>Nota</th>
            </tr>
          </thead>
          <tbody>
            {movs.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center text-tenue py-6">
                  No hay movimientos con esos filtros.
                </td>
              </tr>
            )}
            {movs.map((m) => (
              <tr key={m.id}>
                <td className="font-mono whitespace-nowrap">{formatearFecha(m.creado_en)}</td>
                <td>{m.usuario_nombre ?? "—"}</td>
                <td>{m.caja_nombre ?? "—"}</td>
                <td>{m.instrumental_nombre ?? "—"}</td>
                <td className="font-mono">{m.parte_nombre ?? "—"}</td>
                <td className="whitespace-nowrap">{CAMPO_LABEL[m.campo] ?? m.campo}</td>
                <td className={`text-right font-mono font-semibold ${m.delta > 0 ? "text-disponible" : "text-falta"}`}>
                  {m.delta > 0 ? `+${m.delta}` : m.delta}
                </td>
                <td className="text-right font-mono">{m.stock_resultante}</td>
                <td className="whitespace-nowrap">{MOTIVO_LABEL[m.motivo]}</td>
                <td className="text-tenue">{m.nota ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
