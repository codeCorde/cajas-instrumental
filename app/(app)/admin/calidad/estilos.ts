import type { Resultado } from "@/lib/tipos";

export const RESULTADO_CLASE: Record<Resultado, string> = {
  conforme: "bg-disponible-bg text-disponible",
  observaciones: "bg-proceso-bg text-proceso",
  no_conforme: "bg-falta-bg text-falta",
};
