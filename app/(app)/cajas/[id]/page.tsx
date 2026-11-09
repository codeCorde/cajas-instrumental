import { notFound } from "next/navigation";
import { obtenerPerfil } from "@/lib/auth";
import { listarCajasCompletas, obtenerCaja } from "@/lib/datos";
import { ESTADO_CAJA_INFO, resumenCaja } from "@/lib/calculos";
import DetalleCaja from "./DetalleCaja";

export const dynamic = "force-dynamic";

export default async function CajaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ i?: string }> }) {
  const [{ id }, { i }] = await Promise.all([params, searchParams]);
  const [perfil, caja, todas] = await Promise.all([obtenerPerfil(), obtenerCaja(id, true), listarCajasCompletas()]);
  if (!caja) notFound();

  const pestañas = todas.map((c) => ({
    id: c.id,
    numero: c.numero,
    nombre: c.nombre,
    estado: ESTADO_CAJA_INFO[resumenCaja(c.instrumentales).estado].estado,
  }));

  return <DetalleCaja inicial={caja} pestañas={pestañas} esAdmin={perfil.rol === "admin"} seleccionInicial={i ?? null} />;
}
