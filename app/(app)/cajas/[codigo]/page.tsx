import Link from "next/link";
import { notFound } from "next/navigation";
import { cajaPorCodigo, cargarCatalogo, composicionDe, resumenDe, usosDe } from "@/lib/datos";
import { filasComponentes, nombreComponente, TIPO_LABEL } from "@/lib/calculos";
import { Cifra, EstadoChip, MedidorCaja } from "@/components/Estado";
import FormAccion from "@/components/FormAccion";
import TablaCaja, { type FilaTablaCaja } from "./TablaCaja";
import { agregarACaja, archivarCaja, editarCaja } from "../acciones";
import BotonAccion from "@/components/BotonAccion";

export default async function CajaPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const caja = await cajaPorCodigo(decodeURIComponent(codigo));
  if (!caja) notFound();
  const cat = await cargarCatalogo();
  const r = resumenDe(cat, caja);
  const enCaja = new Set(composicionDe(cat, caja.id).map((c) => c.inst.id));
  const disponibles = cat.instrumentales.filter((i) => !enCaja.has(i.id));

  const filas: FilaTablaCaja[] = r.filas.map((f, n) => ({
    n: n + 1,
    id: f.inst.id,
    codigo: f.inst.codigo,
    nombre: f.inst.nombre,
    alias: f.inst.alias,
    tipo: f.inst.tipo,
    cantPorCaja: f.cantPorCaja,
    completo: f.completo,
    alcanza: f.alcanza,
    estado: f.estado,
    falta: f.falta,
    armadas: f.inst.unidades_armadas,
    aConfirmar: f.inst.a_confirmar,
    otrasCajas: usosDe(cat, f.inst.id).map((u) => u.caja.codigo),
    sub: filasComponentes(f.inst).map((s) => ({
      id: s.componente.id,
      nombre: nombreComponente(s.componente),
      cant: s.componente.cant_por_unidad,
      stock: s.componente.stock,
      alcanza: s.alcanza,
      faltan: s.faltanProximo,
      estado: s.estado,
    })),
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4 justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-tenue">
            <Link href="/" className="hover:underline">
              Conteo de cajas
            </Link>{" "}
            / {caja.codigo}
          </p>
          <h1 className="titulo text-4xl">{caja.nombre}</h1>
          {caja.descripcion && <p className="text-sm text-tenue mt-1">{caja.descripcion}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/taller/${caja.codigo}`} className="btn">
            Cargar stock (vista taller)
          </Link>
          <Link href={`/cajas/${caja.codigo}/qr`} className="btn btn-primario">
            ▦ QR de la caja
          </Link>
        </div>
      </div>

      <div className="card p-4 grid gap-4 sm:grid-cols-[auto_auto_1fr] items-center">
        <div className="flex gap-8">
          <Cifra valor={caja.cajas_armadas} label="Armadas en stock" />
          <Cifra valor={r.posibles} label="Se pueden armar" clase={r.posibles > 0 ? "text-disponible" : "text-falta"} />
        </div>
        <div className="flex flex-wrap gap-1.5 sm:col-span-2 sm:justify-end">
          <EstadoChip estado="disponible" label={`${r.contadores.disponible} disponibles`} />
          <EstadoChip estado="en_proceso" label={`${r.contadores.en_proceso} en proceso`} />
          <EstadoChip estado="falta" label={`${r.contadores.falta} faltan`} />
          {r.contadores.sin_definir > 0 && <EstadoChip estado="sin_definir" label={`${r.contadores.sin_definir} sin definir`} />}
        </div>
        <div className="sm:col-span-3">
          <MedidorCaja estados={r.filas.map((f) => ({ id: f.inst.id, nombre: f.inst.nombre, estado: f.estado }))} />
        </div>
      </div>

      {filas.length === 0 ? (
        <p className="card p-6 text-tenue">Esta caja todavía no tiene instrumental. Agregalo acá abajo desde el catálogo o creá uno nuevo.</p>
      ) : (
        <TablaCaja cajaId={caja.id} filas={filas} />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4 space-y-3">
          <h2 className="titulo text-xl">Agregar instrumental a la caja</h2>
          <FormAccion accion={agregarACaja.bind(null, caja.id)} className="grid gap-3 sm:grid-cols-[1fr_6rem]" textoBoton="Agregar" ok="Agregado a la caja">
            <label>
              <span className="etiqueta">Del catálogo</span>
              <select name="instrumental_id" className="campo">
                <option value="">— Crear uno nuevo (completá abajo) —</option>
                {disponibles.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.codigo} · {i.nombre} ({TIPO_LABEL[i.tipo]})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="etiqueta">Por caja</span>
              <input name="cant_por_caja" type="number" min={1} defaultValue={1} className="campo font-mono" required />
            </label>
            <fieldset className="sm:col-span-2 grid gap-3 sm:grid-cols-[7rem_1fr_9rem] rounded border border-dashed border-borde p-3">
              <legend className="text-xs text-tenue px-1">Nuevo instrumental (si no elegiste uno del catálogo)</legend>
              <label>
                <span className="etiqueta">Código</span>
                <input name="codigo" className="campo font-mono" placeholder="DM-11" />
              </label>
              <label>
                <span className="etiqueta">Nombre</span>
                <input name="nombre" className="campo" />
              </label>
              <label>
                <span className="etiqueta">Tipo</span>
                <select name="tipo" className="campo" defaultValue="simple">
                  <option value="simple">Simple</option>
                  <option value="medidas">Medidas</option>
                  <option value="complejo">Complejo</option>
                </select>
              </label>
            </fieldset>
          </FormAccion>
        </section>

        <section className="card p-4 space-y-3">
          <h2 className="titulo text-xl">Datos de la caja</h2>
          <FormAccion accion={editarCaja.bind(null, caja.id)} className="grid gap-3 sm:grid-cols-[8rem_1fr]" limpiar={false}>
            <label>
              <span className="etiqueta">Código</span>
              <input name="codigo" className="campo font-mono uppercase" defaultValue={caja.codigo} required maxLength={12} />
            </label>
            <label>
              <span className="etiqueta">Nombre</span>
              <input name="nombre" className="campo" defaultValue={caja.nombre} required />
            </label>
            <label className="sm:col-span-2">
              <span className="etiqueta">Descripción</span>
              <textarea name="descripcion" className="campo" rows={2} defaultValue={caja.descripcion ?? ""} />
            </label>
          </FormAccion>
          <div className="pt-2 border-t border-borde">
            <BotonAccion
              accion={archivarCaja.bind(null, caja.id)}
              confirmar={`¿Archivar "${caja.nombre}"? Deja de aparecer en el conteo; el instrumental y el historial no se borran.`}
              className="btn btn-peligro text-sm"
            >
              Archivar caja
            </BotonAccion>
          </div>
        </section>
      </div>
    </div>
  );
}
