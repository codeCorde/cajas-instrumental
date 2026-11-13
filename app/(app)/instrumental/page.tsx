import Link from "next/link";
import { db } from "@/lib/db";
import { cargarCatalogo, usosDe } from "@/lib/datos";
import { estadoEnCaja, TIPO_LABEL } from "@/lib/calculos";
import { IMAGENES } from "@/lib/formato";
import type { TipoInstrumental } from "@/lib/tipos";
import { Compartido, EstadoChip, Etiqueta } from "@/components/Estado";
import FormAccion from "@/components/FormAccion";
import { crearInstrumental } from "./acciones";

const PESTANAS: { tipo: TipoInstrumental; label: string }[] = [
  { tipo: "complejo", label: "Complejos" },
  { tipo: "medidas", label: "Medidas" },
  { tipo: "simple", label: "Simples" },
];

export default async function InstrumentalPage({ searchParams }: { searchParams: Promise<{ tipo?: string; q?: string; caja?: string }> }) {
  const sp = await searchParams;
  const tipo: TipoInstrumental = sp.tipo === "medidas" || sp.tipo === "simple" ? sp.tipo : "complejo";
  const q = (sp.q ?? "").trim().toLowerCase();
  const cat = await cargarCatalogo();
  const [{ data: fotos }, { count: sinClasificar }] = await Promise.all([
    db().from("archivos").select("id, entidad_id, tipo").eq("entidad", "instrumental").eq("vigente", true).in("tipo", IMAGENES),
    db().from("sin_clasificar").select("id", { count: "exact", head: true }),
  ]);
  const fotoDe = new Map<string, string>();
  for (const f of fotos ?? []) if (!fotoDe.has(f.entidad_id)) fotoDe.set(f.entidad_id, f.id);

  const cuenta = (t: TipoInstrumental) => cat.instrumentales.filter((i) => i.tipo === t).length;
  const lista = cat.instrumentales.filter((i) => {
    if (i.tipo !== tipo) return false;
    if (sp.caja && !cat.composicion.some((c) => c.instrumental_id === i.id && c.caja_id === sp.caja)) return false;
    if (q && ![i.codigo, i.nombre, i.alias ?? "", i.proveedor ?? ""].some((t) => t.toLowerCase().includes(q))) return false;
    return true;
  });
  const enlace = (cambios: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const v = { tipo, q: sp.q, caja: sp.caja, ...cambios };
    for (const [k, x] of Object.entries(v)) if (x) p.set(k, x);
    return `/instrumental?${p}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-tenue">Catálogo único · stock compartido</p>
          <h1 className="titulo text-4xl">Instrumental</h1>
        </div>
        <Link href="/instrumental/sin-clasificar" className="btn">
          Bandeja «Sin clasificar» <span className="font-mono">({sinClasificar ?? 0})</span>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Tipo de instrumental" className="flex gap-1 rounded border border-borde bg-superficie p-1">
          {PESTANAS.map((p) => (
            <Link
              key={p.tipo}
              href={enlace({ tipo: p.tipo })}
              aria-current={tipo === p.tipo ? "page" : undefined}
              className={`px-3 h-10 inline-flex items-center rounded text-sm font-semibold ${tipo === p.tipo ? "bg-acento text-acento-texto" : "text-tenue hover:bg-superficie-2"}`}
            >
              {p.label} <span className="ml-1.5 font-mono text-xs opacity-80">{cuenta(p.tipo)}</span>
            </Link>
          ))}
        </nav>
        <form className="flex flex-wrap gap-2 flex-1 min-w-64" action="/instrumental">
          <input type="hidden" name="tipo" value={tipo} />
          <input name="q" defaultValue={sp.q} className="campo flex-1 min-w-40" placeholder="Buscar por código, nombre o proveedor" aria-label="Buscar" />
          <select name="caja" defaultValue={sp.caja ?? ""} className="campo w-auto" aria-label="Filtrar por caja">
            <option value="">Todas las cajas</option>
            {cat.cajas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <button className="btn">Filtrar</button>
        </form>
      </div>

      {lista.length === 0 ? (
        <p className="card p-6 text-tenue">No hay instrumentales {TIPO_LABEL[tipo].toLowerCase()}s con ese filtro.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((i) => {
            const usos = usosDe(cat, i.id);
            const est = estadoEnCaja(i, Math.max(1, ...usos.map((u) => u.cantPorCaja)));
            const foto = fotoDe.get(i.id);
            return (
              <li key={i.id}>
                <Link href={`/instrumental/${i.id}`} className="card p-3 flex gap-3 h-full hover:border-acento">
                  <div className="w-20 h-20 shrink-0 rounded bg-superficie-2 grid place-items-center overflow-hidden">
                    {foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/archivos/${foto}`} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <span aria-hidden="true" className="font-mono text-xs text-tenue">
                        {i.codigo}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="font-mono text-xs text-tenue">{i.codigo}</p>
                    <p className="font-semibold leading-tight">{i.nombre}</p>
                    {i.alias && <p className="text-xs text-tenue">{i.alias}</p>}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <EstadoChip estado={est.estado} chico />
                      {usos.length > 1 ? <Compartido cajas={usos.map((u) => u.caja.codigo)} /> : usos.map((u) => <Etiqueta key={u.caja.id}>{u.caja.codigo}</Etiqueta>)}
                      {usos.length === 0 && <Etiqueta tono="falta">En ninguna caja</Etiqueta>}
                      {i.origen === "tercerizado" && <Etiqueta tono="acento">Tercerizado</Etiqueta>}
                      {i.a_confirmar && <Etiqueta tono="proceso">A confirmar</Etiqueta>}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <details className="card p-4 max-w-2xl">
        <summary className="cursor-pointer font-semibold">+ Nuevo instrumental</summary>
        <FormAccion accion={crearInstrumental} className="mt-4 grid gap-3 sm:grid-cols-[7rem_1fr_9rem]" textoBoton="Crear y abrir la ficha">
          <label>
            <span className="etiqueta">Código</span>
            <input name="codigo" className="campo font-mono" required />
          </label>
          <label>
            <span className="etiqueta">Nombre</span>
            <input name="nombre" className="campo" required />
          </label>
          <label>
            <span className="etiqueta">Tipo</span>
            <select name="tipo" className="campo" defaultValue={tipo}>
              <option value="simple">Simple</option>
              <option value="medidas">Medidas</option>
              <option value="complejo">Complejo</option>
            </select>
          </label>
        </FormAccion>
      </details>
    </div>
  );
}
