// =============================================================
// Regla de "armar una caja": qué se descuenta del stock.
//
// La que manda es la RPC `armar_caja` (supabase/migrations/0003_rpc.sql), que hace el
// descuento en una transacción. Esta función replica la MISMA regla para mostrar la
// vista previa en la confirmación. Si cambiás la regla, cambiala en los dos lugares.
//
//   Simple   → stock_terminado −= cant_por_caja
//   Medidas  → cada medida: stock −= cant_por_juego × cant_por_caja
//   Complejo → primero unidades_armadas; si no alcanzan, el resto se arma con partes
//              sueltas: cada parte stock −= cant_por_instrumental × resto
// =============================================================

import { etiquetaParte, type InstrumentalCalc } from "./calculos";

export interface Descuento {
  instrumentalId: string;
  parteId: string | null;
  campo: "stock_terminado" | "unidades_armadas" | "stock_parte";
  etiqueta: string;
  cantidad: number;
}

export interface PlanArmado {
  ok: boolean;
  descuentos: Descuento[];
  faltantes: string[];
}

export function planArmadoCaja(instrumentales: InstrumentalCalc[]): PlanArmado {
  const descuentos: Descuento[] = [];
  const faltantes: string[] = [];

  if (instrumentales.length === 0) {
    return { ok: false, descuentos, faltantes: ["La caja no tiene instrumentales cargados"] };
  }

  for (const i of instrumentales) {
    const nombre = `${i.codigo} ${i.nombre}`;
    const cpc = i.cant_por_caja;

    if (i.tipo === "simple") {
      if (i.stock_terminado < cpc) faltantes.push(`${nombre}: hay ${i.stock_terminado} de ${cpc}`);
      descuentos.push({ instrumentalId: i.id, parteId: null, campo: "stock_terminado", etiqueta: nombre, cantidad: cpc });
      continue;
    }

    let resto = cpc;
    if (i.tipo === "complejo") {
      const usaArmadas = Math.min(i.unidades_armadas, cpc);
      resto = cpc - usaArmadas;
      if (usaArmadas > 0) {
        descuentos.push({
          instrumentalId: i.id,
          parteId: null,
          campo: "unidades_armadas",
          etiqueta: `${nombre} · unidades armadas`,
          cantidad: usaArmadas,
        });
      }
    }
    if (resto === 0) continue;

    if (i.partes.length === 0) {
      faltantes.push(`${nombre}: sin ${i.tipo === "medidas" ? "medidas" : "partes"} cargadas`);
      continue;
    }
    for (const p of i.partes) {
      const necesita = p.cant_por_unidad * resto;
      if (p.stock < necesita) faltantes.push(`${nombre} · ${p.codigo_o_medida}: hay ${p.stock} de ${necesita}`);
      descuentos.push({
        instrumentalId: i.id,
        parteId: p.id,
        campo: "stock_parte",
        etiqueta: `${nombre} · ${etiquetaParte(p)}`,
        cantidad: necesita,
      });
    }
  }

  return { ok: faltantes.length === 0, descuentos, faltantes };
}
