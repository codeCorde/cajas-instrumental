import Link from "next/link";
import { cargarCatalogo, usosDe } from "@/lib/datos";
import { cargarPedidos, nombreLinea } from "@/lib/pedidos";
import { ESTADO_EMERGENCIA_INFO, faltanteEmergencia, listadoGeneral, terminadasLinea, TIPO_LABEL } from "@/lib/calculos";
import { ordenesReposicionAbiertas } from "@/lib/emergencia";
import FormAccion from "@/components/FormAccion";
import { fecha, fechaHora } from "@/lib/formato";
import type { Pedido } from "@/lib/tipos";
import BotonAccion from "@/components/BotonAccion";
import { Compartido } from "@/components/Estado";
import { guardarMinimo, recepcionarPedido, revisarEmergenciaAhora } from "./acciones";

export const dynamic = "force-dynamic";

const totalPiezas = (p: Pedido) => p.piezas.reduce((s, x) => s + x.cantidad - x.entregada, 0) + p.items.reduce((s, x) => s + x.cantidad, 0);

/**
 * 1 · Órdenes de producción.
 * Arriba, los pedidos que llegaron por QR y falta recepcionar. Abajo, las órdenes en producción:
 * si elegís una ves su listado con la fecha; si no, el listado general con todo lo pedido sumado.
 * Cuando un pedido pasa a "Pedidos entregados" (finalizado) deja de sumar acá.
 */
export default async function OrdenesPage({ searchParams }: { searchParams: Promise<{ orden?: string }> }) {
  const { orden } = await searchParams;
  const [cat, pendientes, ordenes, reposicion] = await Promise.all([
    cargarCatalogo(),
    cargarPedidos(["pendiente"]),
    cargarPedidos(["en_produccion"], { col: "recepcionado_en" }),
    ordenesReposicionAbiertas(),
  ]);
  const elegida = ordenes.find((o) => o.id === orden) ?? null;
  const mostrar = elegida ? [elegida] : ordenes;
  const listado = Object.entries(listadoGeneral(mostrar))
    .map(([clave, cantidad]) => {
      const [id, comp = null] = clave.split("|");
      return { clave, inst: cat.porId.get(id), comp, cantidad };
    })
    .filter((x): x is typeof x & { inst: NonNullable<typeof x.inst> } => !!x.inst)
    .sort((a, b) => a.inst.orden - b.inst.orden || a.inst.codigo.localeCompare(b.inst.codigo, "es", { numeric: true }));
  const cajasPedidas = new Map<string, number>();
  for (const p of mostrar) for (const it of p.items) cajasPedidas.set(it.caja_id, (cajasPedidas.get(it.caja_id) ?? 0) + it.cantidad);

  return (
    <div className="space-y-6">
      {/* Por recepcionar */}
      <section className="space-y-3">
        <h2 className="titulo text-2xl">Pedidos por recepcionar {pendientes.length > 0 && <span className="text-proceso">({pendientes.length})</span>}</h2>
        {pendientes.length === 0 ? (
          <p className="card p-4 text-tenue text-sm">No hay pedidos nuevos. Los que hagan con el QR aparecen acá.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {pendientes.map((p) => (
              <li key={p.id} className="card p-4 space-y-2 border-acento">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/produccion/pedido/${p.id}`} className="font-mono font-semibold underline">
                      {p.numero}
                    </Link>
                    <p className="font-semibold">{p.cliente}</p>
                    <p className="font-mono text-xs text-tenue">
                      {fechaHora(p.creado_en)} · {p.origen === "qr" ? "por QR" : "cargado a mano"}
                    </p>
                  </div>
                  <span className="rounded-full bg-superficie-2 px-2 py-0.5 text-xs font-semibold">{totalPiezas(p)} piezas</span>
                </div>
                <p className="text-sm text-tenue">
                  {p.piezas.map((x) => `${x.cantidad} × ${nombreLinea(cat, x.instrumental_id, x.componente_id)}`).join(" · ")}
                </p>
                <div className="flex flex-wrap gap-2">
                  <BotonAccion accion={recepcionarPedido.bind(null, p.id)} className="btn btn-primario">
                    📥 Recepcionar (crear orden)
                  </BotonAccion>
                  <Link href={`/produccion/pedido/${p.id}`} className="btn">
                    Ver
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Stock de emergencia */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="titulo text-2xl">🛟 Stock de emergencia</h2>
            <p className="text-sm text-tenue">
              Cajas completas y terminadas, listas para entregar. Si una entrega deja una caja por debajo del mínimo, la app crea sola una orden de
              reposición y avisa por Telegram. La orden se cumple cuando las cajas armadas vuelven al mínimo.
            </p>
          </div>
          <BotonAccion accion={revisarEmergenciaAhora} className="btn">
            Revisar ahora
          </BotonAccion>
        </div>
        <div className="overflow-x-auto card">
          <table className="tabla">
            <thead>
              <tr>
                <th>Caja</th>
                <th className="text-right">Armadas</th>
                <th>Mínimo</th>
                <th>Estado</th>
                <th>Órdenes de reposición</th>
              </tr>
            </thead>
            <tbody>
              {cat.cajas.map((c) => {
                const abiertas = reposicion.filter((o) => o.caja_id === c.id);
                const enOrdenes = abiertas.reduce((s, o) => s + o.cantidad, 0);
                const e = faltanteEmergencia(c.stock_minimo, c.cajas_armadas, enOrdenes);
                const info = ESTADO_EMERGENCIA_INFO[e.estado];
                return (
                  <tr key={c.id}>
                    <td className="font-semibold">{c.nombre}</td>
                    <td className="text-right font-mono text-lg">{c.cajas_armadas}</td>
                    <td>
                      <FormAccion accion={guardarMinimo.bind(null, c.id)} className="flex items-center gap-2" limpiar={false} textoBoton="Guardar">
                        <input name="minimo" type="number" min={0} inputMode="numeric" defaultValue={c.stock_minimo} className="campo w-20 font-mono" aria-label={`Mínimo de ${c.nombre}`} />
                      </FormAccion>
                    </td>
                    <td className={`font-semibold ${info.clase}`}>
                      {info.icono} {c.stock_minimo === 0 ? "Sin mínimo" : e.faltan === 0 ? info.label : `Faltan ${e.faltan}`}
                    </td>
                    <td className="text-sm">
                      {abiertas.length === 0 ? (
                        <span className="text-tenue">—</span>
                      ) : (
                        <ul className="space-y-1">
                          {abiertas.map((o) => (
                            <li key={o.id}>
                              <span className="font-mono font-semibold">{o.numero}</span> · {o.cantidad} {o.cantidad === 1 ? "caja" : "cajas"} · desde {fecha(o.creado_en)}
                            </li>
                          ))}
                        </ul>
                      )}
                      {e.faltan > 0 && (
                        <Link href={`/stock/fabricar?caja=${c.id}&n=${e.faltan}`} className="underline text-acento">
                          Qué fabricar para {e.faltan} {e.faltan === 1 ? "caja" : "cajas"} →
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Órdenes en producción */}
      <section className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <div className="space-y-2">
          <h2 className="titulo text-2xl">Órdenes</h2>
          <Link href="/produccion" className={`card block p-3 ${!elegida ? "border-acento bg-acento/10" : "hover:border-acento"}`} aria-current={!elegida ? "true" : undefined}>
            <span className="font-semibold">Listado general</span>
            <span className="block text-xs text-tenue">
              {ordenes.length} {ordenes.length === 1 ? "orden sumada" : "órdenes sumadas"}
            </span>
          </Link>
          {ordenes.length === 0 && <p className="text-sm text-tenue">No hay órdenes en producción.</p>}
          <ul className="space-y-2">
            {ordenes.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/produccion?orden=${o.id}`}
                  className={`card block p-3 ${elegida?.id === o.id ? "border-acento bg-acento/10" : "hover:border-acento"}`}
                  aria-current={elegida?.id === o.id ? "true" : undefined}
                >
                  <span className="font-mono text-sm font-semibold">{o.numero}</span> · {o.cliente}
                  <span className="block text-xs text-tenue font-mono">
                    Pedido {fecha(o.fecha_pedido)} · {totalPiezas(o)} piezas
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-4 space-y-3 min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="titulo text-2xl">{elegida ? `Orden ${elegida.numero} · ${elegida.cliente}` : "Listado general (todo sumado)"}</h3>
              <p className="text-sm text-tenue">
                {elegida
                  ? `Pedido el ${fecha(elegida.fecha_pedido)}${elegida.recepcionado_en ? ` · recepcionado el ${fechaHora(elegida.recepcionado_en)} por ${elegida.recepcionado_por}` : ""}`
                  : "Suma de todas las órdenes en producción. Lo que se finaliza pasa a «Pedidos entregados» y se descuenta de acá."}
              </p>
            </div>
            {elegida && (
              <Link href={`/produccion/pedido/${elegida.id}`} className="btn btn-primario">
                Armar pedido →
              </Link>
            )}
          </div>
          {listado.length === 0 && cajasPedidas.size === 0 ? (
            <p className="text-tenue">Nada para producir.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Pieza</th>
                    <th>Tipo</th>
                    <th className="text-right">Falta entregar</th>
                    <th className="text-right">Terminadas</th>
                    <th className="text-right">Faltan</th>
                  </tr>
                </thead>
                <tbody>
                  {listado.map(({ clave, inst, comp, cantidad }) => {
                    const hay = terminadasLinea(inst, comp);
                    const faltan = Math.max(0, cantidad - hay);
                    return (
                      <tr key={clave}>
                        <td>
                          <Link href={`/produccion/partes?pieza=${inst.id}`} className="font-semibold hover:underline">
                            {nombreLinea(cat, inst.id, comp)}
                          </Link>{" "}
                          <Compartido cajas={usosDe(cat, inst.id).map((u) => u.caja.codigo)} />
                          <span className="block font-mono text-xs text-tenue">{inst.codigo}</span>
                        </td>
                        <td className="text-sm">{comp ? "Medida suelta" : TIPO_LABEL[inst.tipo]}</td>
                        <td className="text-right font-mono font-semibold">{cantidad}</td>
                        <td className="text-right font-mono">{hay}</td>
                        <td className={`text-right font-mono font-semibold ${faltan === 0 ? "text-disponible" : "text-falta"}`}>{faltan === 0 ? "✓ 0" : `✕ ${faltan}`}</td>
                      </tr>
                    );
                  })}
                  {[...cajasPedidas].map(([cajaId, n]) => {
                    const caja = cat.cajas.find((c) => c.id === cajaId);
                    const faltan = Math.max(0, n - (caja?.cajas_armadas ?? 0));
                    return (
                      <tr key={cajaId}>
                        <td className="font-semibold">{caja?.nombre ?? "Caja archivada"} (caja completa)</td>
                        <td className="text-sm">Caja</td>
                        <td className="text-right font-mono font-semibold">{n}</td>
                        <td className="text-right font-mono">{caja?.cajas_armadas ?? 0}</td>
                        <td className={`text-right font-mono font-semibold ${faltan === 0 ? "text-disponible" : "text-falta"}`}>{faltan === 0 ? "✓ 0" : `✕ ${faltan}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
