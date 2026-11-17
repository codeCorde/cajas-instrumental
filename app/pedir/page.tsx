import type { Metadata } from "next";
import { timingSafeEqual } from "node:crypto";
import { catalogoParaPedir, clavePedir } from "@/lib/pedidos";
import { sesionDelEquipo } from "@/lib/sesion-servidor";
import MarcaInstrumentARG from "@/components/MarcaInstrumentARG";
import PedirApp from "./PedirApp";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "InstrumentARG · Hacer un pedido", robots: { index: false, follow: false } };

const iguales = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * QR de pedidos: presentación, elegir caja, cantidades de cada pieza, nombre y firma.
 * No es público: hace falta el link del QR (?k=clave) o tener la sesión del equipo iniciada.
 */
export default async function PedirPage({ searchParams }: { searchParams: Promise<{ k?: string }> }) {
  const { k = "" } = await searchParams;
  const [clave, equipo] = await Promise.all([clavePedir(), sesionDelEquipo()]);
  const permitido = !!equipo || (!!clave && iguales(k, clave));
  if (!permitido)
    return (
      <main className="min-h-dvh grid place-items-center p-4 bg-white text-black">
        <div className="max-w-sm text-center space-y-4">
          <MarcaInstrumentARG />
          <p>Para hacer un pedido escaneá el QR del taller. Si no lo tenés, pedíselo a quien administra el taller.</p>
        </div>
      </main>
    );
  return <PedirApp cajas={await catalogoParaPedir()} claveQR={equipo ? null : k} />;
}
