"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAviso } from "@/components/Aviso";
import FirmaPad from "@/components/FirmaPad";
import { entregarParcial } from "../../acciones";

export type LineaParcial = { piezaId: string; nombre: string; pendiente: number; terminadas: number };

/** «Entregar parcial»: elegís qué piezas y cuántas, quién recibe, y firma en tu celular. */
export default function EntregarParcial({ pedidoId, lineas, solicitante }: { pedidoId: string; lineas: LineaParcial[]; solicitante: string }) {
  const [cant, setCant] = useState<Record<string, number>>({});
  const [recibio, setRecibio] = useState(solicitante);
  const [firma, setFirma] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const avisar = useAviso();
  const router = useRouter();
  const total = Object.values(cant).reduce((s, n) => s + n, 0);
  const poner = (l: LineaParcial, d: number) => setCant((c) => ({ ...c, [l.piezaId]: Math.max(0, Math.min(l.pendiente, (c[l.piezaId] ?? 0) + d)) }));

  function enviar() {
    if (total === 0) return setError("Elegí al menos una pieza.");
    if (!recibio.trim()) return setError("Poné quién recibe.");
    if (!firma) return setError("Falta la firma de quien recibe.");
    if (!window.confirm(`¿Entregar ${total} ${total === 1 ? "pieza" : "piezas"} a ${recibio}? Se descuentan del stock de piezas terminadas.`)) return;
    setError(null);
    iniciar(async () => {
      const r = await entregarParcial(pedidoId, { items: Object.entries(cant).filter(([, n]) => n > 0).map(([pieza_id, cantidad]) => ({ pieza_id, cantidad })), recibio, firma });
      if (r.ok) {
        avisar({ tipo: "ok", texto: r.mensaje ?? "Entrega registrada" });
        setCant({});
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-borde">
        {lineas.map((l) => {
          const n = cant[l.piezaId] ?? 0;
          return (
            <li key={l.piezaId} className="py-2 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold leading-tight">{l.nombre}</p>
                <p className="text-xs text-tenue">
                  Faltan entregar {l.pendiente} · terminadas {l.terminadas}
                </p>
              </div>
              <div className="flex items-center gap-1" role="group" aria-label={`Entregar de ${l.nombre}`}>
                <button type="button" className="btn w-11 px-0 text-xl" onClick={() => poner(l, -1)} disabled={n <= 0} aria-label={`Restar 1 a ${l.nombre}`}>
                  −
                </button>
                <span className={`font-mono text-lg w-10 text-center ${n > l.terminadas ? "text-falta" : ""}`}>{n}</span>
                <button type="button" className="btn w-11 px-0 text-xl" onClick={() => poner(l, 1)} disabled={n >= l.pendiente} aria-label={`Sumar 1 a ${l.nombre}`}>
                  +
                </button>
                <button type="button" className="btn px-2 text-xs" onClick={() => poner(l, l.pendiente)} disabled={n >= l.pendiente}>
                  Todo
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {total > 0 && (
        <div className="space-y-3 border-t border-borde pt-3 max-w-lg">
          <label className="block">
            <span className="etiqueta">Quién recibe</span>
            <input className="campo" value={recibio} onChange={(e) => setRecibio(e.target.value)} maxLength={80} />
          </label>
          <FirmaPad onCambio={setFirma} etiqueta="Firma de quien recibe" />
        </div>
      )}
      {error && (
        <p role="alert" className="text-falta font-semibold">
          ✕ {error}
        </p>
      )}
      <button type="button" className="btn btn-primario" onClick={enviar} disabled={pendiente || total === 0}>
        {pendiente ? "Guardando…" : `📦 Entregar parcial${total ? ` (${total})` : ""}`}
      </button>
    </div>
  );
}
