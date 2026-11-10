"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { destinoSeguro } from "@/lib/rutas";

const ERRORES: Record<string, string> = {
  link: "El link venció o ya se usó. Pedí uno nuevo con «¿Olvidaste tu contraseña?».",
  perfil: "Tu usuario no tiene perfil. Avisale al admin.",
};

export default function FormLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const next = destinoSeguro(params.get("next"));
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(ERRORES[params.get("error") ?? ""] ?? null);
  const [enviando, setEnviando] = useState(false);

  async function ingresar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const { error } = await crearClienteNavegador().auth.signInWithPassword({ email, password: clave });
    if (error) {
      setEnviando(false);
      setError("Email o contraseña incorrectos.");
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={ingresar} className="card p-6 space-y-4">
      <label className="block">
        <span className="etiqueta">Email</span>
        <input type="email" className="campo" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </label>
      <label className="block">
        <span className="etiqueta">Contraseña</span>
        <input type="password" className="campo" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="current-password" required />
      </label>
      {error && <p role="alert" className="text-sm text-falta">{error}</p>}
      <button className="btn btn-primario w-full" disabled={enviando}>{enviando ? "Ingresando…" : "Ingresar"}</button>
      <Link href="/auth/recuperar" className="block text-center text-sm text-acento hover:underline">
        ¿Olvidaste tu contraseña?
      </Link>
    </form>
  );
}
