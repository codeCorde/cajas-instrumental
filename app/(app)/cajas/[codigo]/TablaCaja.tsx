"use client";
import Link from "next/link";
import { Fragment, useState } from "react";
import { TIPO_LABEL, type Estado } from "@/lib/calculos";
import type { TipoInstrumental } from "@/lib/tipos";
import { Compartido, EstadoChip, Etiqueta } from "@/components/Estado";
import BotonAccion from "@/components/BotonAccion";
import { cambiarCantidadEnCaja, moverEnCaja, quitarDeCaja } from "../acciones";
import { useAviso } from "@/components/Aviso";

export interface FilaTablaCaja {
  n: number;
  id: string;
  codigo: string;
  nombre: string;
  alias: string | null;
  tipo: TipoInstrumental;
  cantPorCaja: number;
  completo: number;
  alcanza: number;
  estado: Estado;
  falta: string | null;
  armadas: number;
  aConfirmar: boolean;
  otrasCajas: string[];
  sub: { id: string; nombre: string; cant: number; stock: number; alcanza: number; faltan: number; estado: "ok" | "fabricar" }[];
}

/** Tabla principal de la caja (como la hoja "Caja X" del Excel), con sub-tabla de medidas o piezas y edición de la composición. */
export default function TablaCaja({ cajaId, filas }: { cajaId: string; filas: FilaTablaCaja[] }) {
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const [editar, setEditar] = useState(false);
  const toggle = (id: string) =>
    setAbiertas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="card overflow-x-auto">
      <div className="flex items-center justify-between gap-2 p-3 border-b border-borde">
        <p className="text-sm text-tenue">Tocá ▸ para ver las medidas o piezas.</p>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={editar} onChange={(e) => setEditar(e.target.checked)} className="w-5 h-5" />
          Editar composición
        </label>
      </div>
      <table className="tabla">
        <thead>
          <tr>
            <th className="w-8">N°</th>
            <th>Instrumental</th>
            <th>Tipo</th>
            <th className="text-right">Por caja</th>
            <th className="text-right">Stock completo</th>
            <th className="text-right">Cajas que alcanza</th>
            <th>Estado</th>
            <th>Qué falta</th>
            {editar && <th className="text-right">Editar</th>}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, idx) => {
            const abierta = abiertas.has(f.id);
            const tieneSub = f.tipo !== "simple";
            return (
              <Fragment key={f.id}>
                <tr className={abierta ? "bg-superficie-2" : undefined}>
                  <td className="font-mono text-tenue">{f.n}</td>
                  <td>
                    <div className="flex items-start gap-2">
                      {tieneSub ? (
                        <button
                          type="button"
                          onClick={() => toggle(f.id)}
                          className="font-mono text-tenue hover:text-texto w-5 shrink-0"
                          aria-expanded={abierta}
                          aria-label={`${abierta ? "Ocultar" : "Ver"} ${f.tipo === "medidas" ? "medidas" : "piezas"} de ${f.nombre}`}
                        >
                          {abierta ? "▾" : "▸"}
                        </button>
                      ) : (
                        <span className="w-5 shrink-0" />
                      )}
                      <div>
                        <Link href={`/instrumental/${f.id}`} className="font-semibold hover:underline">
                          {f.nombre}
                        </Link>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-xs text-tenue">{f.codigo}</span>
                          {f.alias && <span className="text-xs text-tenue">· {f.alias}</span>}
                          <Compartido cajas={f.otrasCajas} />
                          {f.aConfirmar && <Etiqueta tono="proceso">A confirmar</Etiqueta>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>{TIPO_LABEL[f.tipo]}</td>
                  <td className="text-right font-mono">{f.cantPorCaja}</td>
                  <td className="text-right font-mono">
                    {f.completo}
                    {f.tipo === "complejo" && f.armadas > 0 && <span className="block text-[11px] text-tenue">{f.armadas} armados</span>}
                  </td>
                  <td className="text-right font-mono font-semibold">{f.alcanza}</td>
                  <td>
                    <EstadoChip estado={f.estado} chico />
                  </td>
                  <td className="text-tenue text-xs max-w-56">{f.falta ?? "—"}</td>
                  {editar && (
                    <td className="text-right">
                      <EditarFila cajaId={cajaId} f={f} primero={idx === 0} ultimo={idx === filas.length - 1} />
                    </td>
                  )}
                </tr>
                {abierta && (
                  <tr className="bg-superficie-2">
                    <td />
                    <td colSpan={editar ? 8 : 7} className="pt-0">
                      {f.sub.length === 0 ? (
                        <p className="text-sm text-tenue py-2">
                          Todavía no cargaste {f.tipo === "medidas" ? "medidas" : "piezas"}.{" "}
                          <Link href={`/instrumental/${f.id}`} className="underline">
                            Cargalas en la ficha
                          </Link>
                          .
                        </p>
                      ) : (
                        <table className="tabla bg-superficie rounded">
                          <thead>
                            <tr>
                              <th>{f.tipo === "medidas" ? "Medida" : "Pieza"}</th>
                              <th className="text-right">{f.tipo === "medidas" ? "Por juego" : "Por instrumental"}</th>
                              <th className="text-right">Stock</th>
                              <th className="text-right">{f.tipo === "medidas" ? "Juegos que alcanza" : "Instrumentales que alcanza"}</th>
                              <th className="text-right">Faltan p/ el próximo</th>
                              <th>Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {f.sub.map((s) => (
                              <tr key={s.id}>
                                <td className="font-mono">{s.nombre}</td>
                                <td className="text-right font-mono">{s.cant}</td>
                                <td className="text-right font-mono">{s.stock}</td>
                                <td className="text-right font-mono">{s.alcanza}</td>
                                <td className="text-right font-mono">{s.faltan}</td>
                                <td>
                                  {s.estado === "ok" ? (
                                    <span className="text-disponible font-semibold text-xs">✓ OK</span>
                                  ) : (
                                    <span className="text-proceso font-semibold text-xs">◐ Fabricar</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EditarFila({ cajaId, f, primero, ultimo }: { cajaId: string; f: FilaTablaCaja; primero: boolean; ultimo: boolean }) {
  const avisar = useAviso();
  return (
    <div className="flex items-center justify-end gap-1">
      <input
        type="number"
        min={1}
        defaultValue={f.cantPorCaja}
        className="campo w-16 min-h-9 py-1 font-mono"
        aria-label={`Cantidad por caja de ${f.nombre}`}
        onBlur={async (e) => {
          const v = e.currentTarget.value;
          if (Number(v) === f.cantPorCaja) return;
          const fd = new FormData();
          fd.set("cant_por_caja", v);
          const r = await cambiarCantidadEnCaja(cajaId, f.id, fd);
          avisar(r.ok ? { tipo: "ok", texto: "Cantidad guardada" } : { tipo: "error", texto: r.error });
        }}
      />
      <BotonAccion accion={moverEnCaja.bind(null, cajaId, f.id, -1)} className="btn min-h-9 px-2" etiqueta={`Subir ${f.nombre}`}>
        {primero ? <span className="opacity-30">↑</span> : "↑"}
      </BotonAccion>
      <BotonAccion accion={moverEnCaja.bind(null, cajaId, f.id, 1)} className="btn min-h-9 px-2" etiqueta={`Bajar ${f.nombre}`}>
        {ultimo ? <span className="opacity-30">↓</span> : "↓"}
      </BotonAccion>
      <BotonAccion
        accion={quitarDeCaja.bind(null, cajaId, f.id)}
        confirmar={`¿Quitar "${f.nombre}" de esta caja? Sigue en el catálogo con su stock.`}
        className="btn btn-peligro min-h-9 px-2"
        etiqueta={`Quitar ${f.nombre} de la caja`}
        ok="Quitado de la caja"
      >
        ✕
      </BotonAccion>
    </div>
  );
}
