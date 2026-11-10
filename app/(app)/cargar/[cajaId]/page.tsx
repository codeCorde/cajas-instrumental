import { notFound } from "next/navigation";
import { obtenerCaja } from "@/lib/datos";
import CargaRapida from "./CargaRapida";

export const dynamic = "force-dynamic";

/** Paso 2 de la carga por QR. Con ?i=<instrumental> (QR de un instrumental) lo abre directo. */
export default async function CargarCajaPage({
  params,
  searchParams,
}: {
  params: Promise<{ cajaId: string }>;
  searchParams: Promise<{ i?: string }>;
}) {
  const [{ cajaId }, { i }] = await Promise.all([params, searchParams]);
  const caja = await obtenerCaja(cajaId);
  if (!caja || !caja.activa) notFound();
  const abierto = caja.instrumentales.some((x) => x.id === i) ? i! : null;
  return <CargaRapida inicial={caja} abiertoInicial={abierto} />;
}
