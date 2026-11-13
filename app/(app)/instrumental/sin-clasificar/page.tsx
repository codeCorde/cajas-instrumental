import Link from "next/link";
import { db, sinError } from "@/lib/db";
import { archivosDe, cargarCatalogo } from "@/lib/datos";
import type { SinClasificar } from "@/lib/tipos";
import Archivos from "@/components/Archivos";
import FormAccion from "@/components/FormAccion";
import BotonAccion from "@/components/BotonAccion";
import { Etiqueta } from "@/components/Estado";
import { agregarSinClasificar, borrarSinClasificar, convertirEnInstrumental, moverComoPieza } from "../acciones";

export default async function SinClasificarPage() {
  const cat = await cargarCatalogo();
  const items = sinError(await db().from("sin_clasificar").select("*").order("creado_en")) as SinClasificar[];
  const archivos = await archivosDe("sin_clasificar", items.map((i) => i.id));
  const complejos = cat.instrumentales.filter((i) => i.tipo === "complejo");

  return (
    <div className="space-y-5">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-tenue">
          <Link href="/instrumental" className="hover:underline">
            Instrumental
          </Link>{" "}
          / Sin clasificar
        </p>
        <h1 className="titulo text-4xl">Bandeja «Sin clasificar»</h1>
        <p className="text-sm text-tenue mt-1 max-w-3xl">
          Piezas con planos pero sin un lugar claro en el catálogo. Convertí cada una en instrumental o movela como pieza de un instrumental complejo: sus archivos se van con ella.
        </p>
      </div>

      {items.length === 0 && <p className="card p-6 text-tenue">La bandeja está vacía. ✓</p>}

      <ul className="space-y-4">
        {items.map((s) => {
          const caja = cat.cajas.find((c) => c.id === s.caja_id);
          return (
            <li key={s.id} className="card p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="titulo text-2xl">{s.nombre}</h2>
                  {s.nota && <p className="text-sm text-tenue">{s.nota}</p>}
                </div>
                {caja && <Etiqueta>{caja.codigo}</Etiqueta>}
              </div>
              <Archivos entidad="sin_clasificar" entidadId={s.id} archivos={archivos.filter((a) => a.entidad_id === s.id)} compacto />
              <div className="grid gap-3 lg:grid-cols-2 pt-3 border-t border-borde">
                <FormAccion accion={convertirEnInstrumental.bind(null, s.id)} className="grid gap-2 grid-cols-2 rounded border border-borde p-3" textoBoton="Convertir en instrumental" botonAparte>
                  <p className="col-span-2 text-sm font-semibold">Convertir en instrumental</p>
                  <label>
                    <span className="etiqueta">Código</span>
                    <input name="codigo" className="campo font-mono" required placeholder={`${caja?.codigo ?? "X"}-20`} />
                  </label>
                  <label>
                    <span className="etiqueta">Tipo</span>
                    <select name="tipo" className="campo" defaultValue="simple">
                      <option value="simple">Simple</option>
                      <option value="medidas">Medidas</option>
                      <option value="complejo">Complejo</option>
                    </select>
                  </label>
                  <label>
                    <span className="etiqueta">Nombre</span>
                    <input name="nombre" className="campo" defaultValue={s.nombre} />
                  </label>
                  <label>
                    <span className="etiqueta">Sumarlo a la caja</span>
                    <select name="caja_id" className="campo" defaultValue={s.caja_id ?? ""}>
                      <option value="">— Ninguna —</option>
                      {cat.cajas.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                </FormAccion>
                <FormAccion accion={moverComoPieza.bind(null, s.id)} className="grid gap-2 grid-cols-2 rounded border border-borde p-3" textoBoton="Mover como pieza" botonAparte>
                  <p className="col-span-2 text-sm font-semibold">Mover como pieza de un complejo</p>
                  <label className="col-span-2">
                    <span className="etiqueta">Instrumental complejo</span>
                    <select name="instrumental_id" className="campo" required defaultValue="">
                      <option value="" disabled>
                        Elegí…
                      </option>
                      {complejos.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.codigo} · {i.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="col-span-2">
                    <span className="etiqueta">Código de la pieza</span>
                    <input name="codigo" className="campo font-mono" placeholder="Ej.: 3/4" />
                  </label>
                </FormAccion>
              </div>
              <BotonAccion accion={borrarSinClasificar.bind(null, s.id)} className="btn btn-peligro text-sm" confirmar={`¿Borrar "${s.nombre}" y sus archivos? No se puede deshacer.`}>
                Borrar
              </BotonAccion>
            </li>
          );
        })}
      </ul>

      <details className="card p-4 max-w-xl">
        <summary className="cursor-pointer font-semibold">+ Agregar a la bandeja</summary>
        <FormAccion accion={agregarSinClasificar} className="mt-3 grid gap-3" textoBoton="Agregar">
          <label>
            <span className="etiqueta">Nombre</span>
            <input name="nombre" className="campo" required />
          </label>
          <label>
            <span className="etiqueta">Nota</span>
            <input name="nota" className="campo" />
          </label>
          <label>
            <span className="etiqueta">Caja</span>
            <select name="caja_id" className="campo">
              <option value="">—</option>
              {cat.cajas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
        </FormAccion>
      </details>
    </div>
  );
}
