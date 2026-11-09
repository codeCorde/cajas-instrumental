import Link from "next/link";
import { listarCajasCompletas } from "@/lib/datos";
import { ESTADO_CAJA_INFO, resumenCaja } from "@/lib/calculos";
import { EstadoChip } from "@/components/Estado";

export const dynamic = "force-dynamic";

/** Destino del QR general. Paso 1: elegir la caja. */
export default async function CargarPage() {
  const cajas = await listarCajasCompletas();
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-tenue">Carga rápida · paso 1 de 2</p>
        <h1 className="titulo text-4xl">Elegí la caja</h1>
      </div>
      {cajas.length === 0 && <p className="card p-6 text-tenue">No hay cajas activas.</p>}
      <ul className="space-y-3">
        {cajas.map((c) => {
          const r = resumenCaja(c.instrumentales);
          const e = ESTADO_CAJA_INFO[r.estado];
          return (
            <li key={c.id}>
              <Link href={`/cargar/${c.id}`} className="card flex items-center gap-4 p-4 min-h-20 hover:border-acento active:bg-superficie-2">
                <span className="font-mono text-4xl font-semibold text-tenue w-12 text-center">{c.numero}</span>
                <span className="flex-1 min-w-0">
                  <span className="titulo text-2xl block">{c.nombre}</span>
                  <span className="flex flex-wrap items-center gap-2 mt-1">
                    <EstadoChip chico estado={e.estado} label={e.label} />
                    <span className="text-xs text-tenue">{r.total} instrumentales</span>
                  </span>
                </span>
                <span aria-hidden="true" className="text-2xl text-tenue">
                  ›
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
