"use client";
import { useEffect, useRef, useState } from "react";
import { ajustarStock, type ObjetivoStock } from "@/app/(app)/acciones-stock";
import Stepper from "./Stepper";
import { useAviso } from "./Aviso";

/**
 * + / − con guardado al instante y actualización optimista: si el servidor falla, vuelve al valor anterior y avisa.
 * El stock nunca baja de 0 (lo valida también la base).
 */
export default function ControlStock({
  objetivo,
  id,
  valor,
  etiqueta,
  cajaId,
  grande,
}: {
  objetivo: ObjetivoStock;
  id: string;
  valor: number;
  etiqueta: string;
  cajaId?: string | null;
  grande?: boolean;
}) {
  const [actual, setActual] = useState(valor);
  const pendientes = useRef(0);
  const avisar = useAviso();

  // Si el servidor trae un valor nuevo (otra persona cargó), se actualiza cuando no hay cambios en vuelo.
  useEffect(() => {
    if (pendientes.current === 0) setActual(valor);
  }, [valor]);

  async function cambiar(delta: number) {
    const antes = actual;
    const optimista = Math.max(0, antes + delta);
    if (optimista === antes) return;
    setActual(optimista);
    pendientes.current++;
    const r = await ajustarStock(objetivo, id, delta, { cajaId });
    pendientes.current--;
    if (r.ok) {
      if (pendientes.current === 0) setActual(r.valor);
    } else {
      setActual((v) => v - (optimista - antes));
      avisar({ tipo: "error", texto: `No se guardó (${etiqueta}): ${r.error}` });
    }
  }

  return <Stepper etiqueta={etiqueta} valor={actual} onCambio={cambiar} grande={grande} />;
}
