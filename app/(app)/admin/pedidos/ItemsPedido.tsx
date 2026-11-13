"use client";
import { useState } from "react";

/** Filas de ítems (caja + cantidad) de un pedido, con agregar y quitar. */
export default function ItemsPedido({ cajas, iniciales }: { cajas: { id: string; nombre: string }[]; iniciales?: { caja_id: string; cantidad: number }[] }) {
  const [filas, setFilas] = useState(() => (iniciales?.length ? iniciales : [{ caja_id: cajas[0]?.id ?? "", cantidad: 1 }]).map((f, n) => ({ ...f, k: n })));
  const [sig, setSig] = useState(filas.length);
  return (
    <fieldset className="sm:col-span-full space-y-2">
      <legend className="etiqueta">Cajas pedidas</legend>
      {filas.map((f, n) => (
        <div key={f.k} className="flex gap-2">
          <select name={`caja_${n}`} defaultValue={f.caja_id} className="campo" aria-label={`Caja del ítem ${n + 1}`} required>
            {cajas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <input name={`cant_${n}`} type="number" min={1} defaultValue={f.cantidad} className="campo w-24 font-mono" aria-label={`Cantidad del ítem ${n + 1}`} required />
          <button type="button" className="btn px-3" onClick={() => setFilas(filas.filter((x) => x.k !== f.k))} disabled={filas.length === 1} aria-label={`Quitar ítem ${n + 1}`}>
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn text-sm"
        onClick={() => {
          setFilas([...filas, { caja_id: cajas[0]?.id ?? "", cantidad: 1, k: sig }]);
          setSig(sig + 1);
        }}
      >
        + Otra caja
      </button>
    </fieldset>
  );
}
