"use client";
import { useState } from "react";
import type { Tipo } from "@/lib/calculos";

/** Selector de tipo con advertencia si se cambia. */
export default function SelectTipo({ actual, cantPartes }: { actual: Tipo; cantPartes: number }) {
  const [tipo, setTipo] = useState<Tipo>(actual);
  const cambia = tipo !== actual;
  return (
    <div className="basis-full sm:basis-auto">
      <label>
        <span className="etiqueta">Tipo</span>
        <select name="tipo" className="campo" value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
          <option value="simple">Simple (una pieza)</option>
          <option value="medidas">Medidas (juego)</option>
          <option value="complejo">Complejo (se arma con partes)</option>
        </select>
      </label>
      {cambia && (
        <p role="alert" className="mt-1 max-w-sm rounded bg-proceso-bg p-2 text-xs text-proceso">
          ⚠ Cambiar el tipo cambia cómo se calcula el stock.
          {actual === "simple" && " El stock terminado deja de contar."}
          {actual === "complejo" && " Las unidades armadas dejan de contar."}
          {tipo === "simple" && cantPartes > 0 && ` Las ${cantPartes} medidas/partes quedan guardadas pero no se usan.`}
          {tipo !== "simple" && actual !== "simple" && " Las medidas/partes actuales pasan a leerse con el nuevo tipo."}
          {" "}No se borra nada.
        </p>
      )}
    </div>
  );
}
