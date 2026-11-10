"use client";
// Chat del equipo: muestra los mensajes, escribe y borra con el cliente del navegador (RLS valida todo)
// y escucha los cambios de la tabla mensajes con Supabase Realtime.
import { useEffect, useRef, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import type { Mensaje } from "@/lib/tipos";

const ZONA = "America/Argentina/Buenos_Aires";
const dia = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { timeZone: ZONA, weekday: "long", day: "numeric", month: "long" });
const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-AR", { timeZone: ZONA, hour: "2-digit", minute: "2-digit" });

function agregar(lista: Mensaje[], m: Mensaje): Mensaje[] {
  if (lista.some((x) => x.id === m.id)) return lista;
  return [...lista, m].sort((a, b) => a.creado_en.localeCompare(b.creado_en) || a.id - b.id);
}

export default function ChatEquipo({
  inicial,
  yo,
  esAdmin,
  recortado,
}: {
  inicial: Mensaje[];
  yo: string;
  esAdmin: boolean;
  recortado: boolean;
}) {
  const [mensajes, setMensajes] = useState(inicial);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conectado, setConectado] = useState(false);
  const fin = useRef<HTMLLIElement>(null);

  // Tiempo real: altas y bajas que hagan los demás.
  useEffect(() => {
    const supabase = crearClienteNavegador();
    const canal = supabase
      .channel("chat-equipo")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes" }, (p) =>
        setMensajes((l) => agregar(l, p.new as Mensaje)),
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "mensajes" }, (p) =>
        setMensajes((l) => l.filter((x) => x.id !== (p.old as Partial<Mensaje>).id)),
      )
      .subscribe((estado) => setConectado(estado === "SUBSCRIBED"));
    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  useEffect(() => {
    fin.current?.scrollIntoView({ block: "end" });
  }, [mensajes.length]);

  async function enviar(e?: React.FormEvent) {
    e?.preventDefault();
    const limpio = texto.trim();
    if (!limpio || enviando) return;
    setEnviando(true);
    setError(null);
    const { data, error } = await crearClienteNavegador()
      .from("mensajes")
      .insert({ texto: limpio })
      .select("id, creado_en, autor_id, autor_nombre, texto")
      .single();
    setEnviando(false);
    if (error) {
      setError("No se pudo enviar: " + error.message);
      return;
    }
    setTexto("");
    setMensajes((l) => agregar(l, data as Mensaje));
  }

  async function borrar(m: Mensaje) {
    if (!confirm("¿Borrar este mensaje? No se puede deshacer.")) return;
    const { error } = await crearClienteNavegador().from("mensajes").delete().eq("id", m.id);
    if (error) {
      setError("No se pudo borrar: " + error.message);
      return;
    }
    setMensajes((l) => l.filter((x) => x.id !== m.id));
  }

  return (
    <div className="card flex flex-col h-[calc(100dvh-15rem)] min-h-96">
      <div className="flex items-center justify-between gap-2 border-b border-borde px-4 py-2 text-xs text-tenue">
        <span>{mensajes.length} mensajes{recortado ? " (los últimos)" : ""}</span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${conectado ? "bg-disponible" : "bg-proceso"}`} />
          {conectado ? "✓ En vivo" : "◐ Conectando…"}
        </span>
      </div>

      <ol className="flex-1 overflow-y-auto px-3 py-3 space-y-2" aria-live="polite">
        {mensajes.length === 0 && (
          <li className="py-10 text-center text-tenue">Todavía no hay mensajes. ¡Escribí el primero!</li>
        )}
        {mensajes.map((m, i) => {
          const mio = m.autor_id === yo;
          const nuevoDia = i === 0 || dia(mensajes[i - 1].creado_en) !== dia(m.creado_en);
          const mismoAutor = !nuevoDia && i > 0 && mensajes[i - 1].autor_id === m.autor_id && mensajes[i - 1].autor_nombre === m.autor_nombre;
          return (
            <li key={m.id}>
              {nuevoDia && (
                <p className="my-3 text-center font-mono text-xs uppercase tracking-widest text-tenue first-letter:uppercase">
                  {dia(m.creado_en)}
                </p>
              )}
              <div className={`group flex ${mio ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 ${
                    mio ? "bg-acento text-acento-texto" : "bg-superficie-2"
                  }`}
                >
                  {!mio && !mismoAutor && <p className="text-xs font-semibold mb-0.5">{m.autor_nombre ?? "—"}</p>}
                  <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                  <p className={`mt-0.5 flex items-center justify-end gap-2 text-[11px] ${mio ? "opacity-80" : "text-tenue"}`}>
                    {(mio || esAdmin) && (
                      <button
                        type="button"
                        onClick={() => borrar(m)}
                        className="underline opacity-70 hover:opacity-100"
                        aria-label="Borrar mensaje"
                      >
                        Borrar
                      </button>
                    )}
                    <span className="font-mono">{hora(m.creado_en)}</span>
                  </p>
                </div>
              </div>
            </li>
          );
        })}
        <li ref={fin} aria-hidden="true" />
      </ol>

      <form onSubmit={enviar} className="border-t border-borde p-3 space-y-2">
        {error && <p className="text-sm text-falta">✕ {error}</p>}
        <div className="flex gap-2 items-end">
          <label className="flex-1">
            <span className="sr-only">Mensaje</span>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              rows={2}
              maxLength={2000}
              placeholder="Escribí un mensaje… (Enter envía, Shift+Enter baja de línea)"
              className="campo resize-none"
            />
          </label>
          <button className="btn btn-primario h-12 px-5" disabled={enviando || !texto.trim()}>
            {enviando ? "…" : "Enviar"}
          </button>
        </div>
      </form>
    </div>
  );
}
