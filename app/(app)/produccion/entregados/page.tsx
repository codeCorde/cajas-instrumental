import Link from "next/link";
import { cargarPedidos } from "@/lib/pedidos";
import { fecha, fechaHora } from "@/lib/formato";
import { EstadoPedidoChip } from "@/components/EstadoPedido";

export const dynamic = "force-dynamic";

/**
 * 4 · Pedidos entregados. Finalizado (letras naranjas) → «Firmar» → Entregado (letras verdes) con su remito.
 * Info completa: inicio del pedido, solicitante, fecha de finalizado y fecha de recepción.
 */
export default async function EntregadosPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const { ver } = await searchParams;
  const conCancelados = ver === "cancelados";
  const pedidos = await cargarPedidos(conCancelados ? ["listo", "entregado", "cancelado"] : ["listo", "entregado"], { col: "finalizado_en", asc: false });
  pedidos.sort((a, b) => Number(b.estado === "listo") - Number(a.estado === "listo"));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Link href="/produccion/entregados" className={`btn ${!conCancelados ? "btn-primario" : ""}`}>
          Finalizados y entregados
        </Link>
        <Link href="/produccion/entregados?ver=cancelados" className={`btn ${conCancelados ? "btn-primario" : ""}`}>
          Ver también cancelados
        </Link>
      </div>
      {pedidos.length === 0 ? (
        <p className="card p-6 text-tenue">Todavía no hay pedidos finalizados.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>N°</th>
                <th>Estado</th>
                <th>Inicio del pedido</th>
                <th>Solicitante</th>
                <th>Finalizado</th>
                <th>Recepción</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/produccion/pedido/${p.id}`} className="font-mono font-semibold underline">
                      {p.numero}
                    </Link>
                  </td>
                  <td className={`font-semibold ${p.estado === "listo" ? "text-proceso" : p.estado === "entregado" ? "text-disponible" : "text-sin"}`}>
                    <EstadoPedidoChip estado={p.estado} chico />
                  </td>
                  <td className="font-mono text-xs">{fecha(p.fecha_pedido)}</td>
                  <td>{p.cliente}</td>
                  <td className="font-mono text-xs">{p.finalizado_en ? fechaHora(p.finalizado_en) : "—"}</td>
                  <td className="font-mono text-xs">{p.recibido_en ? `${fechaHora(p.recibido_en)} · ${p.recibido_por}` : "—"}</td>
                  <td className="whitespace-nowrap">
                    {p.estado === "listo" && (
                      <Link href={`/produccion/pedido/${p.id}#firmar`} className="btn btn-primario text-sm">
                        ✍ Firmar
                      </Link>
                    )}
                    {p.estado === "entregado" && (
                      <Link href={`/produccion/pedido/${p.id}/remito`} className="btn text-sm">
                        🧾 Remito
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
