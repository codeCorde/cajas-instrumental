"use client";
import type { Aviso } from "@/lib/useCaja";

export default function AvisoFlotante({ aviso, cerrar }: { aviso: Aviso | null; cerrar: () => void }) {
  return (
    <div aria-live="polite" className="no-imprimir fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 pointer-events-none">
      {aviso && (
        <div
          role={aviso.tipo === "error" ? "alert" : "status"}
          className={`pointer-events-auto card flex items-center gap-3 px-4 py-3 shadow-lg ${
            aviso.tipo === "error" ? "border-falta text-falta" : "border-disponible text-disponible"
          }`}
        >
          <span aria-hidden="true">{aviso.tipo === "error" ? "✕" : "✓"}</span>
          <span className="text-sm font-semibold">{aviso.texto}</span>
          <button type="button" className="btn min-h-0 h-8 px-2 text-xs" onClick={cerrar} aria-label="Cerrar aviso">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
