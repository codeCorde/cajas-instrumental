"use client";
import { useMemo, useState } from "react";
import { aFabricar, cajasCompletas } from "@/lib/calculos";
import { aCSV, descargar } from "@/lib/csv";
import type { CajaCompleta } from "@/lib/tipos";

interface Fila {
  clave: string;
  cajaNumero: number;
  caja: string;
  codigo: string;
  instrumental: string;
  parte: string;
  cantidad: number | null;
  origen: string;
  linkCnc: string | null;
  linkPlano: string | null;
  orden: number;
}

type Columna = "caja" | "instrumental" | "parte" | "cantidad" | "origen";

export default function ListaFabricar({ cajas, cajaInicial }: { cajas: CajaCompleta[]; cajaInicial: string }) {
  const [cajaSel, setCajaSel] = useState(cajaInicial);
  const [modo, setModo] = useState<"proxima" | "n">("proxima");
  const [n, setN] = useState(1);
  const [ocultarOk, setOcultarOk] = useState(false);
  const [orden, setOrden] = useState<{ col: Columna; asc: boolean } | null>(null);

  const visibles = cajaSel === "todas" ? cajas : cajas.filter((c) => c.id === cajaSel);

  const filas = useMemo(() => {
    const out: Fila[] = [];
    let k = 0;
    for (const c of visibles) {
      const objetivo = modo === "proxima" ? cajasCompletas(c.instrumentales) + 1 : n;
      for (const i of c.instrumentales) {
        for (const f of aFabricar(i, objetivo)) {
          out.push({
            clave: `${i.id}-${f.parteId ?? f.etiqueta}`,
            cajaNumero: c.numero,
            caja: c.nombre,
            codigo: i.codigo,
            instrumental: `${i.codigo} ${i.nombre}`,
            parte: f.etiqueta,
            cantidad: f.cantidad,
            origen: i.origen === "tercerizado" ? `Tercerizado${i.proveedor ? ` · ${i.proveedor}` : ""}` : "Propio",
            linkCnc: i.link_cnc,
            linkPlano: i.link_2d ?? i.link_3d,
            orden: k++,
          });
        }
      }
    }
    return out;
  }, [visibles, modo, n]);

  const mostradas = useMemo(() => {
    let r = ocultarOk ? filas.filter((f) => f.cantidad !== 0) : filas;
    if (orden) {
      const dir = orden.asc ? 1 : -1;
      r = [...r].sort((a, b) => {
        if (orden.col === "cantidad") return ((a.cantidad ?? -1) - (b.cantidad ?? -1)) * dir;
        if (orden.col === "caja") return (a.cajaNumero - b.cajaNumero || a.orden - b.orden) * dir;
        return a[orden.col].localeCompare(b[orden.col], "es", { numeric: true }) * dir;
      });
    }
    return r;
  }, [filas, ocultarOk, orden]);

  // Piezas a fabricar (las filas "Unidades a armar" son de montaje, no se suman)
  const totalAFabricar = filas.reduce((s, f) => s + (f.parte === "Unidades a armar" ? 0 : f.cantidad ?? 0), 0);

  function ordenarPor(col: Columna) {
    setOrden((o) => (o?.col === col ? (o.asc ? { col, asc: false } : null) : { col, asc: true }));
  }

  function exportar() {
    descargar(
      `a-fabricar-${new Date().toISOString().slice(0, 10)}.csv`,
      aCSV(
        ["Caja", "Instrumental", "Medida/Parte", "Cantidad a fabricar", "Origen", "Programa CNC", "Plano"],
        mostradas.map((f) => [f.caja, f.instrumental, f.parte, f.cantidad === null ? "Sin definir" : f.cantidad === 0 ? "OK" : f.cantidad, f.origen, f.linkCnc, f.linkPlano]),
      ),
    );
  }

  const Th = ({ col, children, derecha }: { col: Columna; children: React.ReactNode; derecha?: boolean }) => (
    <th aria-sort={orden?.col === col ? (orden.asc ? "ascending" : "descending") : "none"} className={derecha ? "text-right" : ""}>
      <button type="button" onClick={() => ordenarPor(col)} className="uppercase tracking-wider hover:text-texto">
        {children} {orden?.col === col ? (orden.asc ? "▲" : "▼") : ""}
      </button>
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-tenue">Lista para el taller</p>
          <h1 className="titulo text-4xl">Qué fabricar</h1>
          <p className="text-sm text-tenue hidden print:block">
            {new Date().toLocaleString("es-AR")} · Objetivo: {modo === "proxima" ? "próxima caja completa" : `${n} cajas`}
          </p>
        </div>
        <div className="no-imprimir flex gap-2">
          <button type="button" className="btn" onClick={() => window.print()}>
            Imprimir
          </button>
          <button type="button" className="btn" onClick={exportar}>
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="no-imprimir card p-4 flex flex-wrap gap-4 items-end">
        <label>
          <span className="etiqueta">Caja</span>
          <select className="campo" value={cajaSel} onChange={(e) => setCajaSel(e.target.value)}>
            <option value="todas">Todas las cajas</option>
            {cajas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.numero} · {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend className="etiqueta">Objetivo</legend>
          <div className="flex flex-wrap items-center gap-3 min-h-11">
            <label className="flex items-center gap-2">
              <input type="radio" name="modo" checked={modo === "proxima"} onChange={() => setModo("proxima")} className="w-5 h-5" />
              Próxima caja completa
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="modo" checked={modo === "n"} onChange={() => setModo("n")} className="w-5 h-5" />
              Llegar a
              <input
                type="number"
                min={1}
                className="campo w-20 font-mono"
                value={n}
                onChange={(e) => {
                  setModo("n");
                  setN(Math.max(1, Math.trunc(Number(e.target.value) || 1)));
                }}
                aria-label="Cantidad de cajas objetivo"
              />
              cajas
            </label>
          </div>
        </fieldset>
        <label className="flex items-center gap-2 min-h-11">
          <input type="checkbox" checked={ocultarOk} onChange={(e) => setOcultarOk(e.target.checked)} className="w-5 h-5" />
          Ocultar lo que está OK
        </label>
        <p className="ml-auto font-mono text-sm">
          Total a fabricar: <strong className="text-xl">{totalAFabricar}</strong> piezas
        </p>
      </div>

      {modo === "proxima" && (
        <ul className="flex flex-wrap gap-2 text-xs text-tenue">
          {visibles.map((c) => (
            <li key={c.id} className="rounded bg-superficie px-2 py-1 border border-borde">
              {c.nombre}: objetivo <strong className="font-mono">{cajasCompletas(c.instrumentales) + 1}</strong> caja(s)
            </li>
          ))}
        </ul>
      )}

      <div className="card overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr>
              <Th col="caja">Caja</Th>
              <Th col="instrumental">Instrumental</Th>
              <Th col="parte">Medida / parte</Th>
              <Th col="cantidad" derecha>
                A fabricar
              </Th>
              <Th col="origen">Origen</Th>
              <th>CNC</th>
              <th>Plano</th>
            </tr>
          </thead>
          <tbody>
            {mostradas.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-tenue py-6">
                  Nada para mostrar.
                </td>
              </tr>
            )}
            {mostradas.map((f) => (
              <tr key={f.clave} className={f.cantidad === 0 ? "text-tenue" : ""}>
                <td className="whitespace-nowrap">
                  <span className="font-mono">{f.cajaNumero}</span> {f.caja}
                </td>
                <td>{f.instrumental}</td>
                <td className="font-mono">{f.parte}</td>
                <td className="text-right font-mono whitespace-nowrap">
                  {f.cantidad === null ? (
                    <span className="text-sin">○ Sin definir</span>
                  ) : f.cantidad === 0 ? (
                    <span className="text-disponible">✓ OK</span>
                  ) : (
                    <strong className="text-lg">{f.cantidad}</strong>
                  )}
                </td>
                <td className="whitespace-nowrap">{f.origen}</td>
                <td>
                  {f.linkCnc ? (
                    <a href={f.linkCnc} target="_blank" rel="noopener noreferrer" className="text-acento underline">
                      CNC ↗
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {f.linkPlano ? (
                    <a href={f.linkPlano} target="_blank" rel="noopener noreferrer" className="text-acento underline">
                      Plano ↗
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
