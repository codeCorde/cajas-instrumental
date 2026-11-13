import Link from "next/link";
import { cargarCatalogo, resumenDe } from "@/lib/datos";
import { Cifra, EstadoChip, MedidorCaja } from "@/components/Estado";
import FormAccion from "@/components/FormAccion";
import { crearCaja } from "./cajas/acciones";

export default async function ConteoPage() {
  const cat = await cargarCatalogo();
  const filas = cat.cajas.map((caja) => ({ caja, r: resumenDe(cat, caja) }));

  return (
    <div className="space-y-5">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-tenue">Resumen</p>
        <h1 className="titulo text-4xl">Conteo de cajas</h1>
        <p className="text-sm text-tenue mt-1 max-w-3xl">
          Cuántas cajas hay armadas y cuántas se pueden armar con el instrumental que hay. Como varias cajas comparten instrumental,
          cada número se calcula por separado: <strong>no se suman</strong>.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {filas.map(({ caja, r }) => (
          <Link key={caja.id} href={`/cajas/${caja.codigo}`} className="card p-4 space-y-4 hover:border-acento focus-visible:border-acento block">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-tenue">{caja.codigo}</p>
                <h2 className="titulo text-2xl">{caja.nombre}</h2>
              </div>
              <span className="text-sm text-tenue">{r.filas.length} instrumentales</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Cifra valor={caja.cajas_armadas} label="Armadas en stock" />
              <Cifra valor={r.posibles} label="Se pueden armar" clase={r.posibles > 0 ? "text-disponible" : "text-falta"} />
            </div>
            <MedidorCaja estados={r.filas.map((f) => ({ id: f.inst.id, nombre: f.inst.nombre, estado: f.estado }))} />
            <div className="flex flex-wrap gap-1.5">
              <EstadoChip estado="disponible" label={`${r.contadores.disponible} disponibles`} chico />
              <EstadoChip estado="en_proceso" label={`${r.contadores.en_proceso} en proceso`} chico />
              <EstadoChip estado="falta" label={`${r.contadores.falta} faltan`} chico />
              {r.contadores.sin_definir > 0 && <EstadoChip estado="sin_definir" label={`${r.contadores.sin_definir} sin definir`} chico />}
            </div>
            {r.limitante && r.posibles === 0 && (
              <p className="text-xs text-tenue">
                Limita: <strong className="text-texto">{r.limitante.inst.nombre}</strong>
                {r.limitante.falta ? ` · ${r.limitante.falta}` : ""}
              </p>
            )}
          </Link>
        ))}
      </div>

      {filas.length === 0 && <p className="card p-6 text-tenue">Todavía no hay cajas. Agregá la primera acá abajo.</p>}

      <details className="card p-4 max-w-xl">
        <summary className="cursor-pointer font-semibold">+ Agregar una caja</summary>
        <FormAccion accion={crearCaja} className="mt-4 grid gap-3 sm:grid-cols-[8rem_1fr]" textoBoton="Crear caja" ok="Caja creada">
          <label>
            <span className="etiqueta">Código</span>
            <input name="codigo" className="campo font-mono uppercase" required maxLength={12} pattern="[A-Za-z0-9-]+" placeholder="DM" />
          </label>
          <label>
            <span className="etiqueta">Nombre</span>
            <input name="nombre" className="campo" required placeholder="Caja Doble Movilidad" />
          </label>
          <label className="sm:col-span-2">
            <span className="etiqueta">Descripción (opcional)</span>
            <input name="descripcion" className="campo" />
          </label>
        </FormAccion>
      </details>
    </div>
  );
}
