"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAviso } from "./Aviso";
import type { ResultadoAccion } from "./FormAccion";

/** Botón que corre una Server Action sin formulario (con confirmación opcional). */
export default function BotonAccion({
  accion,
  children,
  className = "btn",
  confirmar,
  ok,
  etiqueta,
}: {
  accion: () => Promise<ResultadoAccion>;
  children: React.ReactNode;
  className?: string;
  confirmar?: string;
  ok?: string;
  etiqueta?: string;
}) {
  const [pendiente, iniciar] = useTransition();
  const avisar = useAviso();
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      disabled={pendiente}
      aria-label={etiqueta}
      onClick={() => {
        if (confirmar && !window.confirm(confirmar)) return;
        iniciar(async () => {
          const r = await accion();
          if (r.ok) {
            if (ok || r.mensaje) avisar({ tipo: "ok", texto: r.mensaje ?? ok! });
            if (r.ir) router.push(r.ir);
          } else avisar({ tipo: "error", texto: r.error });
        });
      }}
    >
      {children}
    </button>
  );
}
