/**
 * Marca "InstrumentARG": la "A" y la "G" en letra negra sobre fondo celeste, la "R" en letra dorada sobre fondo blanco
 * (como la bandera). Los colores son fijos (no cambian con el modo oscuro).
 */
const CELESTE = "#74acdf";
const DORADO = "#b8860b";

export default function MarcaInstrumentARG({ tam = "grande" }: { tam?: "grande" | "chica" }) {
  const grande = tam === "grande";
  const caja = grande ? "px-2 py-0.5 text-5xl sm:text-6xl" : "px-1 text-2xl";
  return (
    <span className={`titulo inline-flex items-center gap-1 normal-case ${grande ? "text-5xl sm:text-6xl" : "text-2xl"}`} aria-label="InstrumentARG">
      <span aria-hidden="true">Instrument</span>
      <span aria-hidden="true" className="inline-flex rounded-sm border-2 border-black overflow-hidden">
        <span className={caja} style={{ background: CELESTE, color: "#000" }}>A</span>
        <span className={caja} style={{ background: "#fff", color: DORADO }}>R</span>
        <span className={caja} style={{ background: CELESTE, color: "#000" }}>G</span>
      </span>
    </span>
  );
}
