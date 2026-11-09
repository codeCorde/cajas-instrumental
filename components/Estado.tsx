import { ESTADO_INFO, type Estado } from "@/lib/calculos";

export const ESTADO_CLASES: Record<Estado, { texto: string; fondo: string; solido: string }> = {
  disponible: { texto: "text-disponible", fondo: "bg-disponible-bg", solido: "bg-disponible" },
  en_proceso: { texto: "text-proceso", fondo: "bg-proceso-bg", solido: "bg-proceso" },
  falta: { texto: "text-falta", fondo: "bg-falta-bg", solido: "bg-falta" },
  sin_partes: { texto: "text-sin", fondo: "bg-sin-bg", solido: "bg-sin" },
};

/** Chip de estado: color + ícono + texto (no depende solo del color). */
export function EstadoChip({ estado, label, chico }: { estado: Estado; label?: string; chico?: boolean }) {
  const c = ESTADO_CLASES[estado];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${c.texto} ${c.fondo} ${
        chico ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      }`}
    >
      <span aria-hidden="true" className="font-mono">{ESTADO_INFO[estado].icono}</span>
      {label ?? ESTADO_INFO[estado].label}
    </span>
  );
}

export function EstadoDot({ estado }: { estado: Estado }) {
  return (
    <span
      aria-label={ESTADO_INFO[estado].label}
      title={ESTADO_INFO[estado].label}
      className={`inline-grid place-items-center w-4 h-4 rounded-full text-[9px] font-bold text-superficie ${ESTADO_CLASES[estado].solido}`}
    >
      <span aria-hidden="true">{ESTADO_INFO[estado].icono}</span>
    </span>
  );
}

/** Medidor: un segmento por instrumental, coloreado por estado. */
export function MedidorCaja({ estados }: { estados: { codigo: string; estado: Estado }[] }) {
  if (estados.length === 0) return <div className="h-3 rounded bg-sin-bg" aria-hidden="true" />;
  return (
    <div className="flex gap-0.5 h-3" role="img" aria-label={`Estado de ${estados.length} instrumentales`}>
      {estados.map((e) => (
        <div
          key={e.codigo}
          title={`${e.codigo} · ${ESTADO_INFO[e.estado].label}`}
          className={`flex-1 first:rounded-l last:rounded-r ${ESTADO_CLASES[e.estado].solido} ${
            e.estado === "sin_partes" ? "opacity-40" : ""
          }`}
        />
      ))}
    </div>
  );
}

export function EtiquetaEjemplo() {
  return (
    <span className="inline-block rounded border border-dashed border-tenue px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-tenue">
      Ejemplo
    </span>
  );
}
