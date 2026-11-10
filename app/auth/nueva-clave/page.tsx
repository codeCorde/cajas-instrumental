"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";

export default function NuevaClavePage() {
  const router = useRouter();
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Si se llega con la plantilla de email por defecto de Supabase, la sesión viene en el #hash.
  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.slice(1));
    const access_token = h.get("access_token");
    const refresh_token = h.get("refresh_token");
    if (access_token && refresh_token) {
      crearClienteNavegador()
        .auth.setSession({ access_token, refresh_token })
        .then(({ error }) => {
          if (error) setError("El link venció. Pedí uno nuevo desde «¿Olvidaste tu contraseña?» en la pantalla de ingreso.");
          history.replaceState(null, "", window.location.pathname);
        });
    }
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (clave.length < 8) return setError("La contraseña tiene que tener al menos 8 caracteres.");
    setEnviando(true);
    const { error } = await crearClienteNavegador().auth.updateUser({ password: clave });
    setEnviando(false);
    if (error) return setError("No se pudo guardar. Probá abrir de nuevo el link del email.");
    router.replace("/cargar");
  }

  return (
    <main className="min-h-dvh grid place-items-center p-4">
      <form onSubmit={guardar} className="card w-full max-w-sm p-6 space-y-4">
        <h1 className="titulo text-3xl">Elegí tu contraseña</h1>
        <label className="block">
          <span className="etiqueta">Contraseña nueva</span>
          <input type="password" className="campo" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="new-password" required />
        </label>
        {error && <p role="alert" className="text-sm text-falta">{error}</p>}
        <button className="btn btn-primario w-full" disabled={enviando}>{enviando ? "Guardando…" : "Guardar y entrar"}</button>
      </form>
    </main>
  );
}
