"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { CajaIndice } from "@/lib/datos";
import FilaPlano, { ChipFormato } from "@/components/FilaPlano";

const normal = (t: string) =>
  t
    .replace(/Ø/g, "o")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export default function IndicePlanos({ cajas }: { cajas: CajaIndice[] }) {
  const [buscar, setBuscar] = useState("");
  const [cajaSel, setCajaSel] = useState<string | null>(null);

  const filtradas = useMemo(() => {
    const q = normal(buscar.trim());
    return cajas
      .filter((c) => !cajaSel || c.id === cajaSel)
      .map((c) => ({
        ...c,
        instrumentales: q
          ? c.instrumentales.filter((i) =>
              normal([i.codigo, i.nombre, i.alias ?? "", ...i.planos.map((p) => p.nombre)].join(" ")).includes(q),
            )
          : c.instrumentales,
      }))
      .filter((c) => !q || c.instrumentales.length > 0);
  }, [cajas, buscar, cajaSel]);

  return (
    <>
      <div className="card p-3 space-y-3 no-imprimir">
        <label className="block">
          <span className="sr-only">Buscar instrumental o plano</span>
          <input
            type="search"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Buscar instrumental o plano… (ej. raspa, mango, Ø28)"
            className="campo"
          />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por caja">
          <button type="button" className={`btn px-3 text-sm ${!cajaSel ? "btn-primario" : ""}`} onClick={() => setCajaSel(null)}>
            Todas
          </button>
          {cajas.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`btn px-3 text-sm ${cajaSel === c.id ? "btn-primario" : ""}`}
              onClick={() => setCajaSel(c.id)}
              aria-pressed={cajaSel === c.id}
            >
              {c.numero} · {c.nombre}
            </button>
          ))}
        </div>
      </div>

      {filtradas.length === 0 && <p className="text-tenue">No hay instrumentales que coincidan con «{buscar}».</p>}

      {filtradas.map((c) => (
        <section key={c.id} className="card p-4 space-y-3" aria-labelledby={`caja-${c.id}`}>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-sm text-tenue">CAJA {c.numero}</span>
            <h2 id={`caja-${c.id}`} className="titulo text-3xl">
              {c.nombre}
            </h2>
            <span className="ml-auto font-mono text-xs text-tenue">
              {c.instrumentales.length} instrumentales · {c.instrumentales.reduce((n, i) => n + i.planos.length, 0) + c.planosCaja.length}{" "}
              archivos
            </span>
          </div>

          {c.planosCaja.length > 0 && (
            <div>
              <h3 className="etiqueta">Plano de la caja</h3>
              <ul className="space-y-1.5">
                {c.planosCaja.map((p) => (
                  <FilaPlano key={p.id} p={p} />
                ))}
              </ul>
            </div>
          )}

          {c.instrumentales.length === 0 ? (
            <p className="text-sm text-tenue">Esta caja no tiene instrumentales cargados.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {c.instrumentales.map((i) => {
                const formatos = [...new Set(i.planos.map((p) => p.formato))];
                return (
                  <li key={i.id}>
                    <Link
                      href={`/planos/${i.id}`}
                      className="flex h-full flex-col gap-1.5 rounded border border-borde bg-superficie p-3 hover:border-acento focus-visible:border-acento"
                    >
                      <span className="flex items-baseline gap-1.5">
                        <span className="font-mono text-xs text-tenue">{i.codigo}</span>
                        <span className="font-semibold leading-tight">{i.nombre}</span>
                      </span>
                      {i.alias && <span className="text-xs text-tenue">{i.alias}</span>}
                      <span className="mt-auto flex flex-wrap items-center gap-1">
                        {i.planos.length === 0 ? (
                          <span className="text-xs text-tenue">Sin planos</span>
                        ) : (
                          <>
                            {formatos.map((f) => (
                              <ChipFormato key={f} formato={f} />
                            ))}
                            <span className="ml-1 font-mono text-xs text-tenue">
                              {i.planos.length} archivo{i.planos.length === 1 ? "" : "s"}
                            </span>
                          </>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}
