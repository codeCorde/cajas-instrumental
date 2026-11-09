import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { listarPlanosCaja, obtenerCaja } from "@/lib/datos";
import AdminPlanos from "@/components/AdminPlanos";
import { evaluarInstrumental } from "@/lib/calculos";
import { TIPO_LABEL } from "@/lib/tipos";
import { EstadoChip, EtiquetaEjemplo } from "@/components/Estado";
import FormAccion from "@/components/FormAccion";
import { borrarCaja, crearInstrumental, guardarCaja, moverInstrumental } from "../../acciones";

export const dynamic = "force-dynamic";

export default async function AdminCajaPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdmin();
  const { id } = await params;
  const [caja, planosCaja] = await Promise.all([obtenerCaja(id), listarPlanosCaja(id)]);
  if (!caja) notFound();
  const n = caja.instrumentales.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin" className="btn px-3" aria-label="Volver a Administración">
          ‹
        </Link>
        <h1 className="titulo text-4xl">
          Caja {caja.numero} · {caja.nombre}
        </h1>
        {caja.ejemplo && <EtiquetaEjemplo />}
        <Link href={`/cajas/${caja.id}`} className="ml-auto text-sm text-acento hover:underline">
          Ver detalle
        </Link>
      </div>

      <section className="card p-4 space-y-3">
        <h2 className="titulo text-2xl">Datos de la caja</h2>
        <FormAccion accion={guardarCaja} className="flex flex-wrap gap-3 items-end">
          <input type="hidden" name="id" value={caja.id} />
          <label className="w-24">
            <span className="etiqueta">N°</span>
            <input name="numero" type="number" min={1} defaultValue={caja.numero} className="campo font-mono" required />
          </label>
          <label className="flex-1 min-w-48">
            <span className="etiqueta">Nombre</span>
            <input name="nombre" defaultValue={caja.nombre} className="campo" required />
          </label>
          <label className="flex-1 min-w-48">
            <span className="etiqueta">Foto (URL)</span>
            <input name="foto_url" defaultValue={caja.foto_url ?? ""} className="campo" placeholder="https://…" />
          </label>
          <label className="flex items-center gap-2 min-h-11">
            <input type="checkbox" name="activa" defaultChecked={caja.activa} className="w-5 h-5" /> Activa
          </label>
          <button className="btn btn-primario">Guardar</button>
        </FormAccion>
      </section>

      <section className="card overflow-x-auto">
        <div className="p-4 pb-0">
          <h2 className="titulo text-2xl">Instrumentales</h2>
        </div>
        <table className="tabla">
          <thead>
            <tr>
              <th>Orden</th>
              <th>Código</th>
              <th>Instrumental</th>
              <th>Tipo</th>
              <th className="text-right">Por caja</th>
              <th>Medidas/partes</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {n === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-tenue py-6">
                  Sin instrumentales todavía.
                </td>
              </tr>
            )}
            {caja.instrumentales.map((i, idx) => (
              <tr key={i.id}>
                <td>
                  <div className="flex gap-1">
                    <FormAccion accion={moverInstrumental}>
                      <input type="hidden" name="id" value={i.id} />
                      <input type="hidden" name="dir" value="arriba" />
                      <button className="btn px-0 w-11" disabled={idx === 0} aria-label={`Subir ${i.nombre}`}>
                        ↑
                      </button>
                    </FormAccion>
                    <FormAccion accion={moverInstrumental}>
                      <input type="hidden" name="id" value={i.id} />
                      <input type="hidden" name="dir" value="abajo" />
                      <button className="btn px-0 w-11" disabled={idx === n - 1} aria-label={`Bajar ${i.nombre}`}>
                        ↓
                      </button>
                    </FormAccion>
                  </div>
                </td>
                <td className="font-mono">{i.codigo}</td>
                <td className="font-semibold">
                  {i.nombre} {i.ejemplo && <EtiquetaEjemplo />}
                </td>
                <td>{TIPO_LABEL[i.tipo]}</td>
                <td className="text-right font-mono">{i.cant_por_caja}</td>
                <td className="font-mono">{i.tipo === "simple" ? "—" : i.partes.length}</td>
                <td>
                  <EstadoChip chico estado={evaluarInstrumental(i).estado} />
                </td>
                <td className="text-right">
                  <Link href={`/admin/instrumentales/${i.id}`} className="btn text-sm">
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="titulo text-2xl">Agregar instrumental</h2>
        <FormAccion accion={crearInstrumental} className="flex flex-wrap gap-3 items-end">
          <input type="hidden" name="caja_id" value={caja.id} />
          <label className="w-28">
            <span className="etiqueta">Código</span>
            <input name="codigo" className="campo font-mono" placeholder={`${caja.numero}.${n + 1}`} defaultValue={`${caja.numero}.${n + 1}`} required />
          </label>
          <label className="flex-1 min-w-48">
            <span className="etiqueta">Nombre</span>
            <input name="nombre" className="campo" required />
          </label>
          <label>
            <span className="etiqueta">Tipo</span>
            <select name="tipo" className="campo" defaultValue="simple">
              <option value="simple">Simple (una pieza)</option>
              <option value="medidas">Medidas (juego)</option>
              <option value="complejo">Complejo (se arma con partes)</option>
            </select>
          </label>
          <label className="w-28">
            <span className="etiqueta">Cant. por caja</span>
            <input name="cant_por_caja" type="number" min={1} defaultValue={1} className="campo font-mono" required />
          </label>
          <button className="btn btn-primario">Agregar</button>
        </FormAccion>
      </section>

      <AdminPlanos titulo="Planos de la caja" planos={planosCaja} cajaId={caja.id} cajaNumero={caja.numero} instrumentalId={null} />

      <section className="card p-4 border-falta space-y-2">
        <h2 className="titulo text-xl text-falta">Zona peligrosa</h2>
        <p className="text-sm text-tenue">
          Borrar la caja borra también sus instrumentales, medidas, partes y notas. El historial se conserva. Si solo querés
          ocultarla, desmarcá «Activa».
        </p>
        <FormAccion accion={borrarCaja} confirmar={`¿Borrar la caja «${caja.nombre}» y sus ${n} instrumentales? No se puede deshacer.`}>
          <input type="hidden" name="id" value={caja.id} />
          <button className="btn btn-peligro">Borrar caja</button>
        </FormAccion>
      </section>
    </div>
  );
}
