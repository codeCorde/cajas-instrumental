import Link from "next/link";
import { notFound } from "next/navigation";
import { archivosDe, cajaPorCodigo, leerApariencia } from "@/lib/datos";
import { qrSvg, rutaTaller, urlBase } from "@/lib/qr";
import { IMAGENES } from "@/lib/formato";
import BotonImprimir from "@/components/BotonImprimir";

export default async function QrCajaPage({ params, searchParams }: { params: Promise<{ codigo: string }>; searchParams: Promise<{ tam?: string }> }) {
  const [{ codigo }, { tam }] = await Promise.all([params, searchParams]);
  const caja = await cajaPorCodigo(decodeURIComponent(codigo));
  if (!caja) notFound();
  const chica = tam === "chica";
  const url = `${await urlBase()}${rutaTaller(caja.codigo)}`;
  const [svg, ap, fotos] = await Promise.all([qrSvg(url), leerApariencia(), archivosDe("caja", [caja.id])]);
  const foto = fotos.find((a) => IMAGENES.includes(a.tipo) && a.vigente);

  return (
    <div className="space-y-5">
      <div className="no-imprimir flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-tenue">
            <Link href={`/cajas/${caja.codigo}`} className="hover:underline">
              {caja.nombre}
            </Link>{" "}
            / QR
          </p>
          <h1 className="titulo text-4xl">QR para el taller</h1>
          <p className="text-sm text-tenue mt-1">
            Pegalo en la caja o en el banco de trabajo. Al escanearlo (con la sesión iniciada) se abre la carga de stock de esta caja.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="?tam=a4" className={`btn ${!chica ? "btn-primario" : ""}`} aria-current={!chica ? "page" : undefined}>
            Hoja A4
          </Link>
          <Link href="?tam=chica" className={`btn ${chica ? "btn-primario" : ""}`} aria-current={chica ? "page" : undefined}>
            Etiqueta chica
          </Link>
          <BotonImprimir />
        </div>
      </div>

      {chica ? (
        <div className="card inline-flex items-center gap-3 p-3 bg-white text-black" style={{ width: "8cm" }}>
          <div className="w-[3.2cm] shrink-0 [&_svg]:w-full [&_svg]:h-auto" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="min-w-0">
            <p className="font-mono text-xs font-bold">{caja.codigo}</p>
            <p className="titulo text-lg leading-tight">{caja.nombre}</p>
            <p className="text-[10px] mt-1">Escaneá para cargar stock</p>
          </div>
        </div>
      ) : (
        <div className="card mx-auto p-10 bg-white text-black text-center space-y-6" style={{ maxWidth: "19cm" }}>
          <p className="text-sm uppercase tracking-widest">{ap.empresa}</p>
          <h2 className="titulo text-5xl">{caja.nombre}</h2>
          {foto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/archivos/${foto.id}`} alt={`Foto de ${caja.nombre}`} className="mx-auto max-h-48 object-contain" />
          )}
          <div className="mx-auto w-[12cm] max-w-full [&_svg]:w-full [&_svg]:h-auto" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="text-2xl font-semibold">Escaneá para cargar stock</p>
          <p className="font-mono text-xs break-all">{url}</p>
        </div>
      )}
    </div>
  );
}
