import Link from "next/link";
import { cargarPedidos } from "@/lib/pedidos";
import { fecha, fechaHora } from "@/lib/formato";
import type { Pedido } from "@/lib/tipos";
import { EstadoPedidoChip } from "@/components/EstadoPedido";

export const dynamic = "force-dynamic";

type Vista = "entregados" | "parciales" | "cancelados";

/**
 * 4 · Pedidos entregados. Finalizado (letras naranjas) → «Firmar» → Entregado (letras verdes) con su remito.
 * Info completa: inicio del pedido, solicitante, fecha de finalizado y fecha de recepción.
 * También: pedidos con entregas parciales y el registro de pedidos cancelados (quién, cuándo y por qué).
 */
export default async function EntregadosPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const { ver } = await searchParams;
  const vista: Vista = ver === "parciales" || ver === "cancelados" ? ver : "entregados";
  let pedidos: Pedido[];
  if (vista === "cancelados") pedidos = await cargarPedidos(["cancelado"], { col: "cancelado_en", asc: false });
  else if (vista === "parciales") pedidos = (await cargarPedidos(["en_produccion"], { col: "recepcionado_en" })).filter((p) => p.piezas.some((x) => x.entregada > 0));
  else {
    pedidos = await cargarPedidos(["listo", "entregado"], { col: "finalizado_en", asc: false });
    pedidos.sort((a, b) => Number(b.estado === "listo") - Number(a.estado === "listo"));
  }
  const pestanas: [Vista, string][] = [
    ["entregados", "Finalizados y entregados"],
    ["parciales", "Con entregas parciales"],
    ["cancelados", "Cancelados"],
  ];

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2" aria-label="Filtro">
        {pestanas.map(([v, t]) => (
          <Link key={v} href={v === "entregados" ? "/produccion/entregados" : `/produccion/entregados?ver=${v}`} className={`btn ${vista === v ? "btn-primario" : ""}`} aria-current={vista === v ? "page" : undefined}>
            {t}
          </Link>
        ))}
      </nav>
      {pedidos.length === 0 ? (
        <p className="card p-6 text-tenue">
          {vista === "cancelados" ? "No hay pedidos cancelados." : vista === "parciales" ? "No hay pedidos con entregas parciales." : "Todavía no hay pedidos finalizados."}
        </p>
      ) : vista === "cancelados" ? (
        <div className="card overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>N°</th>
                <th>Inicio del pedido</th>
                <th>Solicitante</th>
                <th>Cancelado</th>
                <th>Por</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/produccion/pedido/${p.id}`} className="font-mono font-semibold underline line-through">
                      {p.numero}
                    </Link>
                  </td>
                  <td className="font-mono text-xs">{fecha(p.fecha_pedido)}</td>
                  <td>{p.cliente}</td>
                  <td className="font-mono text-xs">{p.cancelado_en ? fechaHora(p.cancelado_en) : "—"}</td>
                  <td className="text-sm">{p.cancelado_por ?? "—"}</td>
                  <td className="text-sm">{p.motivo_cancelacion ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>N°</th>
                <th>Estado</th>
                <th>Inicio del pedido</th>
                <th>Solicitante</th>
                <th>{vista === "parciales" ? "Entregado hasta ahora" : "Finalizado"}</th>
                <th>Recepción</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => {
                const entregadas = p.piezas.reduce((s, x) => s + x.entregada, 0);
                const total = p.piezas.reduce((s, x) => s + x.cantidad, 0);
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/produccion/pedido/${p.id}`} className="font-mono font-semibold underline">
                        {p.numero}
                      </Link>
                    </td>
                    <td>
                      {vista === "parciales" ? (
                        <span className="rounded-full bg-proceso-bg text-proceso px-2 py-0.5 text-[11px] font-semibold">◐ Parcial</span>
                      ) : (
                        <EstadoPedidoChip estado={p.estado} chico />
                      )}
                    </td>
                    <td className="font-mono text-xs">{fecha(p.fecha_pedido)}</td>
                    <td>{p.cliente}</td>
                    <td className="font-mono text-xs">{vista === "parciales" ? `${entregadas} de ${total} piezas` : p.finalizado_en ? fechaHora(p.finalizado_en) : "—"}</td>
                    <td className="font-mono text-xs">{p.recibido_en ? `${fechaHora(p.recibido_en)} · ${p.recibido_por}` : "—"}</td>
                    <td className="whitespace-nowrap">
                      {p.estado === "listo" && (
                        <Link href={`/produccion/pedido/${p.id}#firmar`} className="btn btn-primario text-sm">
                          ✍ Firmar
                        </Link>
                      )}
                      {(p.estado === "entregado" || vista === "parciales") && (
                        <Link href={`/produccion/pedido/${p.id}/remito`} className="btn text-sm">
                          🧾 Remito
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
