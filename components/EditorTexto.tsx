"use client";
import { useEffect, useRef, useState } from "react";
import { guardarTexto } from "@/app/(app)/instrumental/acciones";
import TextoFormato from "./TextoFormato";

type Estado = "guardado" | "escribiendo" | "guardando" | "error";

/**
 * Editor con formato básico (títulos, listas numeradas, viñetas, negrita) y guardado automático.
 * Guarda 1 segundo después de que dejás de escribir y muestra "Guardado".
 */
export default function EditorTexto({
  tabla,
  id,
  campo,
  valor,
  titulo,
  ayuda,
}: {
  tabla: "instrumentales" | "componentes";
  id: string;
  campo: "descripcion" | "proceso";
  valor: string | null;
  titulo: string;
  ayuda?: string;
}) {
  const [texto, setTexto] = useState(valor ?? "");
  const [modo, setModo] = useState<"ver" | "editar">(valor?.trim() ? "ver" : "editar");
  const [estado, setEstado] = useState<Estado>("guardado");
  const ref = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const ultimo = useRef(valor ?? "");

  useEffect(() => () => clearTimeout(timer.current), []);

  function programar(nuevo: string) {
    setTexto(nuevo);
    setEstado("escribiendo");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => guardar(nuevo), 1000);
  }

  async function guardar(v: string) {
    if (v === ultimo.current) return setEstado("guardado");
    setEstado("guardando");
    const r = await guardarTexto(tabla, id, campo, v);
    if (r.ok) {
      ultimo.current = v;
      setEstado("guardado");
    } else setEstado("error");
  }

  /** Aplica un formato a las líneas seleccionadas (o envuelve en negrita). */
  function formato(tipo: "titulo" | "numerada" | "vinetas" | "negrita") {
    const ta = ref.current;
    if (!ta) return;
    const { selectionStart: a, selectionEnd: b } = ta;
    let nuevo: string;
    let cursor: number;
    if (tipo === "negrita") {
      const sel = texto.slice(a, b) || "texto";
      nuevo = `${texto.slice(0, a)}**${sel}**${texto.slice(b)}`;
      cursor = a + sel.length + 4;
    } else {
      const ini = texto.lastIndexOf("\n", a - 1) + 1;
      const finIdx = texto.indexOf("\n", b);
      const fin = finIdx === -1 ? texto.length : finIdx;
      const lineas = texto.slice(ini, fin).split("\n");
      const limpias = lineas.map((l) => l.replace(/^(#{1,3}\s+|\s*\d+[.)]\s+|\s*[-*•]\s+)/, ""));
      const conFormato = limpias.map((l, n) => (tipo === "titulo" ? `## ${l}` : tipo === "numerada" ? `${n + 1}. ${l}` : `- ${l}`));
      const bloque = conFormato.join("\n");
      nuevo = texto.slice(0, ini) + bloque + texto.slice(fin);
      cursor = ini + bloque.length;
    }
    programar(nuevo);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(cursor, cursor);
    });
  }

  const etiquetaEstado = { guardado: "✓ Guardado", escribiendo: "Escribiendo…", guardando: "Guardando…", error: "✕ No se guardó: revisá la conexión" }[estado];

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="titulo text-lg">{titulo}</h3>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${estado === "error" ? "text-falta" : estado === "guardado" ? "text-disponible" : "text-tenue"}`} aria-live="polite">
            {etiquetaEstado}
          </span>
          <button type="button" className="btn min-h-9 px-3 text-sm" onClick={() => setModo(modo === "ver" ? "editar" : "ver")}>
            {modo === "ver" ? "✎ Editar" : "Ver como queda"}
          </button>
        </div>
      </div>
      {modo === "ver" ? (
        <div className="rounded border border-borde p-3 bg-superficie">
          <TextoFormato texto={texto} vacio="Todavía no hay nada escrito. Tocá «Editar»." />
        </div>
      ) : (
        <div className="rounded border border-borde bg-superficie">
          <div className="flex flex-wrap gap-1 border-b border-borde p-1" role="toolbar" aria-label="Formato">
            <button type="button" className="btn min-h-9 px-3 text-sm" onClick={() => formato("titulo")}>
              Título
            </button>
            <button type="button" className="btn min-h-9 px-3 text-sm" onClick={() => formato("numerada")}>
              1. Lista numerada
            </button>
            <button type="button" className="btn min-h-9 px-3 text-sm" onClick={() => formato("vinetas")}>
              • Viñetas
            </button>
            <button type="button" className="btn min-h-9 px-3 text-sm font-bold" onClick={() => formato("negrita")} aria-label="Negrita">
              N
            </button>
          </div>
          <textarea
            ref={ref}
            value={texto}
            onChange={(e) => programar(e.target.value)}
            onBlur={() => {
              clearTimeout(timer.current);
              guardar(texto);
            }}
            rows={Math.min(18, Math.max(5, texto.split("\n").length + 1))}
            className="w-full p-3 bg-transparent font-mono text-sm outline-none resize-y"
            aria-label={titulo}
            placeholder={ayuda ?? "## Paso 1\n1. Cortar barra Ø20 a 120 mm\n2. Tornear según plano\n**Ojo:** controlar la cota de 12 mm"}
          />
        </div>
      )}
    </section>
  );
}
