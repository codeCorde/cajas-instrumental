"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { CajaParaPedir } from "@/lib/pedidos";
import MarcaInstrumentARG from "@/components/MarcaInstrumentARG";
import FirmaPad from "@/components/FirmaPad";
import { crearPedidoQR } from "./acciones";

type Etapa = "intro" | "cajas" | "caja" | "resumen" | "datos" | "listo";
/** Una línea del pedido: una pieza (o un set entero), o una medida suelta de un set personalizado. */
type Linea = { cajaId: string; instId: string; compId: string | null; cantidad: number };
type Carrito = Record<string, Linea>;
type Pieza = CajaParaPedir["piezas"][number];

const CLAVE_CARRITO = "pedido-instrumentarg-v2";
const DURACION_INTRO = 5000;
const clave = (cajaId: string, instId: string, compId: string | null) => `${cajaId}:${instId}:${compId ?? ""}`;
const limitar = (n: number) => Math.max(0, Math.min(9999, Math.trunc(n) || 0));

function leerCarrito(): Carrito {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_CARRITO) ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}
function guardarCarrito(c: Carrito) {
  try {
    localStorage.setItem(CLAVE_CARRITO, JSON.stringify(c));
  } catch {
    /* sin almacenamiento: el pedido vive solo en esta pestaña */
  }
}

/** Lo elegido en una caja: cantidad por pieza y, para los sets, las medidas que se sacan. */
type Eleccion = { cant: Record<string, number>; sacar: Record<string, string[]> };

/** Pasa lo elegido a líneas: set entero si no se sacó ninguna medida; si se sacaron, una línea por cada medida que queda. */
function lineasDe(caja: CajaParaPedir, e: Eleccion): Linea[] {
  const out: Linea[] = [];
  for (const p of caja.piezas) {
    const n = e.cant[p.id] ?? 0;
    if (n <= 0) continue;
    const sacadas = e.sacar[p.id] ?? [];
    if (p.medidas.length === 0 || sacadas.length === 0) out.push({ cajaId: caja.id, instId: p.id, compId: null, cantidad: n });
    else for (const m of p.medidas) if (!sacadas.includes(m.id)) out.push({ cajaId: caja.id, instId: p.id, compId: m.id, cantidad: n });
  }
  return out;
}

export default function PedirApp({ cajas, claveQR }: { cajas: CajaParaPedir[]; claveQR: string | null }) {
  const [etapa, setEtapa] = useState<Etapa>("intro");
  const [cajaId, setCajaId] = useState<string | null>(null);
  const [carrito, setCarrito] = useState<Carrito>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ numero: string; token: string } | null>(null);

  useEffect(() => {
    setCarrito(leerCarrito());
  }, []);
  useEffect(() => {
    if (etapa !== "intro") return;
    const t = setTimeout(() => setEtapa("cajas"), DURACION_INTRO);
    return () => clearTimeout(t);
  }, [etapa]);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 3500);
    return () => clearTimeout(t);
  }, [aviso]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [etapa, cajaId]);

  const cambiarCarrito = (c: Carrito) => {
    setCarrito(c);
    guardarCarrito(c);
  };
  const lineas = Object.values(carrito).filter((l) => l.cantidad > 0);
  const totalPiezas = lineas.reduce((s, l) => s + l.cantidad, 0);
  const caja = cajas.find((c) => c.id === cajaId) ?? null;

  function sumarAlCarrito(nuevas: Linea[]): number {
    const nuevo = { ...carrito };
    let agregadas = 0;
    for (const l of nuevas) {
      const k = clave(l.cajaId, l.instId, l.compId);
      nuevo[k] = { ...l, cantidad: (nuevo[k]?.cantidad ?? 0) + l.cantidad };
      agregadas += l.cantidad;
    }
    cambiarCarrito(nuevo);
    return agregadas;
  }

  if (etapa === "intro") return <Intro onSeguir={() => setEtapa("cajas")} />;

  return (
    <div className="min-h-dvh pb-32">
      <header className="sticky top-0 z-30 bg-superficie border-b border-borde">
        <div className="mx-auto max-w-xl px-4 h-14 flex items-center gap-3">
          {etapa !== "cajas" && etapa !== "listo" ? (
            <button type="button" className="btn px-3" onClick={() => setEtapa(etapa === "datos" ? "resumen" : "cajas")}>
              ← Atrás
            </button>
          ) : (
            <span className="w-2" />
          )}
          <MarcaInstrumentARG tam="chica" />
          {totalPiezas > 0 && etapa !== "listo" && (
            <button type="button" className="ml-auto btn px-3 text-sm" onClick={() => setEtapa("resumen")} aria-label={`Ver el pedido: ${totalPiezas} piezas`}>
              🧾 {totalPiezas}
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-5 space-y-5">
        {etapa === "cajas" && (
          <ElegirCaja
            cajas={cajas}
            onElegir={(id) => {
              setCajaId(id);
              setEtapa("caja");
            }}
          />
        )}
        {etapa === "caja" && caja && (
          <PiezasDeCaja
            caja={caja}
            numero={cajas.indexOf(caja) + 1}
            carrito={carrito}
            onAgregar={(e) => {
              const n = sumarAlCarrito(lineasDe(caja, e));
              setAviso(n > 0 ? `✓ Agregaste ${n} ${n === 1 ? "pieza" : "piezas"} al pedido` : "Elegí al menos una pieza (cantidad mayor a 0).");
              if (n > 0) setEtapa("cajas");
            }}
            onFinalizar={(e) => {
              sumarAlCarrito(lineasDe(caja, e));
              setEtapa("resumen");
            }}
          />
        )}
        {etapa === "resumen" && <Resumen cajas={cajas} carrito={carrito} onCambiar={cambiarCarrito} onSeguir={() => setEtapa("cajas")} onCompleto={() => setEtapa("datos")} />}
        {etapa === "datos" && (
          <Datos
            lineas={lineas}
            claveQR={claveQR}
            onListo={(r) => {
              setResultado(r);
              cambiarCarrito({});
              setEtapa("listo");
            }}
          />
        )}
        {etapa === "listo" && resultado && (
          <Listo
            resultado={resultado}
            onOtro={() => {
              setResultado(null);
              setEtapa("cajas");
            }}
          />
        )}
      </main>

      {aviso && (
        <div role="status" className="fixed inset-x-0 bottom-28 z-40 flex justify-center px-4">
          <p className="card px-4 py-3 shadow-lg font-semibold">{aviso}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Intro({ onSeguir }: { onSeguir: () => void }) {
  return (
    <button type="button" onClick={onSeguir} className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white text-black px-4 cursor-pointer" aria-label="InstrumentARG. Tocá para empezar">
      <span className="intro-marca">
        <MarcaInstrumentARG />
      </span>
      <span className="text-sm text-neutral-600">Instrumental quirúrgico</span>
      <span className="absolute bottom-8 text-sm text-neutral-500 underline">Tocá para empezar</span>
      <style>{`
        .intro-marca { animation: introEntra 1.2s ease-out both; }
        @keyframes introEntra { from { opacity: 0; transform: scale(.92); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .intro-marca { animation: none; } }
      `}</style>
    </button>
  );
}

function ElegirCaja({ cajas, onElegir }: { cajas: CajaParaPedir[]; onElegir: (id: string) => void }) {
  return (
    <section className="space-y-4">
      <h1 className="titulo text-3xl">Seleccioná la caja de cirugía</h1>
      {cajas.length === 0 && <p className="card p-5 text-tenue">Todavía no hay cajas cargadas.</p>}
      <ul className="space-y-3">
        {cajas.map((c, i) => (
          <li key={c.id}>
            <button type="button" onClick={() => onElegir(c.id)} className="card w-full p-4 flex items-center gap-4 text-left hover:border-acento min-h-24">
              <span className="font-mono text-2xl font-semibold text-acento w-8 shrink-0">{i + 1}</span>
              {c.fotoId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/pedir/foto/${c.fotoId}`} alt="" className="w-20 h-20 object-cover rounded border border-borde shrink-0" />
              ) : null}
              <span className="min-w-0">
                <span className="block titulo text-2xl">{c.nombre}</span>
                <span className="block text-sm text-tenue">
                  {c.piezas.length} {c.piezas.length === 1 ? "pieza" : "piezas"}
                  {c.descripcion ? ` · ${c.descripcion}` : ""}
                </span>
              </span>
              <span aria-hidden="true" className="ml-auto text-2xl text-tenue">
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const TIPO_TEXTO: Record<string, string> = { simple: "Pieza simple", medidas: "Set completo", complejo: "Pieza compleja" };

function PiezasDeCaja({
  caja,
  numero,
  carrito,
  onAgregar,
  onFinalizar,
}: {
  caja: CajaParaPedir;
  numero: number;
  carrito: Carrito;
  onAgregar: (e: Eleccion) => void;
  onFinalizar: (e: Eleccion) => void;
}) {
  const [cant, setCant] = useState<Record<string, number>>({});
  const [sacar, setSacar] = useState<Record<string, string[]>>({});
  const [abierto, setAbierto] = useState<string | null>(null);
  const elegidas = Object.values(cant).reduce((s, n) => s + n, 0);
  const enCarrito = Object.values(carrito).some((l) => l.cantidad > 0);
  const poner = (id: string, n: number) => setCant((c) => ({ ...c, [id]: limitar(n) }));
  const sumar = (id: string, d: number) => setCant((c) => ({ ...c, [id]: limitar((c[id] ?? 0) + d) }));
  const alternarMedida = (p: Pieza, medidaId: string) =>
    setSacar((s) => {
      const actual = s[p.id] ?? [];
      const nuevo = actual.includes(medidaId) ? actual.filter((x) => x !== medidaId) : [...actual, medidaId];
      if (nuevo.length >= p.medidas.length) return s; // al menos una medida tiene que quedar
      return { ...s, [p.id]: nuevo };
    });
  const eleccion: Eleccion = { cant, sacar };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        {caja.fotoId && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/pedir/foto/${caja.fotoId}`} alt={`Foto de ${caja.nombre}`} className="w-24 h-24 object-cover rounded border border-borde" />
        )}
        <div>
          <p className="font-mono text-xs text-tenue">Caja {numero}</p>
          <h1 className="titulo text-3xl">{caja.nombre}</h1>
        </div>
      </div>
      {caja.piezas.length === 0 && <p className="card p-5 text-tenue">Esta caja todavía no tiene piezas cargadas.</p>}
      <ul className="space-y-2">
        {caja.piezas.map((p, i) => {
          const ya = Object.values(carrito)
            .filter((l) => l.cajaId === caja.id && l.instId === p.id)
            .reduce((s, l) => s + l.cantidad, 0);
          const n = cant[p.id] ?? 0;
          const sacadas = sacar[p.id] ?? [];
          return (
            <li key={p.id} className={`card p-3 space-y-2 ${n > 0 ? "border-acento" : ""}`}>
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight">
                    <span className="font-mono text-tenue mr-1">
                      {numero}.{i + 1}
                    </span>
                    {p.nombre}
                  </p>
                  <p className="text-xs text-tenue">
                    {TIPO_TEXTO[p.tipo] ?? p.tipo}
                    {p.medidas.length > 0 && (sacadas.length ? ` · ${p.medidas.length - sacadas.length} de ${p.medidas.length} medidas` : ` · ${p.medidas.length} medidas`)}
                    {p.alias ? ` · ${p.alias}` : ""}
                  </p>
                  {ya > 0 && <p className="text-xs font-semibold text-disponible">✓ Ya tenés {ya} en el pedido</p>}
                </div>
                <div className="flex flex-col items-center gap-1" role="group" aria-label={`Cantidad de ${p.nombre}`}>
                  <button type="button" className="btn w-14 h-11 px-0 text-xl" onClick={() => sumar(p.id, 1)} aria-label={`Sumar 1 a ${p.nombre}`}>
                    ▲
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={n}
                    onChange={(e) => poner(p.id, Number(e.target.value))}
                    onFocus={(e) => e.target.select()}
                    className="campo w-14 text-center font-mono text-lg px-1 min-h-11"
                    aria-label={`Cantidad de ${p.nombre}`}
                  />
                  <button type="button" className="btn w-14 h-11 px-0 text-xl" onClick={() => sumar(p.id, -1)} disabled={n <= 0} aria-label={`Restar 1 a ${p.nombre}`}>
                    ▼
                  </button>
                </div>
              </div>
              {p.medidas.length > 1 && (
                <div>
                  <button type="button" className="text-sm underline text-acento" aria-expanded={abierto === p.id} onClick={() => setAbierto(abierto === p.id ? null : p.id)}>
                    {abierto === p.id ? "Listo, cerrar" : "Personalizar el set (sacar medidas)"}
                  </button>
                  {abierto === p.id && (
                    <fieldset className="mt-2 grid grid-cols-3 gap-2">
                      <legend className="sr-only">Medidas de {p.nombre}</legend>
                      {p.medidas.map((m) => {
                        const va = !sacadas.includes(m.id);
                        return (
                          <label key={m.id} className={`btn min-h-11 px-2 text-sm font-mono ${va ? "border-acento" : "line-through opacity-60"}`}>
                            <input type="checkbox" className="sr-only" checked={va} onChange={() => alternarMedida(p, m.id)} />
                            <span aria-hidden="true">{va ? "✓" : "✕"}</span> {m.nombre}
                          </label>
                        );
                      })}
                    </fieldset>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-borde bg-superficie">
        <div className="mx-auto max-w-xl px-4 py-3 grid grid-cols-2 gap-2">
          <button type="button" className="btn min-h-14 text-base" onClick={() => onAgregar(eleccion)} disabled={elegidas === 0}>
            + Agregar al pedido
          </button>
          <button type="button" className="btn btn-primario min-h-14 text-base" onClick={() => onFinalizar(eleccion)} disabled={elegidas === 0 && !enCarrito}>
            Finalizar pedido →
          </button>
        </div>
      </div>
    </section>
  );
}

function Resumen({
  cajas,
  carrito,
  onCambiar,
  onSeguir,
  onCompleto,
}: {
  cajas: CajaParaPedir[];
  carrito: Carrito;
  onCambiar: (c: Carrito) => void;
  onSeguir: () => void;
  onCompleto: () => void;
}) {
  const grupos = useMemo(
    () =>
      cajas
        .map((c) => ({
          caja: c,
          lineas: Object.entries(carrito)
            .filter(([, l]) => l.cajaId === c.id && l.cantidad > 0)
            .map(([k, l]) => {
              const p = c.piezas.find((x) => x.id === l.instId);
              const medida = l.compId ? p?.medidas.find((m) => m.id === l.compId)?.nombre : null;
              return { k, l, nombre: `${p?.nombre ?? "Pieza"}${medida ? ` ${medida}` : p?.medidas.length ? " (set completo)" : ""}` };
            }),
        }))
        .filter((g) => g.lineas.length > 0),
    [cajas, carrito],
  );
  const poner = (k: string, n: number) => {
    const nuevo = { ...carrito };
    if (n <= 0) delete nuevo[k];
    else nuevo[k] = { ...nuevo[k], cantidad: Math.min(9999, n) };
    onCambiar(nuevo);
  };
  const vacio = grupos.length === 0;

  return (
    <section className="space-y-4">
      <h1 className="titulo text-3xl">Tu pedido</h1>
      {vacio && <p className="card p-5 text-tenue">Todavía no agregaste piezas.</p>}
      {grupos.map(({ caja, lineas }) => (
        <div key={caja.id} className="card p-4 space-y-2">
          <h2 className="titulo text-xl">{caja.nombre}</h2>
          <ul className="divide-y divide-borde">
            {lineas.map(({ k, l, nombre }) => (
              <li key={k} className="py-2 flex items-center gap-2">
                <span className="flex-1 min-w-0">{nombre}</span>
                <button type="button" className="btn w-11 px-0" onClick={() => poner(k, l.cantidad - 1)} aria-label={`Restar 1 a ${nombre}`}>
                  −
                </button>
                <span className="font-mono text-lg w-10 text-center">{l.cantidad}</span>
                <button type="button" className="btn w-11 px-0" onClick={() => poner(k, l.cantidad + 1)} aria-label={`Sumar 1 a ${nombre}`}>
                  +
                </button>
                <button type="button" className="btn w-11 px-0 btn-peligro" onClick={() => poner(k, 0)} aria-label={`Quitar ${nombre}`}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-borde bg-superficie">
        <div className="mx-auto max-w-xl px-4 py-3 grid grid-cols-2 gap-2">
          <button type="button" className="btn min-h-14 text-base" onClick={onSeguir}>
            + Agregar de otra caja
          </button>
          <button type="button" className="btn btn-primario min-h-14 text-base" onClick={onCompleto} disabled={vacio}>
            Pedido completo →
          </button>
        </div>
      </div>
    </section>
  );
}

function Datos({ lineas, claveQR, onListo }: { lineas: Linea[]; claveQR: string | null; onListo: (r: { numero: string; token: string }) => void }) {
  const [nombre, setNombre] = useState("");
  const [firma, setFirma] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const hoy = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return setError("Poné tu nombre.");
    if (!firma) return setError("Falta tu firma.");
    setError(null);
    iniciar(async () => {
      const r = await crearPedidoQR({
        clave: claveQR,
        nombre,
        firma,
        items: lineas.map((l) => ({ instrumental_id: l.instId, caja_id: l.cajaId, componente_id: l.compId, cantidad: l.cantidad })),
      });
      if (r.ok) onListo({ numero: r.numero, token: r.token });
      else setError(r.error);
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <h1 className="titulo text-3xl">Pedido completo</h1>
      <div className="card p-4 space-y-4">
        <label className="block">
          <span className="etiqueta">Nombre</span>
          <input className="campo text-lg" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" maxLength={80} required />
        </label>
        <div>
          <span className="etiqueta">Fecha</span>
          <p className="font-mono text-lg">{hoy}</p>
        </div>
        <FirmaPad onCambio={setFirma} />
      </div>
      {error && (
        <p role="alert" className="card border-falta bg-falta-bg text-falta p-3 font-semibold">
          ✕ {error}
        </p>
      )}
      <button className="btn btn-primario w-full min-h-14 text-lg" disabled={pendiente}>
        {pendiente ? "Enviando…" : "Realizar orden de trabajo"}
      </button>
    </form>
  );
}

function Listo({ resultado, onOtro }: { resultado: { numero: string; token: string }; onOtro: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/pedir/seguimiento/${resultado.token}` : "";
  return (
    <section className="space-y-4 text-center">
      <p className="text-6xl text-disponible" aria-hidden="true">
        ✓
      </p>
      <h1 className="titulo text-3xl">¡Pedido enviado!</h1>
      <p>
        Tu número de pedido es <strong className="font-mono text-xl">{resultado.numero}</strong>.
      </p>
      <div className="card p-4 space-y-3 text-left">
        <p className="text-sm">Guardá este link para ver cómo va tu pedido o cancelarlo si te arrepentís:</p>
        <a href={link} className="block font-mono text-xs break-all underline">
          {link}
        </a>
        <button
          type="button"
          className="btn w-full"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopiado(true);
            } catch {
              setCopiado(false);
            }
          }}
        >
          {copiado ? "✓ Link copiado" : "Copiar link"}
        </button>
      </div>
      <button type="button" className="btn w-full min-h-12" onClick={onOtro}>
        Hacer otro pedido
      </button>
    </section>
  );
}
