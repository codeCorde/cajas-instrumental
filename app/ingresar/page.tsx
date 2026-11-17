import { leerApariencia } from "@/lib/datos";
import FormIngreso from "./FormIngreso";

export const dynamic = "force-dynamic";

export default async function IngresarPage({ searchParams }: { searchParams: Promise<{ volver?: string; sin_acceso?: string }> }) {
  const { volver, sin_acceso } = await searchParams;
  const ap = await leerApariencia().catch(() => null);
  return (
    <main className="min-h-dvh grid place-items-center p-4">
      <div className="w-full max-w-sm">
        <p className="font-mono text-xs uppercase tracking-widest text-tenue mb-1">Control de producción</p>
        <h1 className="titulo text-4xl mb-6">{ap?.empresa ?? "Cajas de Instrumental"}</h1>
        {sin_acceso && (
          <p role="alert" className="card border-falta bg-falta-bg text-falta p-3 mb-4 text-sm font-semibold">
            ✕ Tu acceso al taller no está habilitado. Pedile una invitación a quien lo administra.
          </p>
        )}
        <FormIngreso volver={volver ?? "/"} />
      </div>
    </main>
  );
}
