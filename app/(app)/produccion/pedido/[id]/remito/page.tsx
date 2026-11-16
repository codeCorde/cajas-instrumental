import Link from "next/link";
import { notFound } from "next/navigation";
import { cargarCatalogo, leerApariencia } from "@/lib/datos";
import { pedidoPorId } from "@/lib/pedidos";
import { fecha, fechaHora } from "@/lib/formato";
import BotonImprimir from "@/components/BotonImprimir";
import MarcaInstrumentARG from "@/components/MarcaInstrumentARG";

export const dynamic = "force-dynamic";

/** Remito del pedido entregado, con las dos firmas (quien pidió y quien recibió). Para imprimir o guardar como PDF. */
export default async function RemitoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, cat, ap] = await Promise.all([pedidoPorId(id), cargarCatalogo(), leerApariencia()]);
  if (!p) notFound();

  return (
    <div className="space-y-4">
      <div className="no-imprimir flex flex-wrap items-center justify-between gap-2">
        <Link href={`/produccion/pedido/${p.id}`} className="btn">
          ← Volver al pedido
        </Link>
        <BotonImprimir texto="Imprimir / guardar PDF" />
      </div>
      {p.estado !== "entregado" && (
        <p className="no-imprimir card border-proceso bg-proceso-bg text-proceso p-3 font-semibold">■ Este pedido todavía no está firmado: el remito queda como borrador.</p>
      )}
      <article className="card mx-auto bg-white text-black p-8 space-y-6" style={{ maxWidth: "19cm" }}>
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-black pb-4">
          <div>
            <MarcaInstrumentARG tam="chica" />
            <p className="text-sm mt-1">{ap.empresa}</p>
          </div>
          <div className="text-right">
            <p className="titulo text-3xl">Remito</p>
            <p className="font-mono">N° {p.numero}</p>
            <p className="font-mono text-sm">{p.recibido_en ? fecha(p.recibido_en) : "Borrador"}</p>
          </div>
        </header>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="font-semibold">Solicitante</dt>
          <dd>{p.cliente}</dd>
          <dt className="font-semibold">Inicio del pedido</dt>
          <dd className="font-mono">{fechaHora(p.creado_en)}</dd>
          <dt className="font-semibold">Finalizado</dt>
          <dd className="font-mono">{p.finalizado_en ? fechaHora(p.finalizado_en) : "—"}</dd>
          <dt className="font-semibold">Recepción</dt>
          <dd className="font-mono">{p.recibido_en ? fechaHora(p.recibido_en) : "—"}</dd>
        </dl>

        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-1">Cant.</th>
              <th className="py-1">Descripción</th>
              <th className="py-1">Caja</th>
            </tr>
          </thead>
          <tbody>
            {p.piezas.map((x) => (
              <tr key={x.id} className="border-b border-neutral-300">
                <td className="py-1 font-mono">{x.cantidad}</td>
                <td className="py-1">{cat.porId.get(x.instrumental_id)?.nombre ?? "Pieza"}</td>
                <td className="py-1">{cat.cajas.find((c) => c.id === x.caja_id)?.nombre ?? "—"}</td>
              </tr>
            ))}
            {p.items.map((x) => (
              <tr key={x.id} className="border-b border-neutral-300">
                <td className="py-1 font-mono">{x.cantidad}</td>
                <td className="py-1">{cat.cajas.find((c) => c.id === x.caja_id)?.nombre ?? "Caja"} (caja completa)</td>
                <td className="py-1">—</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grid grid-cols-2 gap-8 pt-6">
          <Firma titulo="Firma de quien pidió" nombre={p.cliente} png={p.firma_solicitante} />
          <Firma titulo="Firma de quien recibió" nombre={p.recibido_por} png={p.firma_recepcion} />
        </div>
      </article>
    </div>
  );
}

function Firma({ titulo, nombre, png }: { titulo: string; nombre: string | null; png: string | null }) {
  const valida = png?.startsWith("data:image/png;base64,");
  return (
    <div className="text-center text-sm">
      <div className="h-28 flex items-end justify-center border-b border-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {valida ? <img src={png!} alt={`${titulo}: ${nombre ?? ""}`} className="max-h-28 object-contain" /> : <span className="text-neutral-400">Sin firma</span>}
      </div>
      <p className="mt-1 font-semibold">{nombre ?? "—"}</p>
      <p className="text-xs">{titulo}</p>
    </div>
  );
}
