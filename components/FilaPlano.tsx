import Link from "next/link";
import { etiquetaFormato, seVeEnNavegador, tamanoLegible, type Plano } from "@/lib/planos";

export function ChipFormato({ formato }: { formato: string }) {
  const visible = seVeEnNavegador(formato);
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase ${
        visible ? "bg-acento text-acento-texto" : "bg-superficie-2 text-tenue border border-borde"
      }`}
    >
      {etiquetaFormato(formato)}
    </span>
  );
}

/**
 * Una fila de plano con botones Ver / Descargar.
 * `hrefVer`: a dónde lleva «Ver» (por defecto abre el archivo en otra pestaña).
 */
export default function FilaPlano({ p, hrefVer, activo }: { p: Plano; hrefVer?: string; activo?: boolean }) {
  const visible = seVeEnNavegador(p.formato);
  return (
    <li
      className={`flex flex-wrap items-center gap-2 rounded border p-2 ${
        activo ? "border-acento bg-superficie-2" : "border-borde"
      }`}
    >
      <ChipFormato formato={p.formato} />
      <span className="min-w-0 flex-1 font-medium leading-tight break-words">{p.nombre}</span>
      <span className="font-mono text-xs text-tenue">{tamanoLegible(p.tamano)}</span>
      <span className="flex gap-1.5">
        {visible &&
          (hrefVer ? (
            <Link href={hrefVer} scroll={false} className="btn px-3 text-sm" aria-current={activo ? "true" : undefined}>
              Ver
            </Link>
          ) : (
            <a href={`/planos/archivo/${p.id}`} target="_blank" rel="noopener" className="btn px-3 text-sm">
              Ver ↗
            </a>
          ))}
        <a href={`/planos/archivo/${p.id}?descargar`} className="btn px-3 text-sm" aria-label={`Descargar ${p.nombre}`}>
          ↓ Bajar
        </a>
      </span>
    </li>
  );
}
