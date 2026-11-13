import Link from "next/link";
import { db, sinError } from "@/lib/db";
import { cargarCatalogo } from "@/lib/datos";
import { fecha, hoyISO } from "@/lib/formato";
import { ESTADO_PEDIDO_LABEL, type Pedido } from "@/lib/tipos";
import FormAccion from "@/components/FormAccion";
import ItemsPedido from "./ItemsPedido";
import { crearPedido } from "./acciones";
import { ESTADO_PEDIDO_CLASE } from "./estilos";


export default async function PedidosPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const { ver } = await searchParams;
  const todos = ver === "todos";
  const cat = await cargarCatalogo();
  let q = db().from("pedidos").select("*, items:pedido_items(*)").order("fecha_compromiso", { ascending: true, nullsFirst: false }).order("creado_en");
  if (!todos) q = q.in("estado", ["pendiente", "en_produccion", "listo"]);
  const pedidos = sinError(await q) as Pedido[];
  const hoy = hoyISO();
  const nombreCaja = (id: string) => cat.cajas.find((c) => c.id === id)?.nombre ?? "Caja archivada";
  const vencidos = pedidos.filter((p) => p.fecha_compromiso && p.fecha_compromiso < hoy && ["pendiente", "en_produccion", "listo"].includes(p.estado));

  return (
    <div className="space-y-5">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-tenue">
          <Link href="/admin" className="hover:underline">
            Administración
          </Link>{" "}
          / Pedidos
        </p>
        <h1 className="titulo text-4xl">Pedidos</h1>
      </div>

      {vencidos.length > 0 && (
        <p role="alert" className="card border-falta bg-falta-bg text-falta p-3 font-semibold">
          ✕ {vencidos.length} {vencidos.length === 1 ? "pedido vencido" : "pedidos vencidos"}: {vencidos.map((p) => p.numero).join(", ")}
        </p>
      )}

      <div className="flex gap-2">
        <Link href="/admin/pedidos" className={`btn ${!todos ? "btn-primario" : ""}`}>
          Abiertos
        </Link>
        <Link href="/admin/pedidos?ver=todos" className={`btn ${todos ? "btn-primario" : ""}`}>
          Todos
        </Link>
        <Link href="/stock/fabricar?modo=pedidos" className="btn ml-auto">
          Qué fabricar para los pedidos
        </Link>
      </div>

      {pedidos.length === 0 ? (
        <p className="card p-6 text-tenue">{todos ? "Todavía no hay pedidos." : "No hay pedidos abiertos."} Cargá uno acá abajo.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>N°</th>
                <th>Cliente</th>
                <th>Cajas</th>
                <th>Pedido</th>
                <th>Comprometido</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => {
                const vencido = vencidos.includes(p);
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/pedidos/${p.id}`} className="font-mono font-semibold underline">
                        {p.numero}
                      </Link>
                    </td>
                    <td>{p.cliente}</td>
                    <td className="text-sm">{p.items.map((i) => `${i.cantidad} × ${nombreCaja(i.caja_id)}`).join(" · ")}</td>
                    <td className="font-mono text-xs">{fecha(p.fecha_pedido)}</td>
                    <td className={`font-mono text-xs ${vencido ? "text-falta font-bold" : ""}`}>
                      {p.fecha_compromiso ? fecha(p.fecha_compromiso) : "—"}
                      {vencido && " ✕ vencido"}
                    </td>
                    <td>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ESTADO_PEDIDO_CLASE[p.estado]}`}>{ESTADO_PEDIDO_LABEL[p.estado]}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <details className="card p-4 max-w-3xl" open={pedidos.length === 0}>
        <summary className="cursor-pointer font-semibold">+ Nuevo pedido</summary>
        {cat.cajas.length === 0 ? (
          <p className="mt-3 text-sm text-tenue">Primero creá una caja.</p>
        ) : (
          <FormAccion accion={crearPedido} className="mt-4 grid gap-3 sm:grid-cols-2" textoBoton="Crear pedido">
            <label>
              <span className="etiqueta">Número</span>
              <input name="numero" className="campo font-mono" required />
            </label>
            <label>
              <span className="etiqueta">Cliente</span>
              <input name="cliente" className="campo" required />
            </label>
            <label>
              <span className="etiqueta">Fecha del pedido</span>
              <input name="fecha_pedido" type="date" defaultValue={hoy} className="campo" />
            </label>
            <label>
              <span className="etiqueta">Fecha comprometida</span>
              <input name="fecha_compromiso" type="date" className="campo" />
            </label>
            <ItemsPedido cajas={cat.cajas} />
            <label className="sm:col-span-2">
              <span className="etiqueta">Notas</span>
              <textarea name="notas" className="campo" rows={2} />
            </label>
          </FormAccion>
        )}
      </details>
    </div>
  );
}
