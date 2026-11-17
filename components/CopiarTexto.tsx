"use client";
import { useState } from "react";

/** Botón que copia un texto (un link) al portapapeles. */
export default function CopiarTexto({ texto, etiqueta = "Copiar" }: { texto: string; etiqueta?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="btn text-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setOk(true);
          setTimeout(() => setOk(false), 2000);
        } catch {
          window.prompt("Copiá el link:", texto);
        }
      }}
    >
      {ok ? "✓ Copiado" : etiqueta}
    </button>
  );
}
