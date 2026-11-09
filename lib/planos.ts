// Utilidades de planos (sirven en servidor y navegador).

export interface Plano {
  id: string;
  caja_id: string;
  instrumental_id: string | null;
  nombre: string;
  ruta: string;
  formato: string;
  tamano: number | null;
  orden: number;
}

export const BUCKET_PLANOS = "planos";

/** Formatos que el navegador puede mostrar directamente. */
const VISIBLES = new Set(["pdf", "png", "jpg", "jpeg", "webp", "svg"]);

const ETIQUETAS: Record<string, string> = {
  pdf: "PDF",
  dwg: "DWG",
  dxf: "DXF",
  stp: "STEP 3D",
  step: "STEP 3D",
  igs: "IGES 3D",
  iges: "IGES 3D",
  stl: "STL 3D",
};

export const ACEPTA_PLANOS = ".pdf,.dwg,.dxf,.stp,.step,.igs,.iges,.stl,.png,.jpg,.jpeg,.webp";

export function seVeEnNavegador(formato: string) {
  return VISIBLES.has(formato.toLowerCase());
}

export function etiquetaFormato(formato: string) {
  return ETIQUETAS[formato.toLowerCase()] ?? formato.toUpperCase();
}

export function programaSugerido(formato: string) {
  const f = formato.toLowerCase();
  if (f === "dwg" || f === "dxf") return "AutoCAD, DWG TrueView o un visor DWG";
  if (["stp", "step", "igs", "iges", "stl"].includes(f)) return "SolidWorks, eDrawings, FreeCAD o tu programa de CAD/CAM";
  return "el programa correspondiente";
}

export function tamanoLegible(bytes: number | null) {
  if (bytes == null) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** PDFs primero, después el resto; dentro de cada grupo, orden natural por nombre. */
export function ordenarPlanos<T extends Pick<Plano, "nombre" | "formato" | "orden">>(planos: T[]): T[] {
  const peso = (p: T) => (seVeEnNavegador(p.formato) ? 0 : 1);
  return [...planos].sort(
    (a, b) => peso(a) - peso(b) || a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es", { numeric: true }),
  );
}

/** "Probador ¥28.pdf" → { nombre: "Probador Ø28", formato: "pdf" } (el ¥ es una Ø mal codificada). */
export function nombreDeArchivo(archivo: string) {
  const punto = archivo.lastIndexOf(".");
  const base = punto > 0 ? archivo.slice(0, punto) : archivo;
  const formato = punto > 0 ? archivo.slice(punto + 1).toLowerCase() : "bin";
  return { nombre: base.replace(/¥/g, "Ø").trim(), formato };
}

/** Texto seguro para usar como ruta en Storage (sin acentos ni símbolos). */
export function slug(texto: string) {
  return texto
    .replace(/[Ø¥°]/g, "o")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
