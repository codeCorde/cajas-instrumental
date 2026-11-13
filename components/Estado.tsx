import { ESTADO_INFO, type Estado } from "@/lib/calculos";

export const ESTADO_CLASES: Record<Estado, { texto: string; fondo: string; solido: string }> = {
  disponible: { texto: "text-disponible", fondo: "bg-disponible-bg", solido: "bg-disponible" },
  en_proceso: { texto: "text-proceso", fondo: "bg-proceso-bg", solido: "bg-proceso" },
  falta: { texto: "text-falta", fondo: "bg-falta-bg", solido: "bg-falta" },
  sin_definir: { texto: "text-sin", fondo: "bg-sin-bg", solido: "bg-sin" },
};

/** Chip de estado: color + ícono + texto (no depende solo del color). */
export function EstadoChip({ estado, label, chico }: { estado: Estado; label?: string; chico?: boolean }) {
  const c = ESTADO_CLASES[estado];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap ${c.texto} ${c.fondo} ${chico ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"}`}>
      <span aria-hidden="true" className="font-mono">
        {ESTADO_INFO[estado].icono}
      </span>
      {label ?? ESTADO_INFO[estado].label}
    </span>
  );
}

/** Medidor: un segmento por instrumental, coloreado por estado. */
export function MedidorCaja({ estados }: { estados: { id: string; nombre: string; estado: Estado }[] }) {
  if (estados.length === 0) return <div className="h-3 rounded bg-sin-bg" aria-hidden="true" />;
  return (
    <div className="flex gap-0.5 h-3" role="img" aria-label={`Estado de ${estados.length} instrumentales`}>
      {estados.map((e) => (
        <div
          key={e.id}
          title={`${e.nombre} · ${ESTADO_INFO[e.estado].label}`}
          className={`flex-1 first:rounded-l last:rounded-r ${ESTADO_CLASES[e.estado].solido} ${e.estado === "sin_definir" ? "opacity-40" : ""}`}
        />
      ))}
    </div>
  );
}

export function Etiqueta({ children, tono = "tenue" }: { children: React.ReactNode; tono?: "tenue" | "proceso" | "acento" | "falta" }) {
  const clases = {
    tenue: "border-tenue text-tenue",
    proceso: "border-proceso text-proceso",
    acento: "border-acento text-acento",
    falta: "border-falta text-falta",
  }[tono];
  return <span className={`inline-block rounded border border-dashed px-1.5 py-px font-mono text-[10px] uppercase tracking-wider whitespace-nowrap ${clases}`}>{children}</span>;
}

/** Ícono de instrumental compartido entre varias cajas. */
export function Compartido({ cajas }: { cajas: string[] }) {
  if (cajas.length < 2) return null;
  return (
    <span title={`Compartido: ${cajas.join(", ")}`} aria-label={`Compartido entre ${cajas.join(", ")}`} className="inline-flex items-center gap-0.5 rounded bg-acento/10 px-1 font-mono text-[10px] font-semibold text-acento">
      <span aria-hidden="true">⇄</span>
      {cajas.join("·")}
    </span>
  );
}

export function Cifra({ valor, label, clase = "" }: { valor: number | string; label: string; clase?: string }) {
  return (
    <div>
      <p className={`font-mono text-3xl font-semibold tabular-nums leading-none ${clase}`}>{valor}</p>
      <p className="text-xs text-tenue uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
