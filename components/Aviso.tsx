"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type Aviso = { tipo: "ok" | "error"; texto: string };
const Ctx = createContext<(a: Aviso) => void>(() => {});

/** Avisos flotantes ("Guardado", "No se pudo…"). Envolver la app con <ProveedorAvisos>. */
export function ProveedorAvisos({ children }: { children: React.ReactNode }) {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mostrar = useCallback((a: Aviso) => {
    setAviso(a);
    clearTimeout(t.current);
    t.current = setTimeout(() => setAviso(null), a.tipo === "error" ? 6000 : 2500);
  }, []);
  useEffect(() => () => clearTimeout(t.current), []);
  return (
    <Ctx.Provider value={mostrar}>
      {children}
      <div aria-live="polite" className="no-imprimir fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 pointer-events-none">
        {aviso && (
          <div
            role={aviso.tipo === "error" ? "alert" : "status"}
            className={`pointer-events-auto card flex items-center gap-3 px-4 py-3 shadow-lg max-w-lg ${aviso.tipo === "error" ? "border-falta text-falta" : "border-disponible text-disponible"}`}
          >
            <span aria-hidden="true">{aviso.tipo === "error" ? "✕" : "✓"}</span>
            <span className="text-sm font-semibold">{aviso.texto}</span>
            <button type="button" className="btn min-h-0 h-8 px-2 text-xs" onClick={() => setAviso(null)} aria-label="Cerrar aviso">
              ✕
            </button>
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

export const useAviso = () => useContext(Ctx);
