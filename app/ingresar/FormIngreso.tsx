"use client";
import { useActionState } from "react";
import { ingresar } from "./acciones";

export default function FormIngreso({ volver }: { volver: string }) {
  const [estado, accion, pendiente] = useActionState(ingresar, null);
  return (
    <form action={accion} className="card p-6 space-y-4" aria-busy={pendiente}>
      <input type="hidden" name="volver" value={volver} />
      <label className="block">
        <span className="etiqueta">Contraseña del taller</span>
        <input type="password" name="clave" className="campo text-lg" autoComplete="current-password" required autoFocus />
      </label>
      {estado?.error && (
        <p role="alert" className="text-sm text-falta">
          ✕ {estado.error}
        </p>
      )}
      <button className="btn btn-primario w-full min-h-12 text-lg" disabled={pendiente}>
        {pendiente ? "Entrando…" : "Entrar"}
      </button>
      <p className="text-xs text-tenue">Es la misma contraseña para todo el equipo. Si no la sabés, pedísela al dueño.</p>
    </form>
  );
}
