import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { exigirAdmin } from "@/lib/auth";
import BotonImprimir from "@/components/BotonImprimir";

export const dynamic = "force-dynamic";

/** QR general: abre /cargar. Si no hay sesión, pide login y vuelve a /cargar. */
export default async function QrPage() {
  await exigirAdmin();
  let base = process.env.NEXT_PUBLIC_SITE_URL;
  if (!base) {
    const h = await headers();
    base = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  }
  const destino = `${base.replace(/\/$/, "")}/cargar`;
  const svg = await QRCode.toString(destino, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });

  return (
    <div className="space-y-4">
      <div className="no-imprimir flex flex-wrap items-center gap-3">
        <Link href="/admin" className="btn px-3" aria-label="Volver a Administración">
          ‹
        </Link>
        <h1 className="titulo text-4xl">QR de carga</h1>
        <div className="ml-auto">
          <BotonImprimir />
        </div>
      </div>

      <div className="card mx-auto max-w-md p-8 text-center bg-white text-black space-y-4">
        <p className="titulo text-3xl">Carga de stock</p>
        <div className="mx-auto w-64 h-64 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label={`Código QR que abre ${destino}`} />
        <p className="text-lg font-semibold">Escaneá con el celular para cargar + / −</p>
        <p className="font-mono text-xs break-all">{destino}</p>
      </div>
      <p className="no-imprimir text-center text-sm text-tenue">
        Es un único QR para todo el taller. Al escanearlo se elige la caja y después el instrumental.
      </p>
    </div>
  );
}
