import Link from "next/link";
import { notFound } from "next/navigation";
import { db, sinError } from "@/lib/db";
import { archivosDe, cajaPorCodigo, cargarCatalogo, composicionDe, resumenDe } from "@/lib/datos";
import { quienSoy } from "@/lib/sesion-servidor";
import { estadoEnCaja, filasComponentes, nombreComponente, TIPO_LABEL } from "@/lib/calculos";
import { seVeEnLaWeb } from "@/lib/formato";
import type { Nota, TipoInstrumental } from "@/lib/tipos";
import { ProveedorAvisos } from "@/components/Aviso";
import ControlStock from "@/components/ControlStock";
import { EstadoChip } from "@/components/Estado";
import TextoFormato from "@/components/TextoFormato";

export const dynamic = "force-dynamic";

const GRUPOS: { tipo: TipoInstrumental; titulo: string }[] = [
  { tipo: "complejo", titulo: "Complejos" },
  { tipo: "medidas", titulo: "Medidas" },
  { tipo: "simple", titulo: "Simples" },
];
type Vista = "cargar" | "falta" | "procesos";

/** Vista del taller (se abre con el QR de la caja). Celular, una columna, botones grandes. No arma cajas ni edita estructura. */
export default async function TallerPage({ params, searchParams }: { params: Promise<{ codigo: string }>; searchParams: Promise<{ ver?: string }> }) {
  const [{ codigo }, { ver }] = await Promise.all([params, searchParams]);
  const vista: Vista = ver === "falta" || ver === "procesos" ? ver : "cargar";
  const nombre = await quienSoy();
  const caja = await cajaPorCodigo(decodeURIComponent(codigo));
  if (!caja) notFound();
  const cat = await cargarCatalogo();
  const comp = composicionDe(cat, caja.id);
  const r = resumenDe(cat, caja);

  return (
    <ProveedorAvisos>
      <div className="min-h-dvh pb-10">
        <header className="sticky top-0 z-30 bg-superficie border-b border-borde">
          <div className="mx-auto max-w-xl px-4 py-2 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs text-tenue">{caja.codigo} · Taller</p>
              <h1 className="titulo text-2xl truncate">{caja.nombre}</h1>
            </div>
            <Link href={`/ingresar/nombre?volver=/taller/${caja.codigo}`} className="text-right text-sm leading-tight">
              <span className="block text-xs text-tenue">Cargando como</span>
              <span className="font-semibold">{nombre}</span>
            </Link>
          </div>
          <nav className="mx-auto max-w-xl px-2 pb-2 grid grid-cols-3 gap-1" aria-label="Secciones">
            {(
              [
                ["cargar", "Cargar stock"],
                ["falta", "Qué falta"],
                ["procesos", "Procesos"],
              ] as const
            ).map(([v, t]) => (
              <Link
                key={v}
                href={v === "cargar" ? `/taller/${caja.codigo}` : `/taller/${caja.codigo}?ver=${v}`}
                aria-current={vista === v ? "page" : undefined}
                className={`btn min-h-12 text-base ${vista === v ? "btn-primario" : ""}`}
              >
                {t}
              </Link>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-xl px-4 py-4 space-y-6">
          {comp.length === 0 && <p className="card p-5 text-tenue">Esta caja todavía no tiene instrumental cargado.</p>}
          {vista === "cargar" && <Cargar caja={caja.id} comp={comp} />}
          {vista === "falta" && <QueFalta r={r} armadas={caja.cajas_armadas} />}
          {vista === "procesos" && <Procesos comp={comp} />}
          <p className="text-center text-xs text-tenue pt-4">
            <Link href={`/cajas/${caja.codigo}`} className="underline">
              Ver la caja completa
            </Link>
          </p>
        </main>
      </div>
    </ProveedorAvisos>
  );
}

type Comp = ReturnType<typeof composicionDe>;

function Cargar({ caja, comp }: { caja: string; comp: Comp }) {
  return (
    <>
      {GRUPOS.map((g) => {
        const items = comp.filter((c) => c.inst.tipo === g.tipo);
        if (items.length === 0) return null;
        return (
          <section key={g.tipo} className="space-y-3">
            <h2 className="titulo text-xl text-tenue">{g.titulo}</h2>
            {items.map(({ inst, cantPorCaja }) => {
              const est = estadoEnCaja(inst, cantPorCaja);
              const comps = inst.componentes.filter((c) => c.clase === (inst.tipo === "medidas" ? "medida" : "pieza"));
              return (
                <article key={inst.id} className="card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-lg leading-tight">{inst.nombre}</h3>
                      <p className="font-mono text-xs text-tenue">
                        {inst.codigo} · {cantPorCaja} por caja
                      </p>
                    </div>
                    <EstadoChip estado={est.estado} chico />
                  </div>
                  {inst.tipo === "simple" && (
                    <Fila etiqueta="Terminados">
                      <ControlStock objetivo="stock_terminado" id={inst.id} valor={inst.stock_terminado} etiqueta={`Terminados de ${inst.nombre}`} cajaId={caja} grande />
                    </Fila>
                  )}
                  {inst.tipo === "complejo" && (
                    <Fila etiqueta="Armados">
                      <ControlStock objetivo="unidades_armadas" id={inst.id} valor={inst.unidades_armadas} etiqueta={`Armados de ${inst.nombre}`} cajaId={caja} grande />
                    </Fila>
                  )}
                  {comps.map((c) => (
                    <Fila key={c.id} etiqueta={nombreComponente(c)} mono>
                      <ControlStock objetivo="stock" id={c.id} valor={c.stock} etiqueta={`${inst.nombre} ${nombreComponente(c)}`} cajaId={caja} grande />
                    </Fila>
                  ))}
                  {inst.tipo !== "simple" && comps.length === 0 && <p className="text-sm text-tenue">Sin {inst.tipo === "medidas" ? "medidas" : "piezas"} cargadas todavía.</p>}
                </article>
              );
            })}
          </section>
        );
      })}
    </>
  );
}

function Fila({ etiqueta, children, mono }: { etiqueta: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-borde pt-3">
      <span className={`text-base ${mono ? "font-mono" : ""}`}>{etiqueta}</span>
      {children}
    </div>
  );
}

function QueFalta({ r, armadas }: { r: ReturnType<typeof resumenDe>; armadas: number }) {
  const pendientes = r.filas.filter((f) => f.alcanza < 1);
  return (
    <section className="space-y-3">
      <div className="card p-4 flex justify-around text-center">
        <div>
          <p className="font-mono text-3xl font-semibold">{armadas}</p>
          <p className="text-xs text-tenue uppercase">Armadas</p>
        </div>
        <div>
          <p className={`font-mono text-3xl font-semibold ${r.posibles > 0 ? "text-disponible" : "text-falta"}`}>{r.posibles}</p>
          <p className="text-xs text-tenue uppercase">Se pueden armar</p>
        </div>
      </div>
      <h2 className="titulo text-xl">Para la próxima caja falta</h2>
      {pendientes.length === 0 ? (
        <p className="card p-4 text-disponible font-semibold">✓ Está todo para armar una caja más.</p>
      ) : (
        <ul className="space-y-2">
          {pendientes.map((f) => (
            <li key={f.inst.id} className="card p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{f.inst.nombre}</span>
                <EstadoChip estado={f.estado} chico />
              </div>
              <p className="text-sm text-tenue">{f.falta}</p>
              {f.inst.tipo !== "simple" && (
                <p className="text-xs font-mono">
                  {filasComponentes(f.inst)
                    .filter((s) => s.estado === "fabricar")
                    .map((s) => `${nombreComponente(s.componente)}: faltan ${s.faltanProximo}`)
                    .join(" · ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function Procesos({ comp }: { comp: Comp }) {
  const ids = comp.map((c) => c.inst.id);
  const compIds = comp.flatMap((c) => c.inst.componentes.map((x) => x.id));
  const [archivos, archivosComp, notas] = await Promise.all([
    archivosDe("instrumental", ids),
    archivosDe("componente", compIds),
    ids.length ? db().from("notas").select("*").in("instrumental_id", ids).order("creado_en", { ascending: false }).then((r) => sinError(r) as Nota[]) : Promise.resolve([] as Nota[]),
  ]);
  return (
    <section className="space-y-3">
      {comp.map(({ inst }) => {
        const pdfs = archivos.filter((a) => a.entidad_id === inst.id && a.vigente && seVeEnLaWeb(a.tipo));
        const ns = notas.filter((n) => n.instrumental_id === inst.id);
        return (
          <details key={inst.id} className="card p-4">
            <summary className="cursor-pointer font-semibold text-lg min-h-8">
              {inst.nombre} <span className="text-xs font-normal text-tenue">· {TIPO_LABEL[inst.tipo]}</span>
            </summary>
            <div className="mt-3 space-y-4">
              {inst.descripcion && <TextoFormato texto={inst.descripcion} />}
              <div>
                <h3 className="etiqueta">Procesos de trabajo</h3>
                <TextoFormato texto={inst.proceso} vacio="Sin procesos cargados." />
              </div>
              {inst.componentes
                .filter((c) => c.proceso)
                .map((c) => (
                  <div key={c.id}>
                    <h3 className="etiqueta">{nombreComponente(c)}</h3>
                    <TextoFormato texto={c.proceso} />
                  </div>
                ))}
              {ns.length > 0 && (
                <div>
                  <h3 className="etiqueta">Notas</h3>
                  <ul className="text-sm space-y-1">
                    {ns.map((n) => (
                      <li key={n.id}>
                        <span className="font-mono text-xs text-tenue">[{n.tipo}]</span> {n.texto}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid gap-2">
                {[...pdfs, ...archivosComp.filter((a) => inst.componentes.some((c) => c.id === a.entidad_id) && a.vigente && seVeEnLaWeb(a.tipo))].map((a) => (
                  <a key={a.id} href={`/archivos/${a.id}`} target="_blank" rel="noopener" className="btn min-h-12 justify-start">
                    📄 {a.nombre}
                  </a>
                ))}
              </div>
            </div>
          </details>
        );
      })}
    </section>
  );
}
