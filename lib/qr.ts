import "server-only";
import { headers } from "next/headers";
import QRCode from "qrcode";

/** URL pública de la app (la del QR). Usa NEXT_PUBLIC_SITE_URL o, si falta, el host del pedido. */
export async function urlBase(): Promise<string> {
  let base = process.env.NEXT_PUBLIC_SITE_URL;
  if (!base) {
    const h = await headers();
    base = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  }
  return base.replace(/\/$/, "");
}

/** QR en SVG, negro sobre blanco (se imprime bien en cualquier impresora). */
export function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
}

// Rutas de destino de cada tipo de QR
export const rutaCargaGeneral = () => "/cargar";
export const rutaCargaCaja = (cajaId: string) => `/cargar/${cajaId}`;
export const rutaCargaInstrumental = (cajaId: string, instrumentalId: string) => `/cargar/${cajaId}?i=${instrumentalId}`;
