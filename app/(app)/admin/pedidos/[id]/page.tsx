import Link from "next/link";
import { notFound } from "next/navigation";
import { db, sinError } from "@/lib/db";
import { cargarCatalogo, resumenDe } from "@/lib/datos";
import { cajasParaPedidos, filasFabricar } from "@/lib/fabricar";
import { fecha, fechaHora, hoyISO } from "@/lib/formato";
import { ESTADO_PEDIDO_LABEL, RESULTADO_LABEL, type EstadoPedido, type Inspeccion, type Pedido } from "@/lib/tipos";
import FormAccion from "@/components/FormAccion";
import BotonAccion from "@/components/BotonAccion";
import TablaFabricar from "@/components/TablaFabricar";
import ItemsPedido from "../ItemsPedido";
import { ESTADO_PEDIDO_CLASE } from "../estilos";
import { borrarPedido, cambiarEstadoPedido, editarPedido, entregarPedido } from "../acciones";

const CAMBIOS: EstadoPedido[] = ["pendiente", "en_produccion", "listo", "cancelado"];

export default async function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await db().from("pedidos").select("*, items:pedido_items(*)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const p = data as Pedido;
  const [cat, inspecciones] = await Promise.all([
    cargarCatalogo(),
    db().from("inspecciones").select("*").eq("pedido_id", id).order("fecha", { ascending: false }).then((r) => sinError(r) as Inspeccion[]),
  ]);
  const abierto = ["pendiente", "en_produccion", "listo"].includes(p.estado);
  const vencido = abierto && !!p.fecha_compromiso && p.fecha_compromiso < hoyISO();
  const faltan = cajasParaPedidos(cat, [p]);
  const filas = filasFabricar(cat, faltan);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-tenue">
            <Link href="/admin/pedidos" className="hover:underline">
              Pedidos
            </Link>{" "}
            / {p.numero}
          </p>
          <h1 className="titulo text-4xl">
            Pedido {p.numero} · {p.cliente}
          </h1>
          <p className="text-sm text-tenue">
            Pedido el {fecha(p.fecha_pedido)}
            {p.fecha_compromiso && (
              <span className={vencido ? "text-falta font-bold" : ""}>
                {" "}
                · comprometido para el {fecha(p.fecha_compromiso)}
                {vencido && " ✕ VENCIDO"}
              </span>
            )}
            {p.entregado_en && ` · entregado el ${fechaHora(p.entregado_en)}`}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${ESTADO_PEDIDO_CLASE[p.estado]}`}>{ESTADO_PEDIDO_LABEL[p.estado]}</span>
      </div>

      {/* Seguimiento */}
      <section className="card p-4 space-y-3">
        <h2 className="titulo text-2xl">Seguimiento</h2>
        <div className="overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Caja</th>
                <th className="text-right">Pedidas</th>
                <th className="text-right">Armadas</th>
                <th className="text-right">Se pueden armar</th>
                <th className="text-right">Faltan armar</th>
              </tr>
            </thead>
            <tbody>
              {p.items.map((it) => {
                const caja = cat.cajas.find((c) => c.id === it.caja_id);
                const posibles = caja ? resumenDe(cat, caja).posibles : 0;
                const f = faltan[it.caja_id] ?? 0;
                return (
                  <tr key={it.id}>
                    <td className="font-semibold">{caja?.nombre ?? "Caja archivada"}</td>
                    <td className="text-right font-mono">{it.cantidad}</td>
                    <td className="text-right font-mono">{caja?.cajas_armadas ?? 0}</td>
                    <td className="text-right font-mono">{posibles}</td>
                    <td className={`text-right font-mono font-semibold ${f === 0 ? "text-disponible" : f <= posibles ? "text-proceso" : "text-falta"}`}>
                      {f === 0 ? "✓ 0" : f}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {abierto &&
          (filas.length === 0 ? (
            <p className="text-disponible font-semibold">✓ No hace falta fabricar nada para este pedido{Object.keys(faltan).length ? " (alcanza con armar las cajas)" : ""}.</p>
          ) : (
            <>
              <h3 className="titulo text-xl">Qué fabricar para cumplirlo</h3>
              <TablaFabricar filas={filas} archivoCsv={`fabricar-pedido-${p.numero}.csv`} />
            </>
          ))}
      </section>

      {abierto && (
        <section className="card p-4 space-y-3">
          <h2 className="titulo text-2xl">Estado</h2>
          <div className="flex flex-wrap gap-2">
            {CAMBIOS.filter((e) => e !== p.estado).map((e) => (
              <BotonAccion key={e} accion={cambiarEstadoPedido.bind(null, p.id, e)} className="btn" ok={`Pasó a ${ESTADO_PEDIDO_LABEL[e]}`} confirmar={e === "cancelado" ? "¿Cancelar el pedido?" : undefined}>
                Pasar a «{ESTADO_PEDIDO_LABEL[e]}»
              </BotonAccion>
            ))}
          </div>
          <FormAccion accion={entregarPedido.bind(null, p.id)} className="flex flex-wrap items-center gap-3 border-t border-borde pt-3" textoBoton="✓ Marcar como entregado" confirmar="¿Marcar el pedido como entregado?">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="descontar" defaultChecked className="w-5 h-5" />
              Descontar las cajas armadas que se entregan ({p.items.map((i) => `${i.cantidad} × ${cat.cajas.find((c) => c.id === i.caja_id)?.codigo ?? "?"}`).join(", ")})
            </label>
          </FormAccion>
        </section>
      )}

      {/* Calidad */}
      <section className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="titulo text-2xl">Control de calidad</h2>
          <Link href={`/admin/calidad/nueva?entidad=pedido&id=${p.id}`} className="btn">
            + Nueva inspección
          </Link>
        </div>
        {inspecciones.length === 0 ? (
          <p className="text-sm text-tenue">Sin inspecciones de este pedido.</p>
        ) : (
          <ul className="divide-y divide-borde">
            {inspecciones.map((x) => (
              <li key={x.id} className="py-2 flex gap-3 items-center">
                <span className="font-mono text-xs">{fecha(x.fecha)}</span>
                <Link href={`/admin/calidad/${x.id}`} className="font-semibold underline">
                  {RESULTADO_LABEL[x.resultado]}
                </Link>
                <span className="text-sm text-tenue">{x.inspector}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="card p-4">
        <summary className="cursor-pointer font-semibold">Editar pedido</summary>
        <FormAccion accion={editarPedido.bind(null, p.id)} className="mt-4 grid gap-3 sm:grid-cols-2" limpiar={false}>
          <label>
            <span className="etiqueta">Número</span>
            <input name="numero" defaultValue={p.numero} className="campo font-mono" required />
          </label>
          <label>
            <span className="etiqueta">Cliente</span>
            <input name="cliente" defaultValue={p.cliente} className="campo" required />
          </label>
          <label>
            <span className="etiqueta">Fecha del pedido</span>
            <input name="fecha_pedido" type="date" defaultValue={p.fecha_pedido} className="campo" />
          </label>
          <label>
            <span className="etiqueta">Fecha comprometida</span>
            <input name="fecha_compromiso" type="date" defaultValue={p.fecha_compromiso ?? ""} className="campo" />
          </label>
          <ItemsPedido cajas={cat.cajas} iniciales={p.items} />
          <label className="sm:col-span-2">
            <span className="etiqueta">Notas</span>
            <textarea name="notas" defaultValue={p.notas ?? ""} className="campo" rows={2} />
          </label>
        </FormAccion>
        <div className="mt-4 border-t border-borde pt-3">
          <BotonAccion accion={borrarPedido.bind(null, p.id)} className="btn btn-peligro text-sm" confirmar={`¿Borrar el pedido ${p.numero}? No se puede deshacer.`}>
            Borrar pedido
          </BotonAccion>
        </div>
      </details>
      {p.notas && (
        <section className="card p-4">
          <h2 className="etiqueta">Notas</h2>
          <p className="text-sm whitespace-pre-line">{p.notas}</p>
        </section>
      )}
    </div>
  );
}
