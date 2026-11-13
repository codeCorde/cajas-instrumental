import Link from "next/link";
import { db, sinError } from "@/lib/db";
import { cargarCatalogo, leerApariencia, leerConfig, listarPersonas } from "@/lib/datos";
import type { PlantillaCalidad } from "@/lib/tipos";
import FormAccion from "@/components/FormAccion";
import BotonAccion from "@/components/BotonAccion";
import SubirLogo from "./SubirLogo";
import { activarPersona, agregarPersona, borrarPlantilla, guardarApariencia, guardarMotivos, guardarPlantilla, renombrarPersona } from "./acciones";

export default async function ConfigPage() {
  const [ap, cat, cfg, plantillas, personas] = await Promise.all([
    leerApariencia(),
    cargarCatalogo(),
    leerConfig<{ motivos: string[] }>("calidad", { motivos: [] }),
    db().from("plantillas_calidad").select("*").order("nombre").then((r) => sinError(r) as PlantillaCalidad[]),
    listarPersonas(true),
  ]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-tenue">
          <Link href="/admin" className="hover:underline">
            Administración
          </Link>{" "}
          / Configuración
        </p>
        <h1 className="titulo text-4xl">Configuración</h1>
      </div>

      <section className="card p-4 space-y-4">
        <h2 className="titulo text-2xl">Apariencia</h2>
        <SubirLogo logoPath={ap.logo_path} />
        <FormAccion accion={guardarApariencia} className="grid gap-3 sm:grid-cols-[1fr_9rem_12rem]" limpiar={false}>
          <label>
            <span className="etiqueta">Nombre de la empresa</span>
            <input name="empresa" defaultValue={ap.empresa} className="campo" required />
          </label>
          <label>
            <span className="etiqueta">Color principal</span>
            <input name="color" type="color" defaultValue={ap.color} className="campo p-1 h-11" />
          </label>
          <label>
            <span className="etiqueta">Modo</span>
            <select name="modo" defaultValue={ap.modo} className="campo">
              <option value="auto">Automático (según el equipo)</option>
              <option value="claro">Claro</option>
              <option value="oscuro">Oscuro</option>
            </select>
          </label>
        </FormAccion>
        <p className="text-xs text-tenue">Cada persona puede cambiar entre claro y oscuro en su dispositivo con el botón ☾ / ☀ de arriba.</p>
      </section>

      <section className="card p-4 space-y-4">
        <h2 className="titulo text-2xl">Personas</h2>
        <p className="text-sm text-tenue">Los nombres que aparecen al ingresar. Si desactivás a alguien, deja de aparecer en la lista pero su historial se conserva.</p>
        <ul className="divide-y divide-borde">
          {personas.map((p) => (
            <li key={p.id} className="py-2 flex flex-wrap items-center gap-2">
              <FormAccion accion={renombrarPersona.bind(null, p.id)} className="flex gap-2 flex-1 min-w-60" textoBoton="Renombrar" claseBoton="btn text-sm" limpiar={false} botonAparte>
                <input name="nombre" defaultValue={p.nombre} className={`campo ${p.activa ? "" : "text-tenue line-through"}`} aria-label={`Nombre de ${p.nombre}`} required />
              </FormAccion>
              <BotonAccion accion={activarPersona.bind(null, p.id, !p.activa)} className="btn text-sm">
                {p.activa ? "Desactivar" : "Activar"}
              </BotonAccion>
            </li>
          ))}
        </ul>
        <FormAccion accion={agregarPersona} className="flex gap-2" textoBoton="+ Agregar" botonAparte>
          <input name="nombre" className="campo" placeholder="Nombre" required aria-label="Nombre de la persona nueva" />
        </FormAccion>
      </section>

      <section className="card p-4 space-y-4">
        <h2 className="titulo text-2xl">Conformidades</h2>
        <div>
          <h3 className="titulo text-lg">Motivos de no conformidad</h3>
          <FormAccion accion={guardarMotivos} className="grid gap-2" limpiar={false}>
            <textarea name="motivos" defaultValue={(cfg.motivos ?? []).join("\n")} rows={6} className="campo" aria-label="Motivos, uno por línea" />
            <p className="text-xs text-tenue">Uno por línea.</p>
          </FormAccion>
        </div>
        <div className="space-y-3">
          <h3 className="titulo text-lg">Plantillas de checklist</h3>
          <p className="text-xs text-tenue">
            Resultados posibles: Conforme · Conforme con observaciones · No conforme. Las plantillas pueden ser generales o de un instrumental.
          </p>
          {[...plantillas, null].map((p) => (
            <details key={p?.id ?? "nueva"} className="rounded border border-borde p-3" open={!p && plantillas.length === 0}>
              <summary className="cursor-pointer font-semibold">
                {p ? `${p.nombre} · ${p.items.length} puntos${p.instrumental_id ? ` · ${cat.porId.get(p.instrumental_id)?.nombre ?? ""}` : " · general"}` : "+ Nueva plantilla"}
              </summary>
              <FormAccion accion={guardarPlantilla.bind(null, p?.id ?? null)} className="mt-3 grid gap-3 sm:grid-cols-2" limpiar={!p}>
                <label>
                  <span className="etiqueta">Nombre</span>
                  <input name="nombre" defaultValue={p?.nombre} className="campo" required />
                </label>
                <label>
                  <span className="etiqueta">Instrumental (vacío = general)</span>
                  <select name="instrumental_id" defaultValue={p?.instrumental_id ?? ""} className="campo">
                    <option value="">General</option>
                    {cat.instrumentales.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.codigo} · {i.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sm:col-span-2">
                  <span className="etiqueta">Puntos a controlar (uno por línea)</span>
                  <textarea name="items" defaultValue={p?.items.join("\n")} rows={6} className="campo" required />
                </label>
              </FormAccion>
              {p && (
                <div className="mt-2">
                  <BotonAccion accion={borrarPlantilla.bind(null, p.id)} className="btn btn-peligro text-sm" confirmar={`¿Borrar la plantilla "${p.nombre}"?`}>
                    Borrar plantilla
                  </BotonAccion>
                </div>
              )}
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
