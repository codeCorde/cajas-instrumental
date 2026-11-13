// Muestra texto con formato básico escrito así:
//   # Título   ## Subtítulo   1. paso numerado   - viñeta   **negrita**
// Se arma con elementos de React (nunca HTML crudo), así no hay forma de inyectar código.
import { Fragment } from "react";

function enLinea(t: string, clave: string) {
  const partes = t.split(/(\*\*[^*]+\*\*)/g);
  return partes.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") && p.length > 4 ? <strong key={`${clave}-${i}`}>{p.slice(2, -2)}</strong> : <Fragment key={`${clave}-${i}`}>{p}</Fragment>,
  );
}

export default function TextoFormato({ texto, vacio = "Sin texto todavía." }: { texto: string | null; vacio?: string }) {
  if (!texto?.trim()) return <p className="text-sm text-tenue">{vacio}</p>;
  const lineas = texto.replace(/\r/g, "").split("\n");
  const bloques: React.ReactNode[] = [];
  let i = 0;
  while (i < lineas.length) {
    const l = lineas[i];
    const k = `b${i}`;
    if (/^\s*$/.test(l)) {
      i++;
      continue;
    }
    const h = l.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const tam = h[1].length === 1 ? "text-xl" : h[1].length === 2 ? "text-lg" : "text-base";
      bloques.push(
        <p key={k} role="heading" aria-level={h[1].length + 2} className={`titulo ${tam} mt-3 first:mt-0`}>
          {enLinea(h[2], k)}
        </p>,
      );
      i++;
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(l)) {
      const items: string[] = [];
      while (i < lineas.length && /^\s*\d+[.)]\s+/.test(lineas[i])) items.push(lineas[i++].replace(/^\s*\d+[.)]\s+/, ""));
      bloques.push(
        <ol key={k} className="list-decimal pl-6 space-y-1">
          {items.map((t, n) => (
            <li key={n}>{enLinea(t, `${k}-${n}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }
    if (/^\s*[-*•]\s+/.test(l)) {
      const items: string[] = [];
      while (i < lineas.length && /^\s*[-*•]\s+/.test(lineas[i])) items.push(lineas[i++].replace(/^\s*[-*•]\s+/, ""));
      bloques.push(
        <ul key={k} className="list-disc pl-6 space-y-1">
          {items.map((t, n) => (
            <li key={n}>{enLinea(t, `${k}-${n}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    const parrafo: string[] = [];
    while (i < lineas.length && !/^\s*$/.test(lineas[i]) && !/^(#{1,3}\s|\s*\d+[.)]\s|\s*[-*•]\s)/.test(lineas[i])) parrafo.push(lineas[i++]);
    bloques.push(
      <p key={k}>
        {parrafo.map((t, n) => (
          <Fragment key={n}>
            {n > 0 && <br />}
            {enLinea(t, `${k}-${n}`)}
          </Fragment>
        ))}
      </p>,
    );
  }
  return <div className="space-y-2 text-sm leading-relaxed">{bloques}</div>;
}
