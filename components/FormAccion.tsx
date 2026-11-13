"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAviso } from "./Aviso";

export type ResultadoAccion = { ok: true; ir?: string; mensaje?: string } | { ok: false; error: string };

/**
 * Formulario que llama a una Server Action que devuelve { ok, error }. Muestra el aviso y,
 * si la acción devuelve `ir`, navega ahí. `limpiar` vacía el formulario al guardar.
 */
export default function FormAccion({
  accion,
  children,
  className,
  textoBoton = "Guardar",
  ok = "Guardado",
  limpiar = true,
  confirmar,
  claseBoton = "btn btn-primario",
  botonAparte,
}: {
  accion: (fd: FormData) => Promise<ResultadoAccion>;
  children?: React.ReactNode;
  className?: string;
  textoBoton?: string;
  ok?: string;
  limpiar?: boolean;
  confirmar?: string;
  claseBoton?: string;
  botonAparte?: boolean;
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  const avisar = useAviso();
  const router = useRouter();

  function enviar(fd: FormData) {
    if (confirmar && !window.confirm(confirmar)) return;
    iniciar(async () => {
      const r = await accion(fd);
      if (r.ok) {
        setError(null);
        avisar({ tipo: "ok", texto: r.mensaje ?? ok });
        if (limpiar) ref.current?.reset();
        if (r.ir) router.push(r.ir);
      } else {
        setError(r.error);
        avisar({ tipo: "error", texto: r.error });
      }
    });
  }

  const boton = (
    <button className={claseBoton} disabled={pendiente}>
      {pendiente ? "Guardando…" : textoBoton}
    </button>
  );
  return (
    <form ref={ref} action={enviar} className={className} aria-busy={pendiente}>
      {children}
      {botonAparte ? <div className="flex items-center gap-3">{boton}</div> : <div className="self-end">{boton}</div>}
      {error && (
        <p role="alert" className="text-sm text-falta sm:col-span-full">
          ✕ {error}
        </p>
      )}
    </form>
  );
}
