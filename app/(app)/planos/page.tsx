import { listarIndicePlanos } from "@/lib/datos";
import IndicePlanos from "./IndicePlanos";

export const dynamic = "force-dynamic";
export const metadata = { title: "Planos" };

export default async function PlanosPage() {
  const cajas = await listarIndicePlanos();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="titulo text-4xl">Planos</h1>
        <p className="text-sm text-tenue">Instrumental de cada caja con sus planos. Tocá un instrumental para verlos.</p>
      </div>
      <IndicePlanos cajas={cajas} />
    </div>
  );
}
