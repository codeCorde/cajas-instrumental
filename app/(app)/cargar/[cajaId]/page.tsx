import { notFound } from "next/navigation";
import { obtenerCaja } from "@/lib/datos";
import CargaRapida from "./CargaRapida";

export const dynamic = "force-dynamic";

export default async function CargarCajaPage({ params }: { params: Promise<{ cajaId: string }> }) {
  const { cajaId } = await params;
  const caja = await obtenerCaja(cajaId);
  if (!caja || !caja.activa) notFound();
  return <CargaRapida inicial={caja} />;
}
