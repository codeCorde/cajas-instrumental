import Link from "next/link";
import { cargarCatalogo } from "@/lib/datos";
import { cajasParaPedidos, filasFabricar, pedidosAbiertos } from "@/lib/fabricar";
import BotonImprimir from "@/components/BotonImprimir";
import TablaFabricar from "@/components/TablaFabricar";

export default async function FabricarPage({ searchParams }: { searchParams: Promise<{ caja?: string; n?: string; modo?: string }> }) {
  const sp = await searchParams;
  const cat = await cargarCatalogo();
  const modo = sp.modo === "pedidos" ? "pedidos" : "caja";
  const caja = cat.cajas.find((c) => c.id === sp.caja) ?? cat.cajas[0];
  const n = Math.min(500, Math.max(1, Math.trunc(Number(sp.n) || 1)));

  let cajas: Record<string, number> = {};
  let titulo = "";
  if (modo === "pedidos") {
    const pedidos = await pedidosAbiertos();
    cajas = cajasParaPedidos(cat, pedidos);
    const partes = Object.entries(cajas).map(([id, k]) => `${k} × ${cat.cajas.find((c) => c.id === id)?.nombre}`);
    titulo = partes.length ? `Para cubrir los pedidos abiertos: ${partes.join(", ")}` : "Los pedidos abiertos se cubren con las cajas ya armadas.";
  } else if (caja) {
    cajas = { [caja.id]: n };
    titulo = `Para armar ${n} ${n === 1 ? "caja" : "cajas"} más de «${caja.nombre}»`;
  }
  const filas = filasFabricar(cat, cajas);

  return (
    <div className="space-y-5">
      <div className="no-imprimir">
        <p className="font-mono text-xs uppercase tracking-widest text-tenue">
          <Link href="/stock" className="hover:underline">
            Stock
          </Link>{" "}
          / Qué fabricar
        </p>
        <h1 className="titulo text-4xl">Qué fabricar</h1>
      </div>

      <div className="no-imprimir card p-4 flex flex-wrap items-end gap-3">
        <form className="flex flex-wrap items-end gap-3" action="/stock/fabricar">
          <label>
            <span className="etiqueta">Caja</span>
            <select name="caja" defaultValue={caja?.id} className="campo w-auto">
              {cat.cajas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="etiqueta">Cuántas cajas más</span>
            <input name="n" type="number" min={1} max={500} defaultValue={n} className="campo w-24 font-mono" />
          </label>
          <button className={`btn ${modo === "caja" ? "btn-primario" : ""}`}>Calcular</button>
        </form>
        <span className="text-tenue text-sm px-2">o</span>
        <Link href="/stock/fabricar?modo=pedidos" className={`btn ${modo === "pedidos" ? "btn-primario" : ""}`}>
          Para los pedidos pendientes
        </Link>
        <div className="ml-auto">
          <BotonImprimir />
        </div>
      </div>

      <section className="card p-4 space-y-3">
        <h2 className="titulo text-2xl">{titulo}</h2>
        <p className="text-xs text-tenue">Se suma lo que necesitan todas las cajas que comparten instrumental y se descuenta lo que ya hay en stock.</p>
        {filas.length === 0 ? (
          <p className="text-disponible font-semibold">✓ No hace falta fabricar nada: alcanza con el stock actual.</p>
        ) : (
          <TablaFabricar filas={filas} archivoCsv={`que-fabricar-${modo === "pedidos" ? "pedidos" : `${caja?.codigo}-x${n}`}.csv`} />
        )}
      </section>
    </div>
  );
}
