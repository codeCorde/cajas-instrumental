import { fechaHora } from "@/lib/formato";
import { CAMPO_LABEL, MOTIVO_LABEL, type Movimiento } from "@/lib/tipos";

export default function TablaMovimientos({ movimientos, sinInstrumental }: { movimientos: Movimiento[]; sinInstrumental?: boolean }) {
  if (movimientos.length === 0) return <p className="text-sm text-tenue">Todavía no hay movimientos.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="tabla">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Quién</th>
            {!sinInstrumental && <th>Qué</th>}
            <th>Detalle</th>
            <th className="text-right">Cant.</th>
            <th className="text-right">Queda</th>
            <th>Motivo</th>
          </tr>
        </thead>
        <tbody>
          {movimientos.map((m) => (
            <tr key={m.id}>
              <td className="font-mono text-xs whitespace-nowrap">{fechaHora(m.creado_en)}</td>
              <td>{m.autor}</td>
              {!sinInstrumental && <td className="font-semibold">{m.instrumental_nombre ?? m.caja_nombre ?? "—"}</td>}
              <td className="text-xs text-tenue">
                {m.componente_nombre ?? CAMPO_LABEL[m.campo]}
                {m.caja_nombre && m.instrumental_nombre ? ` · ${m.caja_nombre}` : ""}
                {m.nota ? ` · ${m.nota}` : ""}
              </td>
              <td className={`text-right font-mono font-semibold ${m.delta > 0 ? "text-disponible" : "text-falta"}`}>
                {m.delta > 0 ? `+${m.delta}` : `−${Math.abs(m.delta)}`}
              </td>
              <td className="text-right font-mono">{m.stock_resultante}</td>
              <td className="text-xs">{MOTIVO_LABEL[m.motivo]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
