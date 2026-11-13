import Link from "next/link";
import { db, sinError } from "@/lib/db";
import { cargarCatalogo, leerConfig } from "@/lib/datos";
import { opcionesInspeccion } from "@/lib/calidad";
import { hoyISO } from "@/lib/formato";
import type { EntidadInspeccion, PlantillaCalidad } from "@/lib/tipos";
import FormInspeccion from "./FormInspeccion";

export default async function NuevaInspeccionPage({ searchParams }: { searchParams: Promise<{ entidad?: string; id?: string }> }) {
  const sp = await searchParams;
  const entidad: EntidadInspeccion = ["instrumental", "componente", "caja", "pedido"].includes(sp.entidad ?? "") ? (sp.entidad as EntidadInspeccion) : "instrumental";
  const cat = await cargarCatalogo();
  const [opciones, plantillas, cfg] = await Promise.all([
    opcionesInspeccion(cat),
    db().from("plantillas_calidad").select("*").order("nombre").then((r) => sinError(r) as PlantillaCalidad[]),
    leerConfig<{ motivos: string[] }>("calidad", { motivos: [] }),
  ]);
  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-tenue">
          <Link href="/admin/calidad" className="hover:underline">
            Control de calidad
          </Link>{" "}
          / Nueva
        </p>
        <h1 className="titulo text-4xl">Nueva inspección</h1>
      </div>
      <div className="card p-4">
        <FormInspeccion opciones={opciones} plantillas={plantillas} motivos={cfg.motivos ?? []} hoy={hoyISO()} inicial={{ entidad, id: sp.id ?? null }} pedidos={opciones.pedido} />
      </div>
    </div>
  );
}
