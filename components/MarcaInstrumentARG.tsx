/**
 * Marca "InstrumentARG" (foto "Realizar pedidos 1"): "AR" en letra negra sobre fondo celeste
 * y "G" en letra dorada sobre fondo blanco. Los colores son fijos (no cambian con el modo oscuro).
 */
export default function MarcaInstrumentARG({ tam = "grande" }: { tam?: "grande" | "chica" }) {
  const grande = tam === "grande";
  const caja = grande ? "px-2 py-0.5 text-5xl sm:text-6xl" : "px-1 text-2xl";
  return (
    <span className={`titulo inline-flex items-center gap-1 normal-case ${grande ? "text-5xl sm:text-6xl" : "text-2xl"}`} aria-label="InstrumentARG">
      <span aria-hidden="true">Instrument</span>
      <span aria-hidden="true" className={`${caja} rounded-sm border-2 border-black`} style={{ background: "#74acdf", color: "#000" }}>
        AR
      </span>
      <span aria-hidden="true" className={`${caja} rounded-sm border-2 border-black`} style={{ background: "#fff", color: "#b8860b" }}>
        G
      </span>
    </span>
  );
}
