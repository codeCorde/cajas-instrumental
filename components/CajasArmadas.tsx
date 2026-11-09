"use client";
// Contador de cajas armadas: + arma y descuenta stock (con confirmación); − entrega (solo baja el contador).
import { useState } from "react";
import { planArmadoCaja } from "@/lib/armado";
import type { CajaCompleta } from "@/lib/tipos";

export default function CajasArmadas({
  caja,
  armar,
  entregar,
}: {
  caja: CajaCompleta;
  armar: (nota?: string) => Promise<{ ok: boolean; faltantes: string[] }>;
  entregar: () => void;
}) {
  const [modal, setModal] = useState<null | "armar" | "entregar">(null);
  const [faltantesServidor, setFaltantesServidor] = useState<string[] | null>(null);
  const [enviando, setEnviando] = useState(false);
  const plan = planArmadoCaja(caja.instrumentales);
  const faltantes = faltantesServidor ?? plan.faltantes;
  const puede = faltantesServidor ? false : plan.ok;

  async function confirmarArmado() {
    setEnviando(true);
    const r = await armar();
    setEnviando(false);
    if (r.ok) setModal(null);
    else if (r.faltantes.length) setFaltantesServidor(r.faltantes);
  }

  return (
    <div className="card p-4 flex items-center justify-between gap-4">
      <div>
        <p className="etiqueta mb-0">Cajas armadas en stock</p>
        <p className="font-mono text-4xl font-semibold tabular-nums">{caja.cajas_armadas}</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn min-w-14 h-14 text-2xl px-0"
          disabled={caja.cajas_armadas <= 0}
          onClick={() => setModal("entregar")}
          aria-label="Restar una caja armada (entrega)"
        >
          −
        </button>
        <button
          type="button"
          className="btn btn-primario min-w-14 h-14 text-2xl px-0"
          onClick={() => {
            setFaltantesServidor(null);
            setModal("armar");
          }}
          aria-label="Sumar una caja armada"
        >
          +
        </button>
      </div>

      {modal && (
        <div
          className="fixed inset-0 z-40 bg-black/50 grid place-items-end sm:place-items-center sm:p-4"
          onClick={() => setModal(null)}
          onKeyDown={(e) => e.key === "Escape" && setModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-modal"
            className="card w-full sm:max-w-lg max-h-[85dvh] overflow-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {modal === "entregar" ? (
              <>
                <h2 id="titulo-modal" className="titulo text-2xl mb-2">
                  ¿Entregar una caja?
                </h2>
                <p className="text-sm text-tenue mb-4">
                  Baja el contador de cajas armadas de {caja.cajas_armadas} a {caja.cajas_armadas - 1}. No cambia el stock de
                  instrumentales.
                </p>
                <div className="flex gap-2 justify-end">
                  <button type="button" className="btn" onClick={() => setModal(null)} autoFocus>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primario"
                    onClick={() => {
                      entregar();
                      setModal(null);
                    }}
                  >
                    Sí, entregar
                  </button>
                </div>
              </>
            ) : puede ? (
              <>
                <h2 id="titulo-modal" className="titulo text-2xl mb-2">
                  ¿Armar una caja?
                </h2>
                <p className="text-sm text-tenue mb-3">Se va a descontar del stock:</p>
                <ul className="text-sm divide-y divide-borde mb-4">
                  {plan.descuentos.map((d) => (
                    <li key={`${d.instrumentalId}-${d.parteId}-${d.campo}`} className="flex justify-between py-1.5 gap-3">
                      <span>{d.etiqueta}</span>
                      <span className="font-mono font-semibold">−{d.cantidad}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2 justify-end">
                  <button type="button" className="btn" onClick={() => setModal(null)} autoFocus>
                    Cancelar
                  </button>
                  <button type="button" className="btn btn-primario" disabled={enviando} onClick={confirmarArmado}>
                    {enviando ? "Armando…" : "Sí, armar caja"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 id="titulo-modal" className="titulo text-2xl mb-2 text-falta">
                  No alcanza para armar una caja
                </h2>
                <p className="text-sm text-tenue mb-3">Falta:</p>
                <ul className="text-sm space-y-1 mb-4">
                  {faltantes.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span aria-hidden="true" className="text-falta">
                        ✕
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="flex justify-end">
                  <button type="button" className="btn" onClick={() => setModal(null)} autoFocus>
                    Entendido
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
