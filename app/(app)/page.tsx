import Link from "next/link";
import { listarCajasCompletas } from "@/lib/datos";
import { ESTADO_CAJA_INFO, evaluarInstrumental, resumenCaja } from "@/lib/calculos";
import { EstadoChip, EtiquetaEjemplo, MedidorCaja } from "@/components/Estado";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearFecha } from "@/lib/historial";

export const dynamic = "force-dynamic";

export default async function ResumenPage() {
  const supabase = await crearClienteServidor();
  const [cajas, { count: tareasPendientes }, { data: ultimas }] = await Promise.all([
    listarCajasCompletas(),
    supabase.from("tareas").select("id", { count: "exact", head: true }).eq("hecha", false),
    supabase.from("novedades").select("titulo, creado_en, autor_nombre").order("creado_en", { ascending: false }).limit(1),
  ]);
  const ultima = ultimas?.[0] as { titulo: string; creado_en: string; autor_nombre: string | null } | undefined;
  const filas = cajas.map((c) => ({
    caja: c,
    r: resumenCaja(c.instrumentales),
    estados: c.instrumentales.map((i) => ({ codigo: i.codigo, estado: evaluarInstrumental(i).estado })),
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-tenue">Resumen de producción</p>
          <h1 className="titulo text-4xl">Cajas</h1>
        </div>
        <Link href="/cargar" className="btn btn-primario">
          Cargar stock
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/tareas" className="card p-4 flex items-center gap-4 hover:border-acento">
          <span className={`font-mono text-3xl font-semibold ${tareasPendientes ? "text-proceso" : "text-disponible"}`}>
            {tareasPendientes ?? 0}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-semibold">Tareas de mejora pendientes</span>
            <span className="block text-xs text-tenue">
              {tareasPendientes ? "Aclaraciones de médicos sin corregir" : "✓ Todo corregido"}
            </span>
          </span>
          <span aria-hidden="true" className="text-xl text-tenue">›</span>
        </Link>
        <Link href="/novedades" className="card p-4 flex items-center gap-4 hover:border-acento">
          <span className="flex-1 min-w-0">
            <span className="block text-[11px] uppercase tracking-wider text-tenue">Última novedad</span>
            <span className="block font-semibold truncate">{ultima?.titulo ?? "Sin novedades todavía"}</span>
            {ultima && (
              <span className="block text-xs text-tenue">
                {ultima.autor_nombre ?? "—"} · {formatearFecha(ultima.creado_en)}
              </span>
            )}
          </span>
          <span aria-hidden="true" className="text-xl text-tenue">›</span>
        </Link>
      </div>

      {filas.length === 0 && <p className="card p-6 text-tenue">Todavía no hay cajas. El admin las crea desde Administración.</p>}

      {/* Celular: tarjetas */}
      <ul className="grid gap-3 md:hidden">
        {filas.map(({ caja, r, estados }) => (
          <li key={caja.id}>
            <Link href={`/cajas/${caja.id}`} className="card block p-4 space-y-3 hover:border-acento">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-tenue">CAJA {caja.numero}</p>
                  <p className="titulo text-2xl">{caja.nombre}</p>
                </div>
                {caja.ejemplo && <EtiquetaEjemplo />}
              </div>
              <MedidorCaja estados={estados} />
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Dato label="Se pueden armar" valor={r.cajasCompletas} fuerte />
                <Dato label="Armadas en stock" valor={caja.cajas_armadas} fuerte />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <EstadoChip chico estado={ESTADO_CAJA_INFO[r.estado].estado} label={ESTADO_CAJA_INFO[r.estado].label} />
                <span className="text-xs text-tenue self-center">
                  {r.total} instr. · {r.disponibles} disp. · {r.enProceso} en proceso · {r.faltan} faltan
                  {r.sinPartes ? ` · ${r.sinPartes} sin partes` : ""}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* PC: tabla */}
      {filas.length > 0 && (
        <div className="card hidden md:block overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>N°</th>
                <th>Caja</th>
                <th>Estado</th>
                <th className="text-right">Cajas completas que se pueden armar</th>
                <th className="text-right">Cajas armadas en stock</th>
                <th className="text-right">Instrumentales</th>
                <th className="text-right">Disponibles</th>
                <th className="text-right">En proceso</th>
                <th className="text-right">Faltan</th>
                <th className="text-right">Sin partes</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ caja, r, estados }) => (
                <tr key={caja.id} className="hover:bg-superficie-2">
                  <td className="font-mono">{caja.numero}</td>
                  <td>
                    <Link href={`/cajas/${caja.id}`} className="font-semibold hover:underline">
                      {caja.nombre}
                    </Link>{" "}
                    {caja.ejemplo && <EtiquetaEjemplo />}
                    <div className="mt-2 w-48">
                      <MedidorCaja estados={estados} />
                    </div>
                  </td>
                  <td>
                    <EstadoChip chico estado={ESTADO_CAJA_INFO[r.estado].estado} label={ESTADO_CAJA_INFO[r.estado].label} />
                  </td>
                  <td className="text-right font-mono text-2xl font-semibold">{r.cajasCompletas}</td>
                  <td className="text-right font-mono text-2xl font-semibold">{caja.cajas_armadas}</td>
                  <td className="text-right font-mono">{r.total}</td>
                  <td className="text-right font-mono text-disponible">{r.disponibles}</td>
                  <td className="text-right font-mono text-proceso">{r.enProceso}</td>
                  <td className="text-right font-mono text-falta">{r.faltan}</td>
                  <td className="text-right font-mono text-sin">{r.sinPartes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Dato({ label, valor, fuerte }: { label: string; valor: number; fuerte?: boolean }) {
  return (
    <div className="rounded bg-superficie-2 p-2">
      <p className="text-[11px] uppercase tracking-wider text-tenue">{label}</p>
      <p className={`font-mono ${fuerte ? "text-3xl font-semibold" : ""}`}>{valor}</p>
    </div>
  );
}
