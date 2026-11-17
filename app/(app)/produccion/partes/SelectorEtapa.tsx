"use client";
import { useState, useTransition } from "react";
import { useAviso } from "@/components/Aviso";
import { guardarEtapa } from "../acciones";

/** En qué parte del proceso de producción está la pieza. Se guarda al elegir. */
export default function SelectorEtapa({ tabla, id, etapa, etapas, etiqueta }: { tabla: "instrumentales" | "componentes"; id: string; etapa: string | null; etapas: string[]; etiqueta: string }) {
  const [valor, setValor] = useState(etapa ?? "");
  const [pendiente, iniciar] = useTransition();
  const avisar = useAviso();
  const opciones = valor && !etapas.includes(valor) ? [valor, ...etapas] : etapas;
  const indice = etapas.indexOf(valor);
  const terminada = indice === etapas.length - 1 && indice >= 0;
  return (
    <select
      className={`campo min-w-44 ${terminada ? "text-disponible font-semibold" : valor ? "text-proceso font-semibold" : ""}`}
      value={valor}
      disabled={pendiente}
      aria-label={`Etapa de ${etiqueta}`}
      onChange={(e) => {
        const antes = valor;
        const nuevo = e.target.value;
        setValor(nuevo);
        iniciar(async () => {
          const r = await guardarEtapa(tabla, id, nuevo);
          if (!r.ok) {
            setValor(antes);
            avisar({ tipo: "error", texto: r.error });
          } else avisar({ tipo: "ok", texto: `${etiqueta}: ${nuevo || "sin etapa"}` });
        });
      }}
    >
      <option value="">— Sin etapa —</option>
      {opciones.map((o) => (
        <option key={o} value={o}>
          {etapas.includes(o) ? `${etapas.indexOf(o) + 1}. ${o}` : o}
        </option>
      ))}
    </select>
  );
}
