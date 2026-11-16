import Link from "next/link";
import { notFound } from "next/navigation";
import { cargarCatalogo } from "@/lib/datos";
import { pedidoPorId } from "@/lib/pedidos";
import { piezasTerminadas, planFinalizarPedido, TIPO_LABEL } from "@/lib/calculos";
import { fecha, fechaHora } from "@/lib/formato";
import BotonAccion from "@/components/BotonAccion";
import FormAccion from "@/components/FormAccion";
import FirmaPad from "@/components/FirmaPad";
import { EstadoPedidoChip } from "@/components/EstadoPedido";
import { cancelarPedido, finalizarPedido, firmarPedido, recepcionarPedido } from "../../acciones";

export const dynamic = "force-dynamic";

export default async function PedidoProduccionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, cat] = await Promise.all([pedidoPorId(id), cargarCatalogo()]);
  if (!p) notFound();

  const piezas = p.piezas.map((x) => ({ ...x, inst: cat.porId.get(x.instrumental_id) })).filter((x): x is typeof x & { inst: NonNullable<typeof x.inst> } => !!x.inst);
  const cajas = p.items.map((it) => {
    const c = cat.cajas.find((k) => k.id === it.caja_id);
    return { nombre: c?.nombre ?? "Caja archivada", cajas_armadas: c?.cajas_armadas ?? 0, cantidad: it.cantidad };
  });
  const plan = planFinalizarPedido(piezas.map((x) => ({ inst: x.inst, cantidad: x.cantidad })), cajas);
  const cancelable = !["entregado", "cancelado"].includes(p.estado);

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
        <EstadoPedidoChip estado={p.estado} />
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
                {p.estado === "en_produccion" && <th className="text-right">Terminadas hoy</th>}
              </tr>
            </thead>
            <tbody>
              {piezas.map((x) => {
                const hay = piezasTerminadas(x.inst);
                return (
                  <tr key={x.id}>
                    <td>
                      <Link href={`/produccion/partes?pieza=${x.inst.id}`} className="font-semibold hover:underline">
                        {x.inst.nombre}
                      </Link>
                    </td>
                    <td className="text-sm">{cat.cajas.find((c) => c.id === x.caja_id)?.nombre ?? "—"}</td>
                    <td className="text-sm">{TIPO_LABEL[x.inst.tipo]}</td>
                    <td className="text-right font-mono font-semibold">{x.cantidad}</td>
                    {p.estado === "en_produccion" && <td className={`text-right font-mono ${hay >= x.cantidad ? "text-disponible" : "text-falta"}`}>{hay}</td>}
                  </tr>
                );
              })}
              {cajas.map((c, i) => (
                <tr key={`caja-${i}`}>
                  <td className="font-semibold">{c.nombre} (caja completa)</td>
                  <td>—</td>
                  <td className="text-sm">Caja</td>
                  <td className="text-right font-mono font-semibold">{c.cantidad}</td>
                  {p.estado === "en_produccion" && <td className={`text-right font-mono ${c.cajas_armadas >= c.cantidad ? "text-disponible" : "text-falta"}`}>{c.cajas_armadas}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {p.notas && <p className="text-sm text-tenue whitespace-pre-line">{p.notas}</p>}
      </section>

      {/* Acciones según el estado */}
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
        <section className="card p-4 space-y-3">
          <h3 className="titulo text-2xl">Armar pedido</h3>
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
                ✕ Todavía no alcanza: {plan.faltantes.join(" · ")}
              </p>
              <Link href="/produccion/terminadas" className="btn">
                Ir a Stock de piezas terminadas
              </Link>
            </div>
          )}
        </section>
      )}

      {p.estado === "listo" && (
        <section id="firmar" className="card p-4 space-y-3 border-proceso">
          <h3 className="titulo text-2xl text-proceso">■ Finalizado: falta la firma</h3>
          <p className="text-sm text-tenue">Firma de quien recibe. Recién después de firmar pasa a «Entregado» y queda el remito.</p>
          <FormAccion accion={firmarPedido.bind(null, p.id)} className="grid gap-3 max-w-lg" textoBoton="✍ Firmar y entregar" botonAparte>
            <label>
              <span className="etiqueta">Nombre de quien recibe</span>
              <input name="recibio" className="campo" defaultValue={p.cliente} required maxLength={80} />
            </label>
            <FirmaPad name="firma" etiqueta="Firma de quien recibe" />
          </FormAccion>
        </section>
      )}

      {p.estado === "entregado" && (
        <section className="card p-4 flex flex-wrap items-center justify-between gap-3 border-disponible">
          <p className="text-disponible font-semibold">✓ Entregado y firmado por {p.recibido_por}.</p>
          <Link href={`/produccion/pedido/${p.id}/remito`} className="btn btn-primario">
            🧾 Ver / imprimir remito
          </Link>
        </section>
      )}

      {cancelable && (
        <details className="card p-4">
          <summary className="cursor-pointer font-semibold text-falta">Cancelar pedido</summary>
          <FormAccion
            accion={cancelarPedido.bind(null, p.id)}
            className="mt-3 grid gap-3 max-w-lg"
            textoBoton="Cancelar pedido"
            claseBoton="btn btn-peligro"
            confirmar={`¿Cancelar el pedido ${p.numero}?${p.estado === "listo" ? " Se devuelven al stock las piezas que se habían descontado." : ""}`}
            botonAparte
          >
            <label>
              <span className="etiqueta">Motivo</span>
              <input name="motivo" className="campo" placeholder="Ej.: el cliente se arrepintió" />
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
