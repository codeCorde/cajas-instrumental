import { describe, expect, it } from "vitest";
import { nombreDeArchivo, ordenarPlanos, seVeEnNavegador, slug, tamanoLegible } from "@/lib/planos";

describe("planos", () => {
  it("convierte el ¥ mal codificado en Ø y separa el formato", () => {
    expect(nombreDeArchivo("Probador de componente cefálico ¥28.pdf")).toEqual({ nombre: "Probador de componente cefálico Ø28", formato: "pdf" });
    expect(nombreDeArchivo("prensa.STP")).toEqual({ nombre: "prensa", formato: "stp" });
  });

  it("arma rutas seguras para Storage", () => {
    expect(slug("Raspa Muller N°12.5.pdf")).toBe("raspa-muller-no12.5.pdf");
    expect(slug("Calisuar en T ¥12.pdf")).toBe("calisuar-en-t-o12.pdf");
    expect(slug("Guía de mecha.pdf")).toBe("guia-de-mecha.pdf");
  });

  it("muestra primero los PDF y ordena por número natural", () => {
    const p = (nombre: string, formato: string) => ({ nombre, formato, orden: 0 });
    const r = ordenarPlanos([p("prensa", "dwg"), p("Prensa 10-12", "pdf"), p("Prensa 2-12", "pdf")]).map((x) => x.nombre);
    expect(r).toEqual(["Prensa 2-12", "Prensa 10-12", "prensa"]);
  });

  it("sabe qué se puede ver en el navegador", () => {
    expect(seVeEnNavegador("PDF")).toBe(true);
    expect(seVeEnNavegador("dwg")).toBe(false);
    expect(seVeEnNavegador("stp")).toBe(false);
  });

  it("muestra tamaños legibles", () => {
    expect(tamanoLegible(2_582_110)).toBe("2,5 MB");
    expect(tamanoLegible(300_000)).toBe("293 KB");
  });
});
