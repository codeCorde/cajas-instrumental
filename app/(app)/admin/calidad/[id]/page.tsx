import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { archivosDe, cargarCatalogo } from "@/lib/datos";
import { nombreInspeccionado, opcionesInspeccion } from "@/lib/calidad";
import { fecha, fechaHora } from "@/lib/formato";
import { RESULTADO_LABEL, type Inspeccion } from "@/lib/tipos";
import Archivos from "@/components/Archivos";
import BotonAccion from "@/components/BotonAccion";
import FormAccion from "@/components/FormAccion";
import { RESULTADO_CLASE } from "../estilos";
import { borrarInspeccion, cerrarAccion, editarSeguimiento } from "../acciones";

const ENTIDAD_LABEL = { instrumental: "Instrumental", componente: "Pieza / medida", caja: "Caja armada", pedido: "Pedido" };

export default async function InspeccionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await db().from("inspecciones").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const x = data as Inspeccion;
  const cat = await cargarCatalogo();
  const [opciones, archivos] = await Promise.all([opcionesInspeccion(cat), archivosDe("calidad", [id])]);
  const enlace =
    x.entidad === "instrumental" ? `/instrumental/${x.entidad_id}` : x.entidad === "componente" && x.instrumental_id ? `/instrumental/${x.instrumental_id}` : x.entidad === "pedido" ? `/admin/pedidos/${x.entidad_id}` : null;

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-tenue">
          <Link href="/admin/calidad" className="hover:underline">
            Control de calidad
          </Link>{" "}
          / {fecha(x.fecha)}
        </p>
        <h1 className="titulo text-4xl">
          {ENTIDAD_LABEL[x.entidad]}:{" "}
          {enlace ? (
            <Link href={enlace} className="underline">
              {nombreInspeccionado(x, opciones)}
            </Link>
          ) : (
            nombreInspeccionado(x, opciones)
          )}
        </h1>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${RESULTADO_CLASE[x.resultado]}`}>
            {x.resultado === "conforme" ? "✓" : x.resultado === "observaciones" ? "◐" : "✕"} {RESULTADO_LABEL[x.resultado]}
          </span>
          <span className="text-sm text-tenue">
            Inspector: {x.inspector}
            {x.cantidad ? ` · ${x.cantidad} u.` : ""}
            {x.lote ? ` · lote ${x.lote}` : ""}
            {x.motivo ? ` · motivo: ${x.motivo}` : ""}
          </span>
        </div>
      </div>

      {x.checklist.length > 0 && (
        <section className="card p-4 space-y-2">
          <h2 className="titulo text-2xl">Checklist</h2>
          <ul className="grid gap-1 sm:grid-cols-2">
            {x.checklist.map((c) => (
              <li key={c.item} className={`flex justify-between gap-2 rounded px-3 py-1.5 ${c.ok ? "bg-disponible-bg" : "bg-falta-bg"}`}>
                <span className="text-sm">{c.item}</span>
                <span className={`text-xs font-semibold ${c.ok ? "text-disponible" : "text-falta"}`}>{c.ok ? "✓ OK" : "✕ No OK"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {x.medidas.length > 0 && (
        <section className="card p-4 space-y-2 overflow-x-auto">
          <h2 className="titulo text-2xl">Medidas controladas</h2>
          <table className="tabla">
            <thead>
              <tr>
                <th>Cota</th>
                <th>Nominal</th>
                <th>Tolerancia</th>
                <th>Medido</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {x.medidas.map((m, n) => (
                <tr key={n}>
                  <td>{m.cota}</td>
                  <td className="font-mono">{m.nominal}</td>
                  <td className="font-mono">{m.tolerancia}</td>
                  <td className="font-mono font-semibold">{m.medido}</td>
                  <td className={`text-xs font-semibold ${m.ok ? "text-disponible" : "text-falta"}`}>{m.ok ? "✓ OK" : "✕ No OK"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card p-4 space-y-3">
        <h2 className="titulo text-2xl">Observaciones y acción correctiva</h2>
        <FormAccion accion={editarSeguimiento.bind(null, x.id)} className="grid gap-3" limpiar={false}>
          <label>
            <span className="etiqueta">Observaciones</span>
            <textarea name="observaciones" defaultValue={x.observaciones ?? ""} className="campo" rows={3} />
          </label>
          <label>
            <span className="etiqueta">Acción correctiva</span>
            <textarea name="accion_correctiva" defaultValue={x.accion_correctiva ?? ""} className="campo" rows={2} />
          </label>
        </FormAccion>
        {x.resultado !== "conforme" && (
          <div className="flex flex-wrap items-center gap-3 border-t border-borde pt-3">
            {x.accion_cerrada ? (
              <>
                <span className="text-disponible font-semibold">
                  ✓ Acción cerrada{x.cerrada_por ? ` por ${x.cerrada_por}` : ""}
                  {x.cerrada_en ? ` el ${fechaHora(x.cerrada_en)}` : ""}
                </span>
                <BotonAccion accion={cerrarAccion.bind(null, x.id, false)} className="btn text-sm">
                  Reabrir
                </BotonAccion>
              </>
            ) : (
              <BotonAccion accion={cerrarAccion.bind(null, x.id, true)} className="btn btn-primario" ok="Acción cerrada" confirmar="¿Marcar la acción correctiva como cerrada?">
                ✓ Marcar acción como cerrada
              </BotonAccion>
            )}
          </div>
        )}
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="titulo text-2xl">Fotos y archivos</h2>
        <Archivos entidad="calidad" entidadId={x.id} archivos={archivos} />
      </section>

      <BotonAccion accion={borrarInspeccion.bind(null, x.id)} className="btn btn-peligro text-sm" confirmar="¿Borrar esta inspección? No se puede deshacer.">
        Borrar inspección
      </BotonAccion>
    </div>
  );
}
