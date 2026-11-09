import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerPerfil } from "@/lib/auth";
import { listarPlanosInstrumental, obtenerInstrumental } from "@/lib/datos";
import { TIPO_LABEL } from "@/lib/tipos";
import { etiquetaFormato, programaSugerido, seVeEnNavegador } from "@/lib/planos";
import FilaPlano from "@/components/FilaPlano";

export const dynamic = "force-dynamic";

export default async function PlanosInstrumentalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { id } = await params;
  const { p } = await searchParams;
  const [i, planos, perfil] = await Promise.all([obtenerInstrumental(id), listarPlanosInstrumental(id), obtenerPerfil()]);
  if (!i) notFound();

  const seleccionado = planos.find((x) => x.id === p) ?? planos.find((x) => seVeEnNavegador(x.formato)) ?? null;
  const medidas = i.partes.map((x) => (x.nombre ? `${x.codigo_o_medida} ${x.nombre}` : x.codigo_o_medida));

  const datos: [string, string | null][] = [
    ["Tipo", TIPO_LABEL[i.tipo]],
    ["Cant. por caja", String(i.cant_por_caja)],
    [i.tipo === "medidas" ? "Medidas" : "Partes", medidas.length ? medidas.join(" · ") : null],
    ["Material", i.material],
    ["Terminación", i.terminacion],
    ["Barra / MP", i.barra],
    ["Proveedor", i.origen === "tercerizado" ? (i.proveedor ?? "Tercerizado") : null],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/planos" className="btn px-3" aria-label="Volver a planos">
          ‹
        </Link>
        <div className="min-w-0">
          <p className="font-mono text-xs text-tenue">
            CAJA {i.caja.numero} · {i.caja.nombre}
          </p>
          <h1 className="titulo text-4xl leading-none">
            <span className="font-mono text-2xl text-tenue">{i.codigo}</span> {i.nombre}
          </h1>
          {i.alias && <p className="text-sm text-tenue">{i.alias}</p>}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Link href={`/cajas/${i.caja.id}?i=${i.id}`} className="btn px-3 text-sm">
            Ver stock
          </Link>
          {perfil.rol === "admin" && (
            <Link href={`/admin/instrumentales/${i.id}#planos`} className="btn px-3 text-sm">
              Editar / subir planos
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="space-y-4">
          <section className="card p-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {datos
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-tenue">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
            </dl>
            {(i.notas ?? []).length > 0 && (
              <ul className="mt-3 space-y-2 border-t border-borde pt-3">
                {(i.notas ?? []).map((n) => (
                  <li key={n.id} className="rounded bg-superficie-2 p-2 text-sm">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-tenue">{n.tipo}</span>
                    <p className="whitespace-pre-line">{n.texto}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-4 space-y-2" aria-labelledby="titulo-archivos">
            <h2 id="titulo-archivos" className="titulo text-2xl">
              Planos <span className="font-mono text-base text-tenue">({planos.length})</span>
            </h2>
            {planos.length === 0 ? (
              <p className="text-sm text-tenue">Este instrumental todavía no tiene planos cargados.</p>
            ) : (
              <ul className="space-y-1.5">
                {planos.map((x) => (
                  <FilaPlano
                    key={x.id}
                    p={x}
                    hrefVer={`/planos/${i.id}?p=${x.id}`}
                    activo={seleccionado?.id === x.id}
                  />
                ))}
              </ul>
            )}
            {planos.some((x) => !seVeEnNavegador(x.formato)) && (
              <p className="text-xs text-tenue">
                Los archivos DWG y STEP no se pueden ver en el navegador: bajalos y abrilos con{" "}
                {programaSugerido(planos.find((x) => !seVeEnNavegador(x.formato))!.formato)}.
              </p>
            )}
          </section>
        </div>

        <section className="card overflow-hidden" aria-label="Visor de planos">
          {seleccionado ? (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-borde p-3">
                <span className="font-semibold">{seleccionado.nombre}</span>
                <span className="font-mono text-xs text-tenue">{etiquetaFormato(seleccionado.formato)}</span>
                <a href={`/planos/archivo/${seleccionado.id}`} target="_blank" rel="noopener" className="btn ml-auto px-3 text-sm">
                  Abrir en pestaña nueva ↗
                </a>
              </div>
              {/* En celulares el PDF incrustado no siempre se ve: se ofrece abrirlo aparte. */}
              <iframe
                key={seleccionado.id}
                src={`/planos/archivo/${seleccionado.id}`}
                title={`Plano ${seleccionado.nombre}`}
                className="hidden h-[78vh] w-full bg-white md:block"
              />
              <p className="p-4 text-sm text-tenue md:hidden">
                En el celular, tocá «Abrir en pestaña nueva» para ver el plano en pantalla completa.
              </p>
            </>
          ) : (
            <p className="p-6 text-sm text-tenue">
              {planos.length === 0
                ? "Sin planos para mostrar."
                : "No hay planos en PDF para ver acá. Bajá los archivos con el botón «↓ Bajar»."}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
