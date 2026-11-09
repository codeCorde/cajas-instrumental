"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { evaluarInstrumental, resumenCaja, ESTADO_CAJA_INFO, type Estado } from "@/lib/calculos";
import { useCaja } from "@/lib/useCaja";
import { TIPO_LABEL, type CajaCompleta, type Instrumental } from "@/lib/tipos";
import { EstadoChip, EstadoDot, EtiquetaEjemplo, MedidorCaja } from "@/components/Estado";
import CargaInstrumental from "@/components/CargaInstrumental";
import CajasArmadas from "@/components/CajasArmadas";
import AvisoFlotante from "@/components/AvisoFlotante";

interface Pestaña {
  id: string;
  numero: number;
  nombre: string;
  estado: Estado;
}

export default function DetalleCaja({
  inicial,
  pestañas,
  esAdmin,
  seleccionInicial,
}: {
  inicial: CajaCompleta;
  pestañas: Pestaña[];
  esAdmin: boolean;
  seleccionInicial: string | null;
}) {
  const { caja, ajustar, armar, entregar, aviso, setAviso } = useCaja(inicial);
  const [sel, setSel] = useState<string | null>(seleccionInicial);
  const panelRef = useRef<HTMLDivElement>(null);
  const r = resumenCaja(caja.instrumentales);
  const elegido = caja.instrumentales.find((i) => i.id === sel) ?? null;

  useEffect(() => {
    if (sel && window.matchMedia("(max-width: 1023px)").matches) panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [sel]);

  return (
    <div className="space-y-5">
      {/* Pestañas de cajas */}
      <nav aria-label="Cajas" className="overflow-x-auto -mx-4 px-4">
        <ul className="flex gap-1 border-b border-borde whitespace-nowrap">
          {pestañas.map((p) => (
            <li key={p.id}>
              <Link
                href={`/cajas/${p.id}`}
                aria-current={p.id === caja.id ? "page" : undefined}
                className={`inline-flex items-center gap-2 h-11 px-3 text-sm font-semibold border-b-2 -mb-px ${
                  p.id === caja.id ? "border-acento text-texto" : "border-transparent text-tenue hover:text-texto"
                }`}
              >
                <EstadoDot estado={p.estado} />
                <span className="font-mono">{p.numero}</span> {p.nombre}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Encabezado */}
      <header className="card p-4 flex flex-col sm:flex-row gap-4">
        <div className="w-full sm:w-36 h-28 shrink-0 rounded bg-superficie-2 grid place-items-center overflow-hidden">
          {caja.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={caja.foto_url} alt={`Foto de ${caja.nombre}`} className="w-full h-full object-cover" />
          ) : (
            <span className="font-mono text-5xl font-semibold text-tenue">{caja.numero}</span>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-tenue">CAJA {caja.numero}</span>
            <EstadoChip estado={ESTADO_CAJA_INFO[r.estado].estado} label={ESTADO_CAJA_INFO[r.estado].label} chico />
            {caja.ejemplo && <EtiquetaEjemplo />}
            {esAdmin && (
              <Link href={`/admin/cajas/${caja.id}`} className="ml-auto text-sm text-acento hover:underline">
                Editar caja
              </Link>
            )}
          </div>
          <h1 className="titulo text-4xl">{caja.nombre}</h1>
          <MedidorCaja estados={caja.instrumentales.map((i) => ({ codigo: i.codigo, estado: evaluarInstrumental(i).estado }))} />
          <p className="font-mono text-sm">
            <strong>{r.disponibles}</strong>/{r.total} disponibles · <strong>{r.cajasCompletas}</strong> cajas completas
            {r.enProceso ? ` · ${r.enProceso} en proceso` : ""}
            {r.faltan ? ` · ${r.faltan} faltan` : ""}
            {r.sinPartes ? ` · ${r.sinPartes} sin partes` : ""}
          </p>
        </div>
      </header>

      <CajasArmadas caja={caja} armar={armar} entregar={entregar} />

      <div className="grid gap-5 lg:grid-cols-[1fr_420px] items-start">
        {/* Grilla de instrumentales */}
        <section aria-label="Instrumentales">
          {caja.instrumentales.length === 0 ? (
            <p className="card p-6 text-tenue">
              Esta caja no tiene instrumentales.{" "}
              {esAdmin && (
                <Link href={`/admin/cajas/${caja.id}`} className="text-acento underline">
                  Agregalos desde Administración
                </Link>
              )}
            </p>
          ) : (
            <ul className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
              {caja.instrumentales.map((i) => (
                <li key={i.id}>
                  <TarjetaInstrumental i={i} activo={i.id === sel} onClick={() => setSel(i.id === sel ? null : i.id)} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Panel de detalle */}
        <div ref={panelRef} className="lg:sticky lg:top-20 scroll-mt-20">
          {elegido ? (
            <PanelInstrumental i={elegido} ajustar={ajustar} esAdmin={esAdmin} cerrar={() => setSel(null)} />
          ) : (
            <p className="card p-6 text-sm text-tenue hidden lg:block">Elegí un instrumental para ver su detalle y cargar stock.</p>
          )}
        </div>
      </div>

      <AvisoFlotante aviso={aviso} cerrar={() => setAviso(null)} />
    </div>
  );
}

function TarjetaInstrumental({ i, activo, onClick }: { i: Instrumental; activo: boolean; onClick: () => void }) {
  const ev = evaluarInstrumental(i);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`card w-full h-full text-left p-3 flex flex-col gap-2 hover:border-acento ${activo ? "border-acento ring-2 ring-acento" : ""}`}
    >
      <div className="aspect-[4/3] rounded bg-superficie-2 grid place-items-center overflow-hidden">
        {i.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={i.foto_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="font-mono text-3xl font-semibold text-tenue">{i.codigo}</span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-xs text-tenue">{i.codigo}</span>
        <span className="font-semibold leading-tight">{i.nombre}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        <EstadoChip estado={ev.estado} chico />
        {i.origen === "tercerizado" && (
          <span className="rounded bg-superficie-2 px-1.5 py-0.5 text-[11px] font-semibold text-tenue">Tercerizado</span>
        )}
        {i.ejemplo && <EtiquetaEjemplo />}
      </div>
      {ev.faltaTexto && <p className="text-xs text-tenue leading-snug">{ev.faltaTexto}</p>}
      {ev.estado === "disponible" && (
        <p className="text-xs text-tenue">
          Alcanza para {ev.cajasQueAlcanza} caja{ev.cajasQueAlcanza === 1 ? "" : "s"}
        </p>
      )}
    </button>
  );
}

const LINKS = [
  { campo: "link_2d", label: "Planos 2D" },
  { campo: "link_3d", label: "Planos 3D" },
  { campo: "link_cnc", label: "Programa CNC" },
  { campo: "link_fotos", label: "Fotos" },
] as const;

function PanelInstrumental({
  i,
  ajustar,
  esAdmin,
  cerrar,
}: {
  i: Instrumental;
  ajustar: Parameters<typeof CargaInstrumental>[0]["ajustar"];
  esAdmin: boolean;
  cerrar: () => void;
}) {
  const ev = evaluarInstrumental(i);
  const datos: [string, string | number | null][] = [
    ["Tipo", TIPO_LABEL[i.tipo]],
    ["Cant. por caja", `${i.cant_por_caja}${i.tipo === "medidas" ? " juego(s)" : ""}`],
    ["Alias", i.alias],
    ["Material", i.material],
    ["Terminación", i.terminacion],
    ["Barra / MP", i.barra],
    ["Origen", i.origen === "tercerizado" ? `Tercerizado${i.proveedor ? ` · ${i.proveedor}` : ""}` : "Fabricación propia"],
  ];

  return (
    <article className="card p-4 space-y-4" aria-labelledby="panel-titulo">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-sm text-tenue">{i.codigo}</p>
          <h2 id="panel-titulo" className="titulo text-3xl">
            {i.nombre}
          </h2>
        </div>
        <button type="button" className="btn px-3" onClick={cerrar} aria-label="Cerrar detalle">
          ✕
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <EstadoChip estado={ev.estado} />
        <span className="font-mono text-sm">
          Stock completo {ev.stockCompleto} · alcanza {ev.cajasQueAlcanza} caja{ev.cajasQueAlcanza === 1 ? "" : "s"}
        </span>
      </div>
      {ev.faltaTexto && <p className="text-sm text-tenue">{ev.faltaTexto}</p>}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {datos
          .filter(([, v]) => v !== null && v !== "")
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-tenue">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
      </dl>

      <section className="border-t border-borde pt-2">
        <h3 className="etiqueta mt-2">Stock</h3>
        <CargaInstrumental i={i} ajustar={ajustar} />
      </section>

      <Link href={`/planos/${i.id}`} className="btn btn-primario w-full">
        Ver planos
      </Link>

      <section className="border-t border-borde pt-3">
        <h3 className="etiqueta">Archivos en Drive</h3>
        <div className="grid grid-cols-2 gap-2">
          {LINKS.map(({ campo, label }) =>
            i[campo] ? (
              <a key={campo} href={i[campo]!} target="_blank" rel="noopener noreferrer" className="btn text-sm">
                {label} ↗
              </a>
            ) : (
              <span key={campo} className="btn text-sm opacity-40 cursor-not-allowed" aria-disabled="true" title="Sin link cargado">
                {label}
              </span>
            ),
          )}
        </div>
      </section>

      <section className="border-t border-borde pt-3">
        <h3 className="etiqueta">Notas de fabricación</h3>
        {(i.notas ?? []).length === 0 ? (
          <p className="text-sm text-tenue">Sin notas.</p>
        ) : (
          <ul className="space-y-2">
            {[...(i.notas ?? [])]
              .sort((a, b) => b.creado_en.localeCompare(a.creado_en))
              .map((n) => (
                <li key={n.id} className="rounded bg-superficie-2 p-2 text-sm">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-tenue">{n.tipo}</span>
                  <p className="whitespace-pre-line">{n.texto}</p>
                </li>
              ))}
          </ul>
        )}
      </section>

      {esAdmin && (
        <Link href={`/admin/instrumentales/${i.id}`} className="btn w-full">
          Editar instrumental
        </Link>
      )}
    </article>
  );
}
