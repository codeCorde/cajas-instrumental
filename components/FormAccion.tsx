"use client";
// Formulario que llama a una Server Action y muestra el resultado (error / ok).
import { useActionState } from "react";

export interface Resultado {
  ok?: string;
  error?: string;
}

export default function FormAccion({
  accion,
  children,
  className,
  confirmar,
}: {
  accion: (fd: FormData) => Promise<Resultado | void>;
  children: React.ReactNode;
  className?: string;
  /** Si se pasa, pide confirmación antes de enviar */
  confirmar?: string;
}) {
  const [estado, formAction, pendiente] = useActionState(async (_prev: Resultado | null, fd: FormData) => (await accion(fd)) ?? null, null);

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={confirmar ? (e) => !window.confirm(confirmar) && e.preventDefault() : undefined}
      aria-busy={pendiente}
    >
      <fieldset disabled={pendiente} className="contents">
        {children}
      </fieldset>
      {estado?.error && (
        <p role="alert" className="basis-full text-sm text-falta">
          ✕ {estado.error}
        </p>
      )}
      {estado?.ok && (
        <p role="status" className="basis-full text-sm text-disponible">
          ✓ {estado.ok}
        </p>
      )}
    </form>
  );
}
