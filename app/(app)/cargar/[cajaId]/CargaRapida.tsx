"use client";
// Paso 2 de la carga por QR: instrumentales de la caja con buscador y + / − grandes.
import Link from "next/link";
import { useMemo, useState } from "react";
import { evaluarInstrumental } from "@/lib/calculos";
import { useCaja } from "@/lib/useCaja";
import type { CajaCompleta } from "@/lib/tipos";
import { EstadoChip } from "@/components/Estado";
import CargaInstrumental from "@/components/CargaInstrumental";
import CajasArmadas from "@/components/CajasArmadas";
import AvisoFlotante from "@/components/AvisoFlotante";

const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export default function CargaRapida({ inicial }: { inicial: CajaCompleta }) {
  const { caja, ajustar, armar, entregar, aviso, setAviso } = useCaja(inicial);
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);

  const lista = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return caja.instrumentales;
    return caja.instrumentales.filter((i) => normalizar(`${i.codigo} ${i.nombre} ${i.alias ?? ""}`).includes(q));
  }, [busqueda, caja.instrumentales]);

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-20">
      <div className="flex items-center gap-3">
        <Link href="/cargar" className="btn px-3" aria-label="Volver a elegir caja">
          ‹
        </Link>
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-widest text-tenue">Paso 2 de 2 · Caja {caja.numero}</p>
          <h1 className="titulo text-3xl truncate">{caja.nombre}</h1>
        </div>
      </div>

      <CajasArmadas caja={caja} armar={armar} entregar={entregar} />

      <label className="block">
        <span className="sr-only">Buscar instrumental</span>
        <input
          type="search"
          className="campo text-lg"
          placeholder="Buscá por código o nombre…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </label>

      {lista.length === 0 && <p className="text-center text-tenue py-6">No hay instrumentales que coincidan.</p>}

      <ul className="space-y-2">
        {lista.map((i) => {
          const ev = evaluarInstrumental(i);
          const estaAbierto = abierto === i.id;
          return (
            <li key={i.id} className={`card overflow-hidden ${estaAbierto ? "border-acento" : ""}`}>
              <button
                type="button"
                className="w-full flex items-center gap-3 p-3 min-h-16 text-left"
                aria-expanded={estaAbierto}
                aria-controls={`carga-${i.id}`}
                onClick={() => setAbierto(estaAbierto ? null : i.id)}
              >
                <span className="font-mono text-lg font-semibold w-12 shrink-0 text-tenue">{i.codigo}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold leading-tight">{i.nombre}</span>
                  <span className="flex flex-wrap items-center gap-1.5 mt-1">
                    <EstadoChip chico estado={ev.estado} />
                    {ev.faltaTexto && <span className="text-xs text-tenue">{ev.faltaTexto}</span>}
                  </span>
                </span>
                <span aria-hidden="true" className={`text-xl text-tenue transition-transform ${estaAbierto ? "rotate-90" : ""}`}>
                  ›
                </span>
              </button>
              {estaAbierto && (
                <div id={`carga-${i.id}`} className="border-t border-borde px-3 pb-3">
                  <CargaInstrumental i={i} ajustar={ajustar} grande />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <AvisoFlotante aviso={aviso} cerrar={() => setAviso(null)} />
    </div>
  );
}
