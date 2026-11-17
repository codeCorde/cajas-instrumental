import { cookies } from "next/headers";
import { listarPersonas } from "@/lib/datos";
import { COOKIE_SESION, leerSesion } from "@/lib/sesion";
import { elegirNombre } from "../acciones";

export const dynamic = "force-dynamic";

export default async function NombrePage({ searchParams }: { searchParams: Promise<{ volver?: string; error?: string }> }) {
  const { volver = "/", error } = await searchParams;
  const [personas, sesion] = await Promise.all([listarPersonas(), cookies().then((c) => leerSesion(c.get(COOKIE_SESION)?.value))]);
  return (
    <main className="min-h-dvh grid place-items-center p-4">
      <div className="w-full max-w-md">
        <p className="font-mono text-xs uppercase tracking-widest text-tenue mb-1">{sesion?.nombre ? "Cambiar de persona" : "Paso 2 de 2"}</p>
        <h1 className="titulo text-4xl mb-2">¿Quién sos?</h1>
        <p className="text-sm text-tenue mb-5">Tu nombre queda registrado en cada carga de stock. Solo aparecen las personas habilitadas.</p>
        <form action={elegirNombre} className="card p-5 space-y-5">
          <input type="hidden" name="volver" value={volver} />
          {personas.length > 0 && (
            <fieldset>
              <legend className="etiqueta mb-2">Elegí tu nombre</legend>
              <div className="grid grid-cols-2 gap-2">
                {personas.map((p) => (
                  <button key={p.id} name="nombre" value={p.nombre} className={`btn min-h-12 justify-start ${sesion?.nombre === p.nombre ? "btn-primario" : ""}`}>
                    {p.nombre}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {personas.length > 0 ? (
            <p className="text-sm text-tenue">¿No estás en la lista? El taller es privado: pedile una invitación a quien lo administra.</p>
          ) : (
          <label className="block">
            <span className="etiqueta">Primera vez: escribí tu nombre (vas a ser el administrador)</span>
            <span className="flex gap-2">
              <input name="nuevo" className="campo" maxLength={40} autoComplete="name" placeholder="Ej.: Juan" />
              <button className="btn btn-primario shrink-0">Seguir</button>
            </span>
          </label>
          )}
          {error && (
            <p role="alert" className="text-sm text-falta">
              ✕ Elegí tu nombre de la lista.
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
