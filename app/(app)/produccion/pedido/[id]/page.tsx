import Link from "next/link";
import { notFound } from "next/navigation";
import { cargarCatalogo } from "@/lib/datos";
import { nombreLinea, pedidoPorId } from "@/lib/pedidos";
import { planFinalizarPedido, terminadasLinea, TIPO_LABEL } from "@/lib/calculos";
import { fecha, fechaHora } from "@/lib/formato";
import BotonAccion from "@/components/BotonAccion";
import FormAccion from "@/components/FormAccion";
import FirmaPad from "@/components/FirmaPad";
import { EstadoPedidoChip } from "@/components/EstadoPedido";
import { cancelarPedido, finalizarPedido, firmarPedido, recepcionarPedido } from "../../acciones";
import EntregarParcial from "./EntregarParcial";

export const dynamic = "force-dynamic";

export default async function PedidoProduccionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, cat] = await Promise.all([pedidoPorId(id), cargarCatalogo()]);
  if (!p) notFound();

  const piezas = p.piezas
    .map((x) => ({ ...x, inst: cat.porId.get(x.instrumental_id), nombre: nombreLinea(cat, x.instrumental_id, x.componente_id), pendiente: x.cantidad - x.entregada }))
    .filter((x): x is typeof x & { inst: NonNullable<typeof x.inst> } => !!x.inst);
  const cajas = p.items.map((it) => {
    const c = cat.cajas.find((k) => k.id === it.caja_id);
    return { nombre: c?.nombre ?? "Caja archivada", cajas_armadas: c?.cajas_armadas ?? 0, cantidad: it.cantidad };
  });
  const plan = planFinalizarPedido(
    piezas.map((x) => ({ inst: x.inst, componenteId: x.componente_id, cantidad: x.pendiente })),
    cajas,
  );
  const cancelable = !["entregado", "cancelado"].includes(p.estado);
  const hayParciales = piezas.some((x) => x.entregada > 0);
  const entregas = [...(p.entregas ?? [])].sort((a, b) => a.creado_en.localeCompare(b.creado_en));

  const pasos = [
    { t: "Inicio del pedido", v: fechaHora(p.creado_en), extra: p.origen === "qr" ? "por QR" : "cargado a mano" },
    { t: "Recepcionado", v: p.recepcionado_en ? fechaHora(p.recepcionado_en) : null, extra: p.recepcionado_por },
    { t: "Finalizado", v: p.finalizado_en ? fechaHora(p.finalizado_en) : null, extra: p.finalizado_por },
    { t: "Recepción (firmado)", v: p.recibido_en ? fechaHora(p.recibido_en) : null, extra: p.recibido_por },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-tenue">
            <Link href="/produccion" className="hover:underline">
              Órdenes
            </Link>{" "}
            / {p.numero}
          </p>
          <h2 className="titulo text-4xl">
            Pedido {p.numero} · {p.cliente}
          </h2>
          <p className="text-sm text-tenue">Pedido el {fecha(p.fecha_pedido)}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {hayParciales && p.estado !== "entregado" && <span className="rounded-full bg-proceso-bg text-proceso px-3 py-1 text-sm font-semibold">◐ Con entregas parciales</span>}
          <EstadoPedidoChip estado={p.estado} />
        </div>
      </div>

      <ol className="card p-4 grid gap-3 sm:grid-cols-4">
        {pasos.map((s) => (
          <li key={s.t}>
            <span className={`etiqueta ${s.v ? "!text-disponible" : ""}`}>
              {s.v ? "✓" : "○"} {s.t}
            </span>
            <span className="block font-mono text-sm">{s.v ?? "—"}</span>
            {s.v && s.extra && <span className="block text-xs text-tenue">{s.extra}</span>}
          </li>
        ))}
      </ol>

      {p.estado === "cancelado" && (
        <p className="card border-falta bg-falta-bg text-falta p-3 font-semibold">
          ✕ Cancelado {p.cancelado_en ? `el ${fechaHora(p.cancelado_en)}` : ""} por {p.cancelado_por}.{p.motivo_cancelacion ? ` Motivo: ${p.motivo_cancelacion}` : ""}
        </p>
      )}

      {/* Piezas */}
      <section className="card p-4 space-y-3">
        <h3 className="titulo text-2xl">Piezas del pedido</h3>
        <div className="overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Pieza</th>
                <th>Caja</th>
                <th>Tipo</th>
                <th className="text-right">Pedidas</th>
                <th className="text-right">Entregadas</th>
                {p.estado === "en_produccion" && <th className="text-right">Terminadas hoy</th>}
              </tr>
            </thead>
            <tbody>
              {piezas.map((x) => {
                const hay = terminadasLinea(x.inst, x.componente_id);
                return (
                  <tr key={x.id}>
                    <td>
                      <Link href={`/produccion/partes?pieza=${x.inst.id}`} className="font-semibold hover:underline">
                        {x.nombre}
                      </Link>
                    </td>
                    <td className="text-sm">{cat.cajas.find((c) => c.id === x.caja_id)?.nombre ?? "—"}</td>
                    <td className="text-sm">{x.componente_id ? "Medida suelta" : TIPO_LABEL[x.inst.tipo]}</td>
                    <td className="text-right font-mono font-semibold">{x.cantidad}</td>
                    <td className={`text-right font-mono ${x.entregada >= x.cantidad ? "text-disponible font-semibold" : ""}`}>{x.entregada}</td>
                    {p.estado === "en_produccion" && <td className={`text-right font-mono ${hay >= x.pendiente ? "text-disponible" : "text-falta"}`}>{hay}</td>}
                  </tr>
                );
              })}
              {cajas.map((c, i) => (
                <tr key={`caja-${i}`}>
                  <td className="font-semibold">{c.nombre} (caja completa)</td>
                  <td>—</td>
                  <td className="text-sm">Caja</td>
                  <td className="text-right font-mono font-semibold">{c.cantidad}</td>
                  <td className="text-right font-mono">{p.estado === "entregado" ? c.cantidad : 0}</td>
                  {p.estado === "en_produccion" && <td className={`text-right font-mono ${c.cajas_armadas >= c.cantidad ? "text-disponible" : "text-falta"}`}>{c.cajas_armadas}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {p.notas && <p className="text-sm text-tenue whitespace-pre-line">{p.notas}</p>}
      </section>

      {p.estado === "pendiente" && (
        <section className="card p-4 space-y-2">
          <h3 className="titulo text-2xl">Recepcionar</h3>
          <p className="text-sm text-tenue">Al recepcionarlo se crea la orden de producción y suma al listado general.</p>
          <BotonAccion accion={recepcionarPedido.bind(null, p.id)} className="btn btn-primario">
            📥 Recepcionar (crear orden de producción)
          </BotonAccion>
        </section>
      )}

      {p.estado === "en_produccion" && (
        <>
          <section className="card p-4 space-y-3">
            <h3 className="titulo text-2xl">Armar pedido (todo lo que falta)</h3>
            <p className="text-sm text-tenue">Al finalizar se descuenta esto del stock de piezas terminadas y el pedido pasa a «Pedidos entregados» para firmar.</p>
            <ul className="divide-y divide-borde">
              {plan.descuentos.map((d, i) => (
                <li key={i} className="py-1.5 flex justify-between gap-3 text-sm">
                  <span>{d.etiqueta}</span>
                  <span className={`font-mono ${d.hay >= d.cantidad ? "" : "text-falta font-semibold"}`}>
                    −{d.cantidad} <span className="text-tenue">(hay {d.hay})</span>
                  </span>
                </li>
              ))}
            </ul>
            {plan.ok ? (
              <BotonAccion accion={finalizarPedido.bind(null, p.id)} className="btn btn-primario" confirmar={`¿Finalizar el pedido ${p.numero}? Se descuentan las piezas terminadas.`}>
                ✓ Finalizar pedido
              </BotonAccion>
            ) : (
              <div className="space-y-2">
                <p role="alert" className="text-falta font-semibold">
                  ✕ Todavía no alcanza para todo: {plan.faltantes.join(" · ")}
                </p>
                <p className="text-sm text-tenue">Podés entregar lo que ya está terminado con «Entregar parcial».</p>
                <Link href="/produccion/terminadas" className="btn">
                  Ir a Stock de piezas terminadas
                </Link>
              </div>
            )}
          </section>
          {piezas.some((x) => x.pendiente > 0) && (
            <section className="card p-4 space-y-3 border-proceso">
              <h3 className="titulo text-2xl">Entregar parcial</h3>
              <p className="text-sm text-tenue">Elegí qué piezas y cuántas se entregan ahora. Quien recibe firma en tu celular; se descuenta del stock de piezas terminadas.</p>
              <EntregarParcial
                pedidoId={p.id}
                solicitante={p.cliente}
                lineas={piezas.filter((x) => x.pendiente > 0).map((x) => ({ piezaId: x.id, nombre: x.nombre, pendiente: x.pendiente, terminadas: terminadasLinea(x.inst, x.componente_id) }))}
              />
            </section>
          )}
        </>
      )}

      {p.estado === "listo" && (
        <section id="firmar" className="card p-4 space-y-3 border-proceso">
          <h3 className="titulo text-2xl text-proceso">■ Finalizado: falta la firma</h3>
          <p className="text-sm text-tenue">Quien recibe firma en tu celular. Recién después de firmar pasa a «Entregado» y queda el remito.</p>
          <FormAccion accion={firmarPedido.bind(null, p.id)} className="grid gap-3 max-w-lg" textoBoton="✍ Firmar y entregar" botonAparte>
            <label>
              <span className="etiqueta">Nombre de quien recibe</span>
              <input name="recibio" className="campo" defaultValue={p.cliente} required maxLength={80} />
            </label>
            <FirmaPad name="firma" etiqueta="Firma de quien recibe" />
          </FormAccion>
        </section>
      )}

      {entregas.length > 0 && (
        <section className="card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="titulo text-2xl">Entregas</h3>
            <Link href={`/produccion/pedido/${p.id}/remito`} className="btn btn-primario">
              🧾 Ver / imprimir remito
            </Link>
          </div>
          <ul className="divide-y divide-borde">
            {entregas.map((e) => (
              <li key={e.id} className="py-2 flex flex-wrap items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={e.firma} alt={`Firma de ${e.recibido_por}`} className="h-12 bg-white rounded border border-borde" />
                <div className="text-sm">
                  <p className="font-semibold">
                    {e.parcial ? "Entrega parcial" : "Entrega final"} · recibió {e.recibido_por}
                  </p>
                  <p className="font-mono text-xs text-tenue">
                    {fechaHora(e.creado_en)} · entregó {e.autor}
                  </p>
                  <p className="text-xs">
                    {e.piezas
                      .map((ep) => {
                        const pz = p.piezas.find((x) => x.id === ep.pedido_pieza_id);
                        return `${ep.cantidad} × ${pz ? nombreLinea(cat, pz.instrumental_id, pz.componente_id) : "pieza"}`;
                      })
                      .join(" · ")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {cancelable && (
        <details className="card p-4">
          <summary className="cursor-pointer font-semibold text-falta">Cancelar pedido</summary>
          <p className="mt-2 text-sm text-tenue">Se puede cancelar en cualquier momento hasta que se entrega. Queda registrado en «Pedidos entregados → Cancelados».</p>
          <FormAccion
            accion={cancelarPedido.bind(null, p.id)}
            className="mt-3 grid gap-3 max-w-lg"
            textoBoton="Cancelar pedido"
            claseBoton="btn btn-peligro"
            confirmar={`¿Cancelar el pedido ${p.numero}?${p.estado === "listo" ? " Se devuelven al stock las piezas que se habían descontado y no se entregaron." : ""}`}
            botonAparte
          >
            <label>
              <span className="etiqueta">Motivo</span>
              <input name="motivo" className="campo" placeholder="Ej.: el solicitante se olvidó de cancelarlo" />
            </label>
          </FormAccion>
        </details>
      )}

      <p className="text-xs text-tenue">
        Link de seguimiento del solicitante: <span className="font-mono break-all">/pedir/seguimiento/{p.token}</span>
      </p>
    </div>
  );
}
