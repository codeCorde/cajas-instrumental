"use client";
// Controles + / − de UN instrumental según su tipo. Se usa en el detalle de caja y en /cargar.
import Stepper from "./Stepper";
import type { Instrumental, CampoStock } from "@/lib/tipos";

export type FnAjustar = (instId: string, campo: CampoStock, delta: number, parteId?: string | null) => void;

export default function CargaInstrumental({ i, ajustar, grande }: { i: Instrumental; ajustar: FnAjustar; grande?: boolean }) {
  if (i.tipo === "simple") {
    return (
      <Fila titulo="Stock terminado" detalle={`Lleva ${i.cant_por_caja} por caja`}>
        <Stepper
          grande={grande}
          etiqueta={`Stock terminado de ${i.nombre}`}
          valor={i.stock_terminado}
          onCambio={(d) => ajustar(i.id, "stock_terminado", d)}
        />
      </Fila>
    );
  }

  const esMedidas = i.tipo === "medidas";
  const resto = esMedidas ? i.cant_por_caja : Math.max(0, i.cant_por_caja - i.unidades_armadas);
  return (
    <div>
      {i.tipo === "complejo" && (
        <Fila titulo="Unidades armadas" detalle={`Lleva ${i.cant_por_caja} por caja`}>
          <Stepper
            grande={grande}
            etiqueta={`Unidades armadas de ${i.nombre}`}
            valor={i.unidades_armadas}
            onCambio={(d) => ajustar(i.id, "unidades_armadas", d)}
          />
        </Fila>
      )}
      <p className="etiqueta mt-3">{esMedidas ? `Medidas · ${i.cant_por_caja} juego(s) por caja` : "Partes sueltas"}</p>
      {i.partes.length === 0 ? (
        <p className="text-sm text-tenue py-2">
          {esMedidas ? "No hay medidas cargadas." : "No hay partes cargadas."} El admin las agrega desde Administración.
        </p>
      ) : (
        <ul className="divide-y divide-borde">
          {i.partes.map((p) => {
            const corto = p.stock < p.cant_por_unidad * resto;
            return (
              <li key={p.id}>
                <Fila
                  titulo={
                    <span className="font-mono">
                      {p.codigo_o_medida}
                      {p.nombre ? <span className="font-sans"> · {p.nombre}</span> : null}
                    </span>
                  }
                  detalle={
                    <span className={corto ? "text-falta" : undefined}>
                      {corto ? "✕ No alcanza · " : ""}x{p.cant_por_unidad} {esMedidas ? "por juego" : "por instrumental"}
                    </span>
                  }
                >
                  <Stepper
                    grande={grande}
                    etiqueta={`${esMedidas ? "Medida" : "Parte"} ${p.codigo_o_medida} de ${i.nombre}`}
                    valor={p.stock}
                    onCambio={(d) => ajustar(i.id, "stock_parte", d, p.id)}
                  />
                </Fila>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Fila({ titulo, detalle, children }: { titulo: React.ReactNode; detalle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="font-semibold">{titulo}</div>
        {detalle && <div className="text-xs text-tenue">{detalle}</div>}
      </div>
      {children}
    </div>
  );
}
