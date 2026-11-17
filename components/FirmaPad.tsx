"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Firma con el dedo o el mouse. Devuelve la firma como PNG (data URL) por `onCambio`, o null si está vacía.
 * Si se pasa `name`, la firma viaja también en un <input type="hidden"> del formulario.
 */
export default function FirmaPad({ onCambio, name, etiqueta = "Firma" }: { onCambio?: (png: string | null) => void; name?: string; etiqueta?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const [png, setPng] = useState<string | null>(null);

  useEffect(() => {
    const c = ref.current!;
    const ajustar = () => {
      const r = c.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      const ctx = c.getContext("2d")!;
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111";
    };
    ajustar();
    // Si cambia el ancho (girar el celular) se borra: es más claro que una firma deformada.
    const ro = new ResizeObserver(() => {
      ajustar();
      setPng(null);
      onCambio?.(null);
    });
    ro.observe(c);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const punto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = ref.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  function empezar(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    ref.current!.setPointerCapture(e.pointerId);
    dibujando.current = true;
    const ctx = ref.current!.getContext("2d")!;
    const [x, y] = punto(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
  }
  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    const ctx = ref.current!.getContext("2d")!;
    const [x, y] = punto(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  function terminar() {
    if (!dibujando.current) return;
    dibujando.current = false;
    const url = ref.current!.toDataURL("image/png");
    setPng(url);
    onCambio?.(url);
  }
  function borrar() {
    const c = ref.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setPng(null);
    onCambio?.(null);
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="etiqueta">{etiqueta}</span>
        <button type="button" className="text-sm underline text-tenue" onClick={borrar} disabled={!png}>
          Borrar firma
        </button>
      </div>
      <canvas
        ref={ref}
        className="block w-full h-44 rounded border-2 border-dashed border-borde bg-white touch-none cursor-crosshair"
        aria-label={`${etiqueta}: dibujá con el dedo o el mouse`}
        role="img"
        onPointerDown={empezar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerCancel={terminar}
        onPointerLeave={terminar}
      />
      <p className="text-xs text-tenue">{png ? "✓ Firma cargada" : "Firmá dentro del recuadro."}</p>
      {name && <input type="hidden" name={name} value={png ?? ""} />}
    </div>
  );
}
