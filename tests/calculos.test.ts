import { describe, expect, it } from "vitest";
import {
  cajasFaltantesParaPedidos,
  estadoEnCaja,
  filasComponentes,
  generarRango,
  planArmadoCaja,
  queFabricar,
  resumenCaja,
  stockCompleto,
  type InstCalc,
} from "@/lib/calculos";

let n = 0;
const comp = (clase: "medida" | "pieza", codigo: string, stock: number, cant = 1, nombre: string | null = null) => ({
  id: `c${++n}`,
  clase,
  codigo_o_medida: codigo,
  nombre,
  cant_por_unidad: cant,
  stock,
});
const simple = (stock: number, id = `s${++n}`): InstCalc => ({ id, nombre: "Cureta", tipo: "simple", stock_terminado: stock, unidades_armadas: 0, componentes: [] });
const medidas = (stocks: Record<string, number>, id = `m${++n}`): InstCalc => ({
  id,
  nombre: "Probador",
  tipo: "medidas",
  stock_terminado: 0,
  unidades_armadas: 0,
  componentes: Object.entries(stocks).map(([k, v]) => comp("medida", k, v)),
});
const complejo = (armadas: number, piezas: [string, number, number][], id = `x${++n}`): InstCalc => ({
  id,
  nombre: "Mango",
  tipo: "complejo",
  stock_terminado: 0,
  unidades_armadas: armadas,
  componentes: piezas.map(([c, s, k]) => comp("pieza", c, s, k)),
});

describe("stock completo", () => {
  it("simple = stock terminado", () => expect(stockCompleto(simple(4))).toBe(4));
  it("medidas = la medida que menos hay", () => expect(stockCompleto(medidas({ Ø44: 3, Ø46: 1, Ø48: 5 }))).toBe(1));
  it("medidas con cant por juego 2", () => {
    const m = medidas({ Ø44: 5 });
    m.componentes[0].cant_por_unidad = 2;
    expect(stockCompleto(m)).toBe(2);
  });
  it("complejo = armados + lo que sale de las piezas", () => expect(stockCompleto(complejo(2, [["1/2", 3, 1], ["2/2", 4, 2]]))).toBe(4));
  it("medidas sin medidas = 0", () => expect(stockCompleto(medidas({}))).toBe(0));
  it("ignora componentes de la otra clase", () => {
    const m = medidas({ Ø44: 2 });
    m.componentes.push(comp("pieza", "x", 0));
    expect(stockCompleto(m)).toBe(2);
  });
});

describe("faltantes para el próximo", () => {
  it("marca qué medidas hay que fabricar para el próximo juego", () => {
    const filas = filasComponentes(medidas({ Ø44: 2, Ø46: 1, Ø48: 3 }));
    // completos = 1 → próximo = 2
    expect(filas.map((f) => [f.componente.codigo_o_medida, f.faltanProximo, f.estado])).toEqual([
      ["Ø44", 0, "ok"],
      ["Ø46", 1, "fabricar"],
      ["Ø48", 0, "ok"],
    ]);
  });
  it("piezas con cantidad por instrumental", () => {
    const filas = filasComponentes(complejo(0, [["A", 1, 1], ["B", 1, 2]]));
    expect(filas.map((f) => f.faltanProximo)).toEqual([0, 1]);
  });
});

describe("estado en la caja", () => {
  it("disponible si alcanza para 1 caja", () => expect(estadoEnCaja(simple(2), 2)).toMatchObject({ estado: "disponible", alcanza: 1 }));
  it("en proceso con texto 'Hay X de Y'", () => expect(estadoEnCaja(simple(1), 2)).toMatchObject({ estado: "en_proceso", falta: "Hay 1 de 2 por caja" }));
  it("en proceso: medidas que faltan", () =>
    expect(estadoEnCaja(medidas({ Ø50: 1, Ø52: 0, Ø58: 0 }), 1)).toMatchObject({ estado: "en_proceso", falta: "Falta: Ø52, Ø58" }));
  it("en proceso: complejo con piezas sueltas", () =>
    expect(estadoEnCaja(complejo(0, [["1/4", 1, 1], ["2/4", 0, 1]]), 1)).toMatchObject({ estado: "en_proceso", falta: "Falta: 2/4" }));
  it("falta si no hay nada", () => expect(estadoEnCaja(simple(0), 1).estado).toBe("falta"));
  it("sin definir si no tiene medidas o piezas", () => {
    expect(estadoEnCaja(medidas({}), 1).estado).toBe("sin_definir");
    expect(estadoEnCaja(complejo(3, []), 1).estado).toBe("sin_definir");
  });
});

describe("resumen de caja con stock compartido", () => {
  const cureta = simple(3, "cureta");
  const cabeza = medidas({ Ø28: 2, Ø32: 1 }, "cabeza");
  it("cajas posibles = el instrumental que menos alcanza", () => {
    const r = resumenCaja([
      { inst: cureta, cantPorCaja: 1 },
      { inst: cabeza, cantPorCaja: 1 },
    ]);
    expect(r.posibles).toBe(1);
    expect(r.limitante?.inst.id).toBe("cabeza");
    expect(r.contadores).toEqual({ disponible: 2, en_proceso: 0, falta: 0, sin_definir: 0 });
  });
  it("cada caja se calcula por separado con el mismo stock (no se suma)", () => {
    const tri = resumenCaja([{ inst: cureta, cantPorCaja: 1 }]);
    const chm = resumenCaja([{ inst: cureta, cantPorCaja: 2 }]);
    expect([tri.posibles, chm.posibles]).toEqual([3, 1]);
  });
  it("caja vacía = 0", () => expect(resumenCaja([]).posibles).toBe(0));
});

describe("armado de caja", () => {
  it("descuenta simple, medidas y complejo (primero armados, después piezas)", () => {
    const s = simple(3, "S");
    const m = medidas({ Ø44: 2, Ø46: 5 }, "M");
    m.componentes[1].cant_por_unidad = 2;
    const c = complejo(1, [["A", 2, 1], ["B", 4, 2]], "C");
    const plan = planArmadoCaja([
      { inst: s, cantPorCaja: 2 },
      { inst: m, cantPorCaja: 2 },
      { inst: c, cantPorCaja: 3 },
    ]);
    expect(plan.ok).toBe(true);
    expect(plan.descuentos.map((d) => [d.instrumental_id, d.campo, d.cantidad])).toEqual([
      ["S", "stock_terminado", 2],
      ["M", "stock", 2],
      ["M", "stock", 4],
      ["C", "unidades_armadas", 1],
      ["C", "stock", 2],
      ["C", "stock", 4],
    ]);
  });
  it("si falta algo no arma y dice qué", () => {
    const plan = planArmadoCaja([{ inst: simple(0), cantPorCaja: 1 }, { inst: medidas({}), cantPorCaja: 1 }]);
    expect(plan.ok).toBe(false);
    expect(plan.faltantes).toEqual(["Cureta: hay 0 de 1", "Probador: sin medidas cargadas"]);
  });
  it("caja sin instrumental no se arma", () => expect(planArmadoCaja([]).ok).toBe(false));
});

describe("qué fabricar", () => {
  it("suma lo que piden las cajas que comparten instrumental", () => {
    const cureta = simple(1, "cureta");
    const filas = queFabricar([
      { composicion: [{ inst: cureta, cantPorCaja: 1 }], cajas: 2 }, // TRI ×2
      { composicion: [{ inst: cureta, cantPorCaja: 1 }], cajas: 1 }, // CHM ×1
    ]);
    expect(filas.map((f) => [f.inst.id, f.cantidad])).toEqual([["cureta", 2]]);
  });
  it("medidas por medida y complejo descontando armados", () => {
    const m = medidas({ Ø28: 1, Ø32: 0 }, "cabeza");
    const c = complejo(1, [["1/2", 0, 1], ["2/2", 1, 2]], "palanca");
    const filas = queFabricar([{ composicion: [{ inst: m, cantPorCaja: 1 }, { inst: c, cantPorCaja: 1 }], cajas: 2 }]);
    expect(filas.map((f) => [f.inst.id, f.componente?.codigo_o_medida, f.cantidad])).toEqual([
      ["cabeza", "Ø28", 1],
      ["cabeza", "Ø32", 2],
      ["palanca", "1/2", 1],
      ["palanca", "2/2", 1],
    ]);
  });
  it("avisa los que no tienen medidas cargadas", () => {
    const filas = queFabricar([{ composicion: [{ inst: medidas({}), cantPorCaja: 1 }], cajas: 1 }]);
    expect(filas[0]).toMatchObject({ componente: null, cantidad: 1, nota: "Sin medidas cargadas" });
  });
  it("nada si alcanza", () => expect(queFabricar([{ composicion: [{ inst: simple(5), cantPorCaja: 1 }], cajas: 2 }])).toEqual([]));
  it("cajas que faltan para los pedidos", () =>
    expect(cajasFaltantesParaPedidos([{ caja_id: "DM", cantidad: 2 }, { caja_id: "DM", cantidad: 1 }, { caja_id: "TRI", cantidad: 1 }], { DM: 1, TRI: 4 })).toEqual({ DM: 2 }));
});

describe("rango de medidas", () => {
  it("Ø44 a Ø62 de a 2", () => expect(generarRango("Ø44 a Ø62 de a 2")).toEqual(["Ø44", "Ø46", "Ø48", "Ø50", "Ø52", "Ø54", "Ø56", "Ø58", "Ø60", "Ø62"]));
  it("decimales con coma", () => expect(generarRango("N°7,5 a N°20 de a 2,5")).toEqual(["N°7.5", "N°10", "N°12.5", "N°15", "N°17.5", "N°20"]));
  it("sin paso", () => expect(generarRango("12-14")).toEqual(["12", "13", "14"]));
  it("no entiende", () => expect(generarRango("cualquier cosa")).toBeNull());
});
