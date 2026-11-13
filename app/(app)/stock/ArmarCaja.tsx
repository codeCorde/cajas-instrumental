"use client";
import { useRef, useState, useTransition } from "react";
import { armarCaja, desarmarCaja } from "../acciones-stock";
import { useAviso } from "@/components/Aviso";

/** Botones Armar / Desarmar con ventana de confirmación que muestra exactamente qué se descuenta o devuelve. */
export default function ArmarCaja({
  cajaId,
  nombre,
  armadas,
  ok,
  faltantes,
  descuentos,
  devoluciones,
}: {
  cajaId: string;
  nombre: string;
  armadas: number;
  ok: boolean;
  faltantes: string[];
  descuentos: { etiqueta: string; cantidad: number; armados: boolean }[];
  devoluciones: { etiqueta: string; cantidad: number }[];
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [modo, setModo] = useState<"armar" | "desarmar">("armar");
  const [faltan, setFaltan] = useState<string[] | null>(null);
  const [pendiente, iniciar] = useTransition();
  const avisar = useAviso();

  const abrir = (m: "armar" | "desarmar") => {
    setModo(m);
    setFaltan(null);
    dialogo.current?.showModal();
  };

  function confirmar() {
    iniciar(async () => {
      const r = modo === "armar" ? await armarCaja(cajaId) : await desarmarCaja(cajaId);
      if (r.ok) {
        dialogo.current?.close();
        avisar({ tipo: "ok", texto: modo === "armar" ? `Caja armada ✓ Hay ${r.valor} armadas` : `Caja desarmada. Quedan ${r.valor} armadas` });
      } else {
        setFaltan("faltantes" in r && r.faltantes ? r.faltantes : [r.error]);
      }
    });
  }

  const lista = modo === "armar" ? (faltan ?? (ok ? null : faltantes)) : faltan;

  return (
    <>
      <div className="flex gap-2">
        <button type="button" className="btn btn-primario flex-1" onClick={() => abrir("armar")}>
          ⚒ Armar caja
        </button>
        <button type="button" className="btn" onClick={() => abrir("desarmar")} disabled={armadas < 1}>
          Desarmar
        </button>
      </div>
      <dialog ref={dialogo} className="card m-auto w-[min(36rem,calc(100vw-2rem))] p-0 backdrop:bg-black/50 text-texto" aria-labelledby={`t-${cajaId}`}>
        <div className="p-5 space-y-4">
          <h3 id={`t-${cajaId}`} className="titulo text-2xl">
            {modo === "armar" ? "Armar" : "Desarmar"} 1 «{nombre}»
          </h3>
          {lista && lista.length > 0 ? (
            <div className="space-y-2">
              <p className="text-falta font-semibold">✕ No se puede {modo}. {modo === "armar" ? "Falta:" : ""}</p>
              <ul className="list-disc pl-5 text-sm space-y-0.5 max-h-72 overflow-y-auto">
                {lista.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm">
                {modo === "armar"
                  ? "Se descuenta esto del stock y se suma 1 a las cajas armadas (todo junto, en una sola operación):"
                  : "Se resta 1 a las cajas armadas y vuelve al stock:"}
              </p>
              <ul className="text-sm divide-y divide-borde max-h-72 overflow-y-auto border-y border-borde">
                {(modo === "armar" ? descuentos : devoluciones).map((d, n) => (
                  <li key={n} className="flex justify-between gap-3 py-1">
                    <span>{d.etiqueta}</span>
                    <span className={`font-mono font-semibold ${modo === "armar" ? "text-falta" : "text-disponible"}`}>
                      {modo === "armar" ? "−" : "+"}
                      {d.cantidad}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => dialogo.current?.close()}>
              Cancelar
            </button>
            {!(lista && lista.length > 0) && (
              <button type="button" className="btn btn-primario" onClick={confirmar} disabled={pendiente}>
                {pendiente ? "Guardando…" : modo === "armar" ? "Confirmar armado" : "Confirmar desarmado"}
              </button>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
