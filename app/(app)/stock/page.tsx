import Link from "next/link";
import { cargarCatalogo, composicionDe, resumenDe, usosDe } from "@/lib/datos";
import { nombreComponente, planArmadoCaja, stockCompleto, TIPO_LABEL } from "@/lib/calculos";
import type { TipoInstrumental } from "@/lib/tipos";
import { Cifra, Compartido, Etiqueta } from "@/components/Estado";
import ControlStock from "@/components/ControlStock";
import ArmarCaja from "./ArmarCaja";

const ORDEN_TIPO: TipoInstrumental[] = ["complejo", "medidas", "simple"];

export default async function StockPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const cat = await cargarCatalogo();
  const filtro = q.trim().toLowerCase();
  const lista = cat.instrumentales
    .filter((i) => !filtro || `${i.codigo} ${i.nombre} ${i.alias ?? ""}`.toLowerCase().includes(filtro))
    .sort((a, b) => ORDEN_TIPO.indexOf(a.tipo) - ORDEN_TIPO.indexOf(b.tipo) || a.orden - b.orden);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-tenue">Instrumental total</p>
          <h1 className="titulo text-4xl">Stock</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/stock/fabricar" className="btn btn-primario">
            Qué fabricar
          </Link>
          <Link href="/stock/historial" className="btn">
            Historial
          </Link>
        </div>
      </div>

      <p role="note" className="card border-proceso bg-proceso-bg text-proceso p-3 text-sm">
        <strong>⇄ Stock compartido:</strong> varias cajas usan el mismo instrumental. «Se pueden armar» se calcula para cada caja por separado:{" "}
        <strong>no se suma</strong>. Si armás una, baja lo que se puede armar de las otras.
      </p>

      {/* Panel por caja */}
      <section className="grid gap-4 lg:grid-cols-3">
        {cat.cajas.map((caja) => {
          const r = resumenDe(cat, caja);
          const plan = planArmadoCaja(composicionDe(cat, caja.id));
          return (
            <div key={caja.id} className="card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-tenue">{caja.codigo}</p>
                  <h2 className="titulo text-2xl">
                    <Link href={`/cajas/${caja.codigo}`} className="hover:underline">
                      {caja.nombre}
                    </Link>
                  </h2>
                </div>
                <Cifra valor={r.posibles} label="Se pueden armar" clase={r.posibles > 0 ? "text-disponible" : "text-falta"} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="etiqueta mb-0">Armadas en stock</span>
                <ControlStock objetivo="cajas_armadas" id={caja.id} valor={caja.cajas_armadas} etiqueta={`Cajas armadas de ${caja.nombre}`} />
              </div>
              {r.limitante && (
                <p className="text-xs text-tenue">
                  Limita: <strong className="text-texto">{r.limitante.inst.nombre}</strong> (alcanza para {r.limitante.alcanza})
                  {r.limitante.falta ? ` · ${r.limitante.falta}` : ""}
                </p>
              )}
              <ArmarCaja
                cajaId={caja.id}
                nombre={caja.nombre}
                armadas={caja.cajas_armadas}
                ok={plan.ok}
                faltantes={plan.faltantes}
                descuentos={plan.descuentos.map((d) => ({ etiqueta: d.etiqueta, cantidad: d.cantidad, armados: d.campo === "unidades_armadas" }))}
                devoluciones={composicionDe(cat, caja.id).map((c) => ({
                  etiqueta: c.inst.tipo === "complejo" ? `${c.inst.nombre} (vuelve como armado)` : c.inst.nombre,
                  cantidad: c.cantPorCaja,
                }))}
              />
            </div>
          );
        })}
      </section>

      {/* Tabla del catálogo */}
      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b border-borde">
          <h2 className="titulo text-2xl">Catálogo completo</h2>
          <form className="flex gap-2" action="/stock">
            <input name="q" defaultValue={q} className="campo w-64" placeholder="Buscar instrumental" aria-label="Buscar instrumental" />
            <button className="btn">Buscar</button>
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Instrumental</th>
                <th>Tipo</th>
                <th className="text-right">Stock completo</th>
                <th>Cajas (por caja)</th>
                <th className="text-right">Cargar</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((i) => {
                const usos = usosDe(cat, i.id);
                const comps = i.componentes.filter((c) => c.clase === (i.tipo === "medidas" ? "medida" : "pieza"));
                return (
                  <tr key={i.id}>
                    <td>
                      <Link href={`/instrumental/${i.id}`} className="font-semibold hover:underline">
                        {i.nombre}
                      </Link>
                      <p className="font-mono text-xs text-tenue">{i.codigo}</p>
                    </td>
                    <td>{TIPO_LABEL[i.tipo]}</td>
                    <td className="text-right font-mono font-semibold text-lg">{stockCompleto(i)}</td>
                    <td>
                      <div className="flex flex-wrap gap-1 items-center">
                        {usos.length > 1 && <Compartido cajas={usos.map((u) => u.caja.codigo)} />}
                        {usos.map((u) => (
                          <Etiqueta key={u.caja.id}>
                            {u.caja.codigo} ×{u.cantPorCaja}
                          </Etiqueta>
                        ))}
                        {usos.length === 0 && <span className="text-xs text-tenue">—</span>}
                      </div>
                    </td>
                    <td className="text-right">
                      {i.tipo === "simple" && <ControlStock objetivo="stock_terminado" id={i.id} valor={i.stock_terminado} etiqueta={`Stock de ${i.nombre}`} />}
                      {i.tipo === "complejo" && (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-tenue">Armados</span>
                          <ControlStock objetivo="unidades_armadas" id={i.id} valor={i.unidades_armadas} etiqueta={`Unidades armadas de ${i.nombre}`} />
                        </div>
                      )}
                      {i.tipo !== "simple" && (
                        <details className="mt-1 text-left">
                          <summary className="cursor-pointer text-sm text-acento text-right">
                            {comps.length ? `${comps.length} ${i.tipo === "medidas" ? "medidas" : "piezas"}` : `Sin ${i.tipo === "medidas" ? "medidas" : "piezas"} cargadas`}
                          </summary>
                          <ul className="mt-2 space-y-2">
                            {comps.map((c) => (
                              <li key={c.id} className="flex items-center justify-end gap-3">
                                <span className="font-mono text-sm">{nombreComponente(c)}</span>
                                <ControlStock objetivo="stock" id={c.id} valor={c.stock} etiqueta={`Stock de ${i.nombre} ${nombreComponente(c)}`} />
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
