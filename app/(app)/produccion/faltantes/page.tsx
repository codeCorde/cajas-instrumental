import Link from "next/link";
import { cargarFaltantes } from "@/lib/faltantes";
import type { ClaveFaltante } from "@/lib/calculos";

export const dynamic = "force-dynamic";

const ETIQUETA: Record<ClaveFaltante, string> = {
  foto: "Foto",
  plano2d: "Plano 2D",
  modelo3d: "3D",
  programa: "Programa CNC",
  maquina: "Máquina",
  herramientas: "Mechas / machos",
  proceso: "Procesos",
  etapa: "Etapa",
  medidas: "Medidas / partes",
  confirmar: "Cantidad por caja",
};

/** Lo que falta cargar de cada pieza de las cajas. Es lo mismo que preguntan los recordatorios por WhatsApp. */
export default async function FaltantesPage() {
  const faltantes = await cargarFaltantes();
  const total = faltantes.reduce((s, f) => s + f.preguntas.length, 0);
  const porCaja = new Map<string, typeof faltantes>();
  for (const f of faltantes) porCaja.set(f.caja, [...(porCaja.get(f.caja) ?? []), f]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="titulo text-3xl">Información que falta cargar</h2>
        <p className="text-sm text-tenue">
          {total === 0 ? "✓ Está todo cargado." : `${total} datos pendientes en ${faltantes.length} piezas.`} Los recordatorios de las 9:40, 12:40 y 15:40 preguntan por estos datos. Podés
          cargarlos acá o mandármelos (dictado, texto o fotos) en el chat con Claude.
        </p>
      </div>
      {[...porCaja].map(([caja, lista]) => (
        <section key={caja} className="card p-4 space-y-2">
          <h3 className="titulo text-2xl">{caja}</h3>
          <ul className="divide-y divide-borde">
            {lista.map((f) => (
              <li key={f.instId} className="py-2 space-y-1">
                <Link href={`/produccion/partes?caja=${f.cajaCodigo}&pieza=${f.instId}`} className="font-semibold hover:underline">
                  {f.nombre}
                </Link>{" "}
                <span className="font-mono text-xs text-tenue">{f.codigo}</span>
                <div className="flex flex-wrap gap-1">
                  {f.preguntas.map((p) => (
                    <span key={p.clave} title={p.pregunta} className="rounded-full bg-falta-bg text-falta px-2 py-0.5 text-xs font-semibold">
                      ✕ {ETIQUETA[p.clave]}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
