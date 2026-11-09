import { Suspense } from "react";
import FormLogin from "./FormLogin";

export const metadata = { title: "Ingresar · Control de Cajas" };

export default function LoginPage() {
  return (
    <main className="min-h-dvh grid place-items-center p-4">
      <div className="w-full max-w-sm">
        <p className="font-mono text-xs uppercase tracking-widest text-tenue mb-1">Control de producción</p>
        <h1 className="titulo text-4xl mb-6">Cajas de instrumental</h1>
        <Suspense>
          <FormLogin />
        </Suspense>
      </div>
    </main>
  );
}
