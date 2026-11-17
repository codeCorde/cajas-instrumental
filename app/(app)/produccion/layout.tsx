import Link from "next/link";
import { db } from "@/lib/db";
import Pestanas from "./Pestanas";

/** Producción: las 4 pestañas de la foto "Órdenes de producción". */
export default async function ProduccionLayout({ children }: { children: React.ReactNode }) {
  const [porRecepcionar, sinFirmar] = await Promise.all([
    db().from("pedidos").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
    db().from("pedidos").select("id", { count: "exact", head: true }).eq("estado", "listo"),
  ]);
  return (
    <div className="space-y-5">
      <div className="no-imprimir flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-tenue">Producción</p>
          <h1 className="titulo text-4xl">Producción</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/pedir" className="btn" target="_blank">
            + Cargar pedido a mano
          </Link>
          <Link href="/produccion/qr" className="btn">
            QR de pedidos
          </Link>
          <Link href="/produccion/faltantes" className="btn">
            ❓ Info que falta
          </Link>
          <Link href="/produccion/avisos" className="btn">
            🔔 Avisos al celular
          </Link>
        </div>
      </div>
      <div className="no-imprimir">
        <Pestanas porRecepcionar={porRecepcionar.count ?? 0} sinFirmar={sinFirmar.count ?? 0} />
      </div>
      {children}
    </div>
  );
}
