import { listarCajasCompletas } from "@/lib/datos";
import ListaFabricar from "./ListaFabricar";

export const dynamic = "force-dynamic";

export default async function FabricarPage({ searchParams }: { searchParams: Promise<{ caja?: string }> }) {
  const { caja } = await searchParams;
  const cajas = await listarCajasCompletas();
  return <ListaFabricar cajas={cajas} cajaInicial={caja ?? "todas"} />;
}
