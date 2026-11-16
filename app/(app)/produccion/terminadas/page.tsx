import Link from "next/link";
import { cargarCatalogo, composicionDe, usosDe } from "@/lib/datos";
import { cargarPedidos } from "@/lib/pedidos";
import { completosConComponentes, ESTADO_TERMINADAS_INFO, estadoTerminadasCaja, piezasTerminadas, type EstadoTerminadas } from "@/lib/calculos";
import { fecha } from "@/lib/formato";
import BotonAccion from "@/components/BotonAccion";
import ControlStock from "@/components/ControlStock";
import { Compartido } from "@/components/Estado";
import { armarUnidad } from "../../instrumental/acciones";

export const dynamic = "force-dynamic";

const CLASE_ESTADO: Record<EstadoTerminadas, string> = {
  completa: "text-disponible bg-disponible-bg border-disponible",
  incompleta: "text-proceso bg-proceso-bg border-proceso",
  vacia: "text-falta bg-falta-bg border-falta",
};

/**
 * 3 · Stock de piezas terminadas, por caja. Círculo verde = caja completa, cuadrado naranja = incompleta, cruz roja = vacía.
 * Las piezas compartidas son un solo stock: al descontar una, baja en todas las cajas que la usan.
 * Una pieza compleja se suma "armándola": descuenta 1 de cada parte del Stock de partes.
 */
export default async function TerminadasPage() {
  const [cat, ordenes] = await Promise.all([cargarCatalogo(), cargarPedidos(["en_produccion"], { col: "recepcionado_en" })]);

  return (
    <div className="space-y-5">
      <section className="card p-4 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="titulo text-2xl">Armar pedido</h2>
            <p className="text-sm text-tenue">Elegí una orden: se descuentan las piezas terminadas y el pedido pasa a «Pedidos entregados» para firmar.</p>
          </div>
        </div>
        {ordenes.length === 0 ? (
          <p className="text-sm text-tenue">No hay órdenes en producción.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {ordenes.map((o) => (
              <li key={o.id}>
                <Link href={`/produccion/pedido/${o.id}`} className="btn">
                  <span className="font-mono">{o.numero}</span> · {o.cliente} <span className="text-xs text-tenue">{fecha(o.fecha_pedido)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm flex flex-wrap gap-4" aria-label="Referencias">
        {(["completa", "incompleta", "vacia"] as const).map((e) => (
          <span key={e} className={`font-semibold ${CLASE_ESTADO[e].split(" ")[0]}`}>
            <span aria-hidden="true">{ESTADO_TERMINADAS_INFO[e].icono}</span> {ESTADO_TERMINADAS_INFO[e].label}
          </span>
        ))}
      </p>

      <div className="grid gap-4 xl:grid-cols-2">
        {cat.cajas.map((caja) => {
          const comp = composicionDe(cat, caja.id);
          const estado = estadoTerminadasCaja(comp);
          const info = ESTADO_TERMINADAS_INFO[estado];
          return (
            <section key={caja.id} className={`card p-4 space-y-3 border-2 ${CLASE_ESTADO[estado].split(" ").at(-1)}`}>
              <div className="flex items-center gap-3">
                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-full border-2 text-2xl ${CLASE_ESTADO[estado]}`} aria-hidden="true">
                  {info.icono}
                </span>
                <div>
                  <h2 className="titulo text-2xl">{caja.nombre}</h2>
                  <p className={`text-sm font-semibold ${CLASE_ESTADO[estado].split(" ")[0]}`}>Caja {info.label.toLowerCase()}</p>
                </div>
              </div>
              <ul className="divide-y divide-borde">
                {comp.map(({ inst, cantPorCaja }) => {
                  const hay = piezasTerminadas(inst);
                  const ok = hay >= cantPorCaja;
                  const usos = usosDe(cat, inst.id).map((u) => u.caja.codigo);
                  return (
                    <li key={inst.id} className="py-2 flex flex-wrap items-center gap-3">
                      <span aria-hidden="true" className={`font-mono ${ok ? "text-disponible" : hay > 0 ? "text-proceso" : "text-falta"}`}>
                        {ok ? "●" : hay > 0 ? "■" : "✕"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link href={`/produccion/partes?caja=${caja.codigo}&pieza=${inst.id}`} className="font-semibold hover:underline">
                          {inst.nombre}
                        </Link>{" "}
                        <Compartido cajas={usos} />
                        <span className="block text-xs text-tenue">
                          {cantPorCaja} por caja
                          {usos.length > 1 && ` · compartida: al descontar, baja en ${usos.join(", ")}`}
                        </span>
                      </div>
                      {inst.tipo === "simple" && <ControlStock objetivo="stock_terminado" id={inst.id} valor={inst.stock_terminado} etiqueta={`Terminados de ${inst.nombre}`} cajaId={caja.id} />}
                      {inst.tipo === "complejo" && (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-lg font-semibold w-10 text-right" aria-label={`${hay} armados`}>
                            {hay}
                          </span>
                          <BotonAccion
                            accion={armarUnidad.bind(null, inst.id)}
                            className="btn text-sm"
                            ok={`Se armó 1 ${inst.nombre}`}
                            confirmar={completosConComponentes(inst) < 1 ? undefined : `¿Armar 1 ${inst.nombre}? Descuenta 1 juego de partes del Stock de partes.`}
                          >
                            + Armar 1
                          </BotonAccion>
                        </div>
                      )}
                      {inst.tipo === "medidas" && (
                        <span className="font-mono text-lg font-semibold" title="Sets completos (los limita la medida que menos hay)">
                          {hay} <span className="text-xs font-normal text-tenue">sets</span>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
