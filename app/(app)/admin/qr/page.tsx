import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { listarCajasCompletas } from "@/lib/datos";
import { qrSvg, rutaCargaCaja, rutaCargaGeneral, rutaCargaInstrumental, urlBase } from "@/lib/qr";
import BotonImprimir from "@/components/BotonImprimir";

export const dynamic = "force-dynamic";

function Qr({ svg, url, className }: { svg: string; url: string; className: string }) {
  return (
    <div
      className={`mx-auto [&>svg]:h-full [&>svg]:w-full ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
      role="img"
      aria-label={`Código QR que abre ${url}`}
    />
  );
}

/**
 * QR de carga de stock. Tres niveles:
 *  - General: abre /cargar (se elige caja e instrumental).
 *  - Por caja: abre directo la caja (para pegar en la caja o su estante).
 *  - Por instrumental: abre directo el + / − de ese instrumental (etiquetas para el puesto de trabajo).
 * Si quien escanea no tiene sesión, pide login y después vuelve al mismo destino.
 */
export default async function QrPage({ searchParams }: { searchParams: Promise<{ caja?: string }> }) {
  await exigirAdmin();
  const { caja: cajaId } = await searchParams;
  const [base, cajas] = await Promise.all([urlBase(), listarCajasCompletas()]);
  const caja = cajas.find((c) => c.id === cajaId) ?? null;

  const general = base + rutaCargaGeneral();
  const svgGeneral = await qrSvg(general);
  const urlCaja = caja ? base + rutaCargaCaja(caja.id) : null;
  const svgCaja = urlCaja ? await qrSvg(urlCaja) : null;
  const etiquetas = caja
    ? await Promise.all(
        caja.instrumentales.map(async (i) => {
          const url = base + rutaCargaInstrumental(caja.id, i.id);
          return { i, url, svg: await qrSvg(url) };
        }),
      )
    : [];

  return (
    <div className="space-y-5">
      <div className="no-imprimir flex flex-wrap items-center gap-3">
        <Link href="/admin" className="btn px-3" aria-label="Volver a Administración">
          ‹
        </Link>
        <h1 className="titulo text-4xl">QR de carga</h1>
        <div className="ml-auto">
          <BotonImprimir />
        </div>
      </div>

      <nav className="no-imprimir card p-3 space-y-2" aria-label="Elegir qué QR imprimir">
        <p className="text-sm text-tenue">Elegí qué QR querés imprimir. Al escanearlo con el celular se abre la carga de stock.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/qr" className={`btn px-3 text-sm ${!caja ? "btn-primario" : ""}`} aria-current={!caja ? "page" : undefined}>
            QR general del taller
          </Link>
          {cajas.map((c) => (
            <Link
              key={c.id}
              href={`/admin/qr?caja=${c.id}`}
              className={`btn px-3 text-sm ${caja?.id === c.id ? "btn-primario" : ""}`}
              aria-current={caja?.id === c.id ? "page" : undefined}
            >
              Caja {c.numero} · {c.nombre}
            </Link>
          ))}
        </div>
      </nav>

      {!caja ? (
        <>
          <div className="card mx-auto max-w-md space-y-4 bg-white p-8 text-center text-black">
            <p className="titulo text-3xl">Carga de stock</p>
            <Qr svg={svgGeneral} url={general} className="h-64 w-64" />
            <p className="text-lg font-semibold">Escaneá con el celular para cargar + / −</p>
            <p className="break-all font-mono text-xs">{general}</p>
          </div>
          <p className="no-imprimir text-center text-sm text-tenue">
            Un solo QR para todo el taller: al escanearlo se elige la caja y después el instrumental.
          </p>
        </>
      ) : (
        <>
          <section className="card mx-auto max-w-md space-y-3 bg-white p-6 text-center text-black break-inside-avoid">
            <p className="font-mono text-sm">CAJA {caja.numero}</p>
            <p className="titulo text-3xl leading-none">{caja.nombre}</p>
            <Qr svg={svgCaja!} url={urlCaja!} className="h-56 w-56" />
            <p className="font-semibold">Escaneá para cargar stock de esta caja</p>
          </section>

          <div className="no-imprimir flex flex-wrap items-baseline gap-2">
            <h2 className="titulo text-2xl">Etiquetas por instrumental</h2>
            <span className="text-sm text-tenue">
              {etiquetas.length} etiquetas · cada una abre directo el + / − de ese instrumental
            </span>
          </div>

          {etiquetas.length === 0 ? (
            <p className="text-tenue">Esta caja no tiene instrumentales.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-4 print:gap-2">
              {etiquetas.map(({ i, url, svg }) => (
                <li
                  key={i.id}
                  className="flex flex-col items-center gap-1 rounded border border-dashed border-neutral-400 bg-white p-3 text-center text-black break-inside-avoid"
                >
                  <Qr svg={svg} url={url} className="h-32 w-32" />
                  <span className="font-mono text-xs">
                    Caja {caja.numero} · {i.codigo}
                  </span>
                  <span className="text-sm font-semibold leading-tight">{i.nombre}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="no-imprimir text-sm text-tenue">
            Tip: imprimí en hoja A4 y recortá por la línea punteada. Si cambiás el nombre de un instrumental, el QR sigue
            andando (apunta al instrumental, no al nombre); solo reimprimí para que la etiqueta muestre el nombre nuevo.
          </p>
        </>
      )}
    </div>
  );
}
