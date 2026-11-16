import type { Metadata } from "next";
import { catalogoParaPedir } from "@/lib/pedidos";
import PedirApp from "./PedirApp";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "InstrumentARG · Hacer un pedido", robots: { index: false, follow: false } };

/** Página pública del QR de pedidos: presentación, elegir caja, cantidades de cada pieza, nombre y firma. */
export default async function PedirPage() {
  const cajas = await catalogoParaPedir();
  return <PedirApp cajas={cajas} />;
}
