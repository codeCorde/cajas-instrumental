// Formatos de fecha, tamaño y archivos (hora de Argentina).
const TZ = "America/Argentina/Buenos_Aires";

export const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
export const fecha = (iso: string) =>
  new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("es-AR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
export const hoyISO = () => new Date().toLocaleDateString("sv-SE", { timeZone: TZ });

export function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export const extension = (nombre: string) => (nombre.includes(".") ? nombre.split(".").pop()!.toLowerCase() : "");
export const IMAGENES = ["png", "jpg", "jpeg", "webp", "gif"];
export const seVeEnLaWeb = (tipo: string) => tipo === "pdf" || IMAGENES.includes(tipo);

export function iconoArchivo(tipo: string): { icono: string; etiqueta: string } {
  if (tipo === "pdf") return { icono: "📄", etiqueta: "PDF · plano 2D" };
  if (tipo === "dwg" || tipo === "dxf") return { icono: "📐", etiqueta: "AutoCAD" };
  if (tipo === "stp" || tipo === "step") return { icono: "🧊", etiqueta: "3D (STEP)" };
  if (IMAGENES.includes(tipo)) return { icono: "🖼", etiqueta: "Imagen" };
  return { icono: "📎", etiqueta: tipo.toUpperCase() || "Archivo" };
}

export const TAMANO_MAX = 50 * 1024 * 1024;
export const EXTENSIONES_OK = ["pdf", "dwg", "dxf", "stp", "step", ...IMAGENES];

/** Nombre seguro para la ruta en Storage. */
export const slug = (t: string) =>
  t.replace(/[Ø¥°]/g, "o").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
