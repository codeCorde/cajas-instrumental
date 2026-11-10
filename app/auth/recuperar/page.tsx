"use client";
import Link from "next/link";
import { useActionState } from "react";
import { pedirCambioDeClave, type EstadoRecuperar } from "./acciones";

export default function RecuperarPage() {
  const [estado, accion, pendiente] = useActionState<EstadoRecuperar | null, FormData>(pedirCambioDeClave, null);

  return (
    <main className="min-h-dvh grid place-items-center p-4">
      <div className="w-full max-w-sm">
        <p className="font-mono text-xs uppercase tracking-widest text-tenue mb-1">Control de producción</p>
        <h1 className="titulo text-4xl mb-6">Cambiar contraseña</h1>

        {estado?.enviado ? (
          <div className="card p-6 space-y-4" role="status">
            <p className="text-lg font-semibold">✓ Revisá tu correo</p>
            <p className="text-sm">
              Si el email está registrado, te llega un mail con un link para elegir una contraseña nueva. Puede tardar unos
              minutos; fijate también en spam.
            </p>
            <p className="text-sm text-tenue">El link sirve una sola vez y vence en 1 hora.</p>
            <Link href="/login" className="btn w-full">
              Volver a ingresar
            </Link>
          </div>
        ) : (
          <form action={accion} className="card p-6 space-y-4" aria-busy={pendiente}>
            <p className="text-sm">Escribí el email con el que ingresás y te mandamos un link para elegir una contraseña nueva.</p>
            <label className="block">
              <span className="etiqueta">Email</span>
              <input type="email" name="email" className="campo" autoComplete="email" required autoFocus />
            </label>
            {estado?.error && (
              <p role="alert" className="text-sm text-falta">
                ✕ {estado.error}
              </p>
            )}
            <button className="btn btn-primario w-full" disabled={pendiente}>
              {pendiente ? "Enviando…" : "Enviarme el link"}
            </button>
            <Link href="/login" className="block text-center text-sm text-acento hover:underline">
              Volver a ingresar
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
