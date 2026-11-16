"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelarPorToken } from "../../acciones";

export default function CancelarCliente({ token, finalizado }: { token: string; finalizado: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const router = useRouter();

  if (!abierto)
    return (
      <button type="button" className="btn btn-peligro w-full min-h-12" onClick={() => setAbierto(true)}>
        Cancelar pedido
      </button>
    );
  return (
    <div className="card p-4 space-y-3 border-falta">
      <p className="font-semibold">¿Seguro que querés cancelar el pedido?</p>
      {finalizado && <p className="text-sm text-proceso">El pedido ya está armado: avisale también al taller.</p>}
      <label className="block">
        <span className="etiqueta">Motivo (opcional)</span>
        <input className="campo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} />
      </label>
      {error && (
        <p role="alert" className="text-falta text-sm">
          ✕ {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn" onClick={() => setAbierto(false)} disabled={pendiente}>
          No, volver
        </button>
        <button
          type="button"
          className="btn btn-peligro"
          disabled={pendiente}
          onClick={() =>
            iniciar(async () => {
              const r = await cancelarPorToken(token, motivo);
              if (r.ok) router.refresh();
              else setError(r.error);
            })
          }
        >
          {pendiente ? "Cancelando…" : "Sí, cancelar"}
        </button>
      </div>
    </div>
  );
}
