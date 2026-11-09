// Sección de administración de planos (de un instrumental o de la caja entera).
import FormAccion from "@/components/FormAccion";
import SubirPlanos from "@/components/SubirPlanos";
import { ChipFormato } from "@/components/FilaPlano";
import { tamanoLegible, type Plano } from "@/lib/planos";
import { borrarPlano, renombrarPlano } from "@/app/(app)/admin/acciones";

export default function AdminPlanos({
  titulo,
  planos,
  cajaId,
  cajaNumero,
  instrumentalId,
}: {
  titulo: string;
  planos: Plano[];
  cajaId: string;
  cajaNumero: number;
  instrumentalId: string | null;
}) {
  return (
    <section id="planos" className="card p-4 space-y-3 scroll-mt-20">
      <h2 className="titulo text-2xl">
        {titulo} <span className="font-mono text-base text-tenue">({planos.length})</span>
      </h2>
      {planos.length === 0 ? (
        <p className="text-sm text-tenue">Sin planos cargados.</p>
      ) : (
        <ul className="space-y-1.5">
          {planos.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 rounded border border-borde p-2">
              <ChipFormato formato={p.formato} />
              <FormAccion accion={renombrarPlano} className="flex flex-1 min-w-52 flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={p.id} />
                <label className="flex-1 min-w-40">
                  <span className="sr-only">Nombre del plano</span>
                  <input name="nombre" defaultValue={p.nombre} className="campo py-1" />
                </label>
                <button className="btn px-3 text-sm">Guardar</button>
              </FormAccion>
              <span className="font-mono text-xs text-tenue">{tamanoLegible(p.tamano)}</span>
              <a href={`/planos/archivo/${p.id}?descargar`} className="btn px-3 text-sm" aria-label={`Descargar ${p.nombre}`}>
                ↓
              </a>
              <FormAccion accion={borrarPlano} confirmar={`¿Borrar el plano «${p.nombre}»? Se borra el archivo.`}>
                <input type="hidden" name="id" value={p.id} />
                <button className="btn btn-peligro px-3" aria-label={`Borrar ${p.nombre}`}>
                  ✕
                </button>
              </FormAccion>
            </li>
          ))}
        </ul>
      )}
      <SubirPlanos cajaId={cajaId} cajaNumero={cajaNumero} instrumentalId={instrumentalId} />
    </section>
  );
}
