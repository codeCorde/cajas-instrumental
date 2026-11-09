"use client";
import { useId, useState } from "react";

/**
 * Control − / + con botones grandes (≥ 44px) y carga de cantidad (ej. +10).
 * `onCambio(delta)` se dispara con el delta pedido; el stock nunca baja de 0 (se valida también en la base).
 */
export default function Stepper({
  etiqueta,
  valor,
  onCambio,
  grande,
  deshabilitado,
}: {
  etiqueta: string;
  valor: number;
  onCambio: (delta: number) => void;
  grande?: boolean;
  deshabilitado?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [cant, setCant] = useState("");
  const id = useId();
  const tam = grande ? "min-w-14 h-14 text-2xl" : "min-w-11 h-11 text-xl";

  function aplicar(signo: 1 | -1) {
    const q = Math.trunc(Number(cant));
    if (!Number.isFinite(q) || q <= 0) return;
    onCambio(signo * q);
    setCant("");
    setAbierto(false);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5" role="group" aria-label={etiqueta}>
        <button
          type="button"
          className={`btn px-0 ${tam}`}
          onClick={() => onCambio(-1)}
          disabled={deshabilitado || valor <= 0}
          aria-label={`Restar 1 a ${etiqueta}`}
        >
          −
        </button>
        <button
          type="button"
          onClick={() => setAbierto((a) => !a)}
          className={`font-mono font-semibold tabular-nums text-center rounded px-1 ${grande ? "min-w-14 text-2xl" : "min-w-10 text-lg"} hover:bg-superficie-2`}
          aria-label={`${etiqueta}: ${valor}. Tocá para cargar una cantidad`}
          aria-expanded={abierto}
          aria-controls={id}
          disabled={deshabilitado}
        >
          {valor}
        </button>
        <button
          type="button"
          className={`btn px-0 ${tam}`}
          onClick={() => onCambio(1)}
          disabled={deshabilitado}
          aria-label={`Sumar 1 a ${etiqueta}`}
        >
          +
        </button>
      </div>
      {abierto && (
        <div id={id} className="flex items-center gap-1.5">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            className="campo w-20 font-mono"
            placeholder="Cant."
            value={cant}
            onChange={(e) => setCant(e.target.value)}
            aria-label={`Cantidad para ${etiqueta}`}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && aplicar(1)}
          />
          <button type="button" className="btn px-3" onClick={() => aplicar(-1)} aria-label={`Restar cantidad a ${etiqueta}`}>
            − Restar
          </button>
          <button type="button" className="btn btn-primario px-3" onClick={() => aplicar(1)} aria-label={`Sumar cantidad a ${etiqueta}`}>
            + Sumar
          </button>
        </div>
      )}
    </div>
  );
}
