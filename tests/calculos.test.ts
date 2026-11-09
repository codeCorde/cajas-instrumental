import { describe, expect, it } from "vitest";
import {
  aFabricar,
  cajasCompletas,
  cajasQueAlcanza,
  evaluarInstrumental,
  resumenCaja,
  stockCompleto,
  type InstrumentalCalc,
  type ParteCalc,
} from "@/lib/calculos";
import { planArmadoCaja } from "@/lib/armado";

// ---------- helpers ----------
const inst = (o: Partial<InstrumentalCalc> & Pick<InstrumentalCalc, "codigo" | "nombre" | "tipo">): InstrumentalCalc => ({
  id: o.codigo,
  cant_por_caja: 1,
  stock_terminado: 0,
  unidades_armadas: 0,
  partes: [],
  ...o,
});
const medida = (m: string, stock: number, cant = 1): ParteCalc => ({ id: m, codigo_o_medida: m, cant_por_unidad: cant, stock });
const parte = (c: string, nombre: string, stock: number, cant = 1): ParteCalc => ({
  id: c,
  codigo_o_medida: c,
  nombre,
  cant_por_unidad: cant,
  stock,
});

// ---------- datos de ejemplo (igual que supabase/seed.sql) ----------
const colocadores = () =>
  inst({
    codigo: "1.5",
    nombre: "Colocadores Rojos DM",
    tipo: "medidas",
    cant_por_caja: 2,
    partes: [
      medida("Ø44", 4), medida("Ø46", 3), medida("Ø48", 2), medida("Ø50", 5), medida("Ø52", 1),
      medida("Ø54", 2), medida("Ø56", 3), medida("Ø58", 0), medida("Ø60", 2),
    ],
  });

const cajaDM = (): InstrumentalCalc[] => [
  inst({ codigo: "1.1", nombre: "Probador de cúpula", tipo: "medidas" }),
  inst({ codigo: "1.2", nombre: "Mango impactor", tipo: "complejo" }),
  inst({ codigo: "1.3", nombre: "Plástico convexo", tipo: "simple", cant_por_caja: 2, stock_terminado: 1 }),
  inst({ codigo: "1.4", nombre: "Plástico cóncavo", tipo: "simple", cant_por_caja: 1, stock_terminado: 0 }),
  colocadores(),
  inst({ codigo: "1.6", nombre: "Liner DM", tipo: "medidas" }),
  inst({ codigo: "1.7", nombre: "Prensa", tipo: "complejo" }),
  inst({ codigo: "1.8", nombre: "Cabeza de prueba", tipo: "medidas" }),
  inst({ codigo: "1.9", nombre: "Mango de fresas", tipo: "complejo" }),
  inst({ codigo: "1.10", nombre: "Fresas acetabulares", tipo: "medidas" }),
];

// ---------- tests ----------
describe("Caja Doble Movilidad (seed)", () => {
  const caja = cajaDM();
  const porCodigo = (c: string) => evaluarInstrumental(caja.find((i) => i.codigo === c)!);

  it("1.3 Plástico convexo: en proceso, hay 1 de 2", () => {
    const r = porCodigo("1.3");
    expect(r.stockCompleto).toBe(1);
    expect(r.cajasQueAlcanza).toBe(0);
    expect(r.estado).toBe("en_proceso");
    expect(r.faltaTexto).toBe("Hay 1 de 2 unid. por caja");
  });

  it("1.4 Plástico cóncavo: falta", () => {
    expect(porCodigo("1.4").estado).toBe("falta");
  });

  it("1.5 Colocadores: 0 juegos (Ø58 en 0), falta Ø52 y Ø58 para una caja", () => {
    const r = porCodigo("1.5");
    expect(r.stockCompleto).toBe(0);
    expect(r.estado).toBe("en_proceso");
    expect(r.faltaTexto).toBe("Falta: Ø52, Ø58");
  });

  it("instrumentales sin medidas/partes → sin_partes", () => {
    for (const c of ["1.1", "1.2", "1.6", "1.7", "1.8", "1.9", "1.10"]) {
      expect(porCodigo(c).estado).toBe("sin_partes");
    }
  });

  it("resumen de la caja", () => {
    expect(resumenCaja(caja)).toEqual({
      cajasCompletas: 0,
      total: 10,
      disponibles: 0,
      enProceso: 2,
      faltan: 1,
      sinPartes: 7,
      estado: "en_proceso",
    });
  });

  it("no se puede armar una caja y dice qué falta", () => {
    const plan = planArmadoCaja(caja);
    expect(plan.ok).toBe(false);
    expect(plan.faltantes).toContain("1.3 Plástico convexo: hay 1 de 2");
    expect(plan.faltantes).toContain("1.5 Colocadores Rojos DM · Ø58: hay 0 de 2");
    expect(plan.faltantes).toContain("1.1 Probador de cúpula: sin medidas cargadas");
  });

  it("lista de fabricar para la próxima caja (objetivo 1)", () => {
    const filas = aFabricar(colocadores(), 1);
    const q = Object.fromEntries(filas.map((f) => [f.etiqueta, f.cantidad]));
    expect(q).toEqual({ Ø44: 0, Ø46: 0, Ø48: 0, Ø50: 0, Ø52: 1, Ø54: 0, Ø56: 0, Ø58: 2, Ø60: 0 });
    expect(aFabricar(caja[2], 1)).toEqual([{ parteId: null, etiqueta: "Terminado", cantidad: 1 }]);
    expect(aFabricar(caja[0], 1)[0].cantidad).toBeNull();
  });
});

describe("stock completo y cajas que alcanza", () => {
  it("Medidas: lo limita la medida que menos hay, respetando cant. por juego", () => {
    const i = inst({ codigo: "x", nombre: "x", tipo: "medidas", cant_por_caja: 1, partes: [medida("A", 7, 2), medida("B", 9, 1)] });
    expect(stockCompleto(i)).toBe(3); // floor(7/2)=3, 9 → min 3
    expect(cajasQueAlcanza(i)).toBe(3);
  });

  it("Complejo: armadas + lo que se puede armar con partes", () => {
    const i = inst({
      codigo: "x",
      nombre: "Mango",
      tipo: "complejo",
      cant_por_caja: 2,
      unidades_armadas: 1,
      partes: [parte("A", "Base", 5), parte("B", "Cuerpo", 4, 2), parte("C", "Tornillo", 9, 3)],
    });
    expect(stockCompleto(i)).toBe(1 + 2); // min(5, 2, 3) = 2
    expect(cajasQueAlcanza(i)).toBe(1);
    expect(evaluarInstrumental(i).estado).toBe("disponible");
  });

  it("Complejo en proceso indica qué parte falta", () => {
    const i = inst({
      codigo: "x",
      nombre: "Mango",
      tipo: "complejo",
      partes: [parte("A", "Base", 1), parte("B", "Cuerpo", 0), parte("C", "Tornillo", 1)],
    });
    const r = evaluarInstrumental(i);
    expect(r.estado).toBe("en_proceso");
    expect(r.faltaTexto).toBe("Falta: B Cuerpo");
  });

  it("Complejo con unidades armadas y sin partes se evalúa normal", () => {
    const i = inst({ codigo: "x", nombre: "x", tipo: "complejo", unidades_armadas: 2 });
    expect(evaluarInstrumental(i).estado).toBe("disponible");
    expect(cajasQueAlcanza(i)).toBe(2);
  });

  it("cajas completas = mínimo entre instrumentales; 0 si la caja está vacía", () => {
    const a = inst({ codigo: "a", nombre: "a", tipo: "simple", stock_terminado: 5 });
    const b = inst({ codigo: "b", nombre: "b", tipo: "simple", stock_terminado: 4, cant_por_caja: 2 });
    expect(cajasCompletas([a, b])).toBe(2);
    expect(cajasCompletas([])).toBe(0);
    expect(resumenCaja([]).estado).toBe("vacia");
    expect(resumenCaja([a, b]).estado).toBe("completa");
  });
});

describe("lista de fabricar con objetivo N", () => {
  it("Complejo: unidades que faltan y partes", () => {
    const i = inst({
      codigo: "x",
      nombre: "x",
      tipo: "complejo",
      cant_por_caja: 1,
      unidades_armadas: 1,
      partes: [parte("A", "Base", 0), parte("C", "Tornillo", 3, 3)],
    });
    // objetivo 3 → faltan 2 unidades; A: 1×2−0=2 ; C: 3×2−3=3
    expect(aFabricar(i, 3)).toEqual([
      { parteId: null, etiqueta: "Unidades a armar", cantidad: 2 },
      { parteId: "A", etiqueta: "A Base", cantidad: 2 },
      { parteId: "C", etiqueta: "C Tornillo", cantidad: 3 },
    ]);
  });
});

describe("armado de caja", () => {
  it("descuenta según la regla cuando hay stock", () => {
    const caja = [
      inst({ codigo: "s", nombre: "Simple", tipo: "simple", cant_por_caja: 2, stock_terminado: 3 }),
      inst({ codigo: "m", nombre: "Medidas", tipo: "medidas", cant_por_caja: 2, partes: [medida("Ø44", 2), medida("Ø46", 4, 2)] }),
      inst({
        codigo: "c",
        nombre: "Complejo",
        tipo: "complejo",
        cant_por_caja: 3,
        unidades_armadas: 1,
        partes: [parte("A", "Base", 2), parte("B", "Cuerpo", 4, 2)],
      }),
    ];
    const plan = planArmadoCaja(caja);
    expect(plan.ok).toBe(true);
    expect(plan.descuentos.map((d) => [d.instrumentalId, d.parteId, d.campo, d.cantidad])).toEqual([
      ["s", null, "stock_terminado", 2],
      ["m", "Ø44", "stock_parte", 2],
      ["m", "Ø46", "stock_parte", 4],
      ["c", null, "unidades_armadas", 1],
      ["c", "A", "stock_parte", 2],
      ["c", "B", "stock_parte", 4],
    ]);
  });

  it("si las unidades armadas alcanzan, no toca las partes", () => {
    const c = inst({ codigo: "c", nombre: "C", tipo: "complejo", unidades_armadas: 1, partes: [parte("A", "Base", 0)] });
    const plan = planArmadoCaja([c]);
    expect(plan.ok).toBe(true);
    expect(plan.descuentos).toHaveLength(1);
    expect(plan.descuentos[0].campo).toBe("unidades_armadas");
  });

  it("es consistente con cajasCompletas", () => {
    const casos: InstrumentalCalc[][] = [
      cajaDM(),
      [inst({ codigo: "a", nombre: "a", tipo: "simple", stock_terminado: 1 })],
      [inst({ codigo: "c", nombre: "c", tipo: "complejo", cant_por_caja: 2, unidades_armadas: 1, partes: [parte("A", "x", 1)] })],
      [inst({ codigo: "c", nombre: "c", tipo: "complejo", cant_por_caja: 2, unidades_armadas: 0, partes: [parte("A", "x", 1)] })],
    ];
    for (const c of casos) expect(planArmadoCaja(c).ok).toBe(cajasCompletas(c) >= 1);
  });
});
