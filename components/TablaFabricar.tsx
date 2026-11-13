"use client";
import Link from "next/link";
import { aCSV, descargar } from "@/lib/csv";
import type { FilaFabricarVista } from "@/lib/fabricar";

export default function TablaFabricar({ filas, archivoCsv }: { filas: FilaFabricarVista[]; archivoCsv: string }) {
  const exportar = () =>
    descargar(
      archivoCsv,
      aCSV(
        ["Código", "Instrumental", "Medida / pieza", "Cantidad a fabricar", "Origen / proveedor", "Nota"],
        filas.map((f) => [f.codigo, f.instrumental, f.componente ?? "", f.cantidad, f.origen, f.nota ?? ""]),
      ),
    );
  return (
    <div className="space-y-3">
      <div className="no-imprimir flex justify-end">
        <button type="button" className="btn" onClick={exportar}>
          ⇩ Exportar CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr>
              <th>Instrumental</th>
              <th>Medida / pieza</th>
              <th className="text-right">A fabricar</th>
              <th>Origen / proveedor</th>
              <th className="no-imprimir">Archivos</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}>
                <td>
                  <span className="font-semibold">{f.instrumental}</span>
                  <span className="block font-mono text-xs text-tenue">{f.codigo}</span>
                </td>
                <td className="font-mono">{f.componente ?? (f.nota ? <span className="text-proceso text-xs font-sans">{f.nota}</span> : "—")}</td>
                <td className="text-right font-mono text-lg font-semibold">{f.cantidad}</td>
                <td className="text-sm">{f.origen}</td>
                <td className="no-imprimir">
                  <Link href={`/instrumental/${f.instId}`} className="text-sm underline">
                    Planos y procesos
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
