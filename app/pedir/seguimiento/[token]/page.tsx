import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cargarCatalogo } from "@/lib/datos";
import { pedidoPorToken } from "@/lib/pedidos";
import { fecha, fechaHora } from "@/lib/formato";
import { ESTADO_PEDIDO_LABEL } from "@/lib/tipos";
import MarcaInstrumentARG from "@/components/MarcaInstrumentARG";
import { EstadoPedidoChip } from "@/components/EstadoPedido";
import CancelarCliente from "./CancelarCliente";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "InstrumentARG · Seguimiento del pedido", robots: { index: false, follow: false } };

/** Lo que ve el solicitante con su link secreto: estado, piezas y la opción de cancelar. Sin stock ni datos internos. */
export default async function SeguimientoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await pedidoPorToken(token);
  if (!p) notFound();
  const cat = await cargarCatalogo();
  const pasos = [
    { titulo: "Pedido hecho", hecho: true, cuando: fechaHora(p.creado_en) },
    { titulo: "Recepcionado por el taller", hecho: !!p.recepcionado_en, cuando: p.recepcionado_en ? fechaHora(p.recepcionado_en) : null },
    { titulo: "Finalizado (listo para entregar)", hecho: !!p.finalizado_en, cuando: p.finalizado_en ? fechaHora(p.finalizado_en) : null },
    { titulo: "Entregado y firmado", hecho: p.estado === "entregado", cuando: p.recibido_en ? fechaHora(p.recibido_en) : null },
  ];
  const cancelable = !["entregado", "cancelado"].includes(p.estado);

  return (
    <div className="min-h-dvh">
      <header className="border-b border-borde bg-superficie">
        <div className="mx-auto max-w-xl px-4 h-14 flex items-center">
          <MarcaInstrumentARG tam="chica" />
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-5 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="font-mono text-xs text-tenue">Pedido de {p.cliente} · {fecha(p.fecha_pedido)}</p>
            <h1 className="titulo text-3xl">Pedido {p.numero}</h1>
          </div>
          <EstadoPedidoChip estado={p.estado} />
        </div>

        {p.estado === "cancelado" ? (
          <p className="card p-4 text-falta font-semibold">
            ✕ Pedido cancelado{p.cancelado_en ? ` el ${fechaHora(p.cancelado_en)}` : ""}.{p.motivo_cancelacion ? ` Motivo: ${p.motivo_cancelacion}` : ""}
          </p>
        ) : (
          <ol className="card p-4 space-y-3" aria-label="Estado del pedido">
            {pasos.map((s) => (
              <li key={s.titulo} className="flex items-start gap-3">
                <span aria-hidden="true" className={`font-mono text-lg ${s.hecho ? "text-disponible" : "text-tenue"}`}>
                  {s.hecho ? "✓" : "○"}
                </span>
                <span>
                  <span className={s.hecho ? "font-semibold" : "text-tenue"}>{s.titulo}</span>
                  {s.cuando && <span className="block font-mono text-xs text-tenue">{s.cuando}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}

        <section className="card p-4 space-y-2">
          <h2 className="titulo text-xl">Piezas</h2>
          <ul className="divide-y divide-borde">
            {p.piezas.map((it) => (
              <li key={it.id} className="py-2 flex justify-between gap-3">
                <span>
                  {cat.porId.get(it.instrumental_id)?.nombre ?? "Pieza"}
                  {it.caja_id && <span className="block text-xs text-tenue">{cat.cajas.find((c) => c.id === it.caja_id)?.nombre}</span>}
                </span>
                <span className="font-mono font-semibold">× {it.cantidad}</span>
              </li>
            ))}
          </ul>
        </section>

        {cancelable && <CancelarCliente token={p.token} finalizado={p.estado === "listo"} />}
        <p className="text-center text-sm">
          <Link href="/pedir" className="underline">
            Hacer otro pedido
          </Link>
        </p>
        <p className="sr-only">Estado: {ESTADO_PEDIDO_LABEL[p.estado]}</p>
      </main>
    </div>
  );
}
