"use client";
import { useEffect, useRef, useState } from "react";
import type { Mensaje } from "@/lib/tipos";
import { fechaHora } from "@/lib/formato";
import { borrarMensaje, enviarMensaje, mensajesDesde } from "../equipo/acciones";
import { useAviso } from "@/components/Aviso";

/** Chat del equipo. Como la base no tiene acceso público, se actualiza preguntando al servidor cada 4 segundos. */
export default function Chat({ yo, iniciales }: { yo: string; iniciales: Mensaje[] }) {
  const [mensajes, setMensajes] = useState(iniciales);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const ultimo = useRef(iniciales.at(-1)?.id ?? 0);
  const fin = useRef<HTMLDivElement>(null);
  const avisar = useAviso();

  async function traer() {
    try {
      const nuevos = await mensajesDesde(ultimo.current);
      if (nuevos.length) {
        ultimo.current = nuevos.at(-1)!.id;
        setMensajes((m) => [...m, ...nuevos.filter((n) => !m.some((x) => x.id === n.id))]);
      }
    } catch {}
  }

  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && traer(), 4000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => fin.current?.scrollIntoView({ block: "end" }), [mensajes.length]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    const r = await enviarMensaje(texto);
    setEnviando(false);
    if (r.ok) {
      setTexto("");
      traer();
    } else avisar({ tipo: "error", texto: r.error ?? "No se envió" });
  }

  return (
    <div className="card flex flex-col h-[calc(100dvh-12rem)] min-h-96">
      <div className="flex-1 overflow-y-auto p-4 space-y-3" aria-live="polite">
        {mensajes.length === 0 && <p className="text-sm text-tenue">Todavía no hay mensajes. Escribí el primero.</p>}
        {mensajes.map((m) => {
          const mio = m.autor === yo;
          return (
            <div key={m.id} className={`flex ${mio ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 ${mio ? "bg-acento text-acento-texto" : "bg-superficie-2"}`}>
                {!mio && <p className="text-xs font-semibold">{m.autor}</p>}
                <p className="text-sm whitespace-pre-wrap break-words">{m.texto}</p>
                <p className="text-[10px] opacity-70 mt-0.5 flex gap-2 justify-end">
                  {fechaHora(m.creado_en)}
                  {mio && (
                    <button
                      type="button"
                      className="underline"
                      onClick={async () => {
                        if (!window.confirm("¿Borrar el mensaje?")) return;
                        await borrarMensaje(m.id);
                        setMensajes((xs) => xs.filter((x) => x.id !== m.id));
                      }}
                    >
                      borrar
                    </button>
                  )}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={fin} />
      </div>
      <form onSubmit={enviar} className="border-t border-borde p-3 flex gap-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar(e);
            }
          }}
          rows={1}
          maxLength={2000}
          className="campo resize-none"
          placeholder={`Escribí como ${yo}…`}
          aria-label="Mensaje"
        />
        <button className="btn btn-primario" disabled={enviando || !texto.trim()}>
          Enviar
        </button>
      </form>
    </div>
  );
}
