"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import type { Archivo, EntidadArchivo } from "@/lib/tipos";
import { fechaHora, iconoArchivo, seVeEnLaWeb, tamanoLegible, IMAGENES } from "@/lib/formato";
import { borrarArchivo, confirmarSubida, marcarVigente, prepararSubida } from "@/app/(app)/archivos/acciones";
import { useAviso } from "./Aviso";

/**
 * Lista de archivos técnicos de un instrumental, pieza, medida, caja o inspección, con subida directa a Storage.
 * PDF e imágenes se ven dentro de la web; DWG y STP solo se descargan.
 */
export default function Archivos({
  entidad,
  entidadId,
  archivos,
  soloLectura,
  compacto,
}: {
  entidad: EntidadArchivo;
  entidadId: string;
  archivos: Archivo[];
  soloLectura?: boolean;
  compacto?: boolean;
}) {
  const [viendo, setViendo] = useState<string | null>(null);
  const [anteriores, setAnteriores] = useState(false);
  const vigentes = archivos.filter((a) => a.vigente);
  const viejos = archivos.filter((a) => !a.vigente);

  return (
    <div className="space-y-2">
      {archivos.length === 0 && <p className="text-sm text-tenue">{soloLectura ? "No hay archivos." : "Todavía no hay archivos. Subí planos PDF, DWG, STP o fotos."}</p>}
      <ul className="divide-y divide-borde">
        {[...vigentes, ...(anteriores ? viejos : [])].map((a) => (
          <FilaArchivo key={a.id} a={a} viendo={viendo === a.id} onVer={() => setViendo(viendo === a.id ? null : a.id)} soloLectura={soloLectura} compacto={compacto} />
        ))}
      </ul>
      {viejos.length > 0 && (
        <button type="button" className="text-xs text-tenue underline" onClick={() => setAnteriores((v) => !v)}>
          {anteriores ? "Ocultar versiones anteriores" : `Ver ${viejos.length} ${viejos.length === 1 ? "versión anterior" : "versiones anteriores"}`}
        </button>
      )}
      {!soloLectura && <SubirArchivos entidad={entidad} entidadId={entidadId} />}
    </div>
  );
}

function FilaArchivo({ a, viendo, onVer, soloLectura, compacto }: { a: Archivo; viendo: boolean; onVer: () => void; soloLectura?: boolean; compacto?: boolean }) {
  const { icono, etiqueta } = iconoArchivo(a.tipo);
  const avisar = useAviso();
  const router = useRouter();
  const correr = async (p: Promise<{ ok: boolean; error?: string }>, ok: string) => {
    const r = await p;
    avisar(r.ok ? { tipo: "ok", texto: ok } : { tipo: "error", texto: r.error ?? "Error" });
    router.refresh();
  };
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span aria-hidden="true" className="text-xl">
          {icono}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`font-semibold text-sm break-words ${a.vigente ? "" : "text-tenue line-through decoration-1"}`}>
            {a.nombre}
            <span className="font-mono text-xs text-tenue">.{a.tipo}</span>
            {!a.vigente && <span className="ml-2 no-underline text-xs font-normal">(versión anterior)</span>}
          </p>
          {!compacto && (
            <p className="text-xs text-tenue">
              {etiqueta} · {tamanoLegible(a.tamano)} · {fechaHora(a.creado_en)}
              {a.subido_por ? ` · ${a.subido_por}` : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {seVeEnLaWeb(a.tipo) && (
            <button type="button" className="btn min-h-9 px-3 text-sm" onClick={onVer} aria-expanded={viendo}>
              {viendo ? "Cerrar" : "Ver"}
            </button>
          )}
          <a href={`/archivos/${a.id}?descargar`} className="btn min-h-9 px-3 text-sm">
            Descargar
          </a>
          {!soloLectura && (
            <>
              <button type="button" className="btn min-h-9 px-2 text-xs" onClick={() => correr(marcarVigente(a.id, !a.vigente), a.vigente ? "Marcado como versión anterior" : "Marcado como vigente")}>
                {a.vigente ? "Pasar a anterior" : "Marcar vigente"}
              </button>
              <button
                type="button"
                className="btn btn-peligro min-h-9 px-2 text-xs"
                aria-label={`Borrar ${a.nombre}`}
                onClick={() => window.confirm(`¿Borrar "${a.nombre}.${a.tipo}"? No se puede deshacer.`) && correr(borrarArchivo(a.id), "Archivo borrado")}
              >
                ✕
              </button>
            </>
          )}
        </div>
      </div>
      {viendo &&
        (IMAGENES.includes(a.tipo) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/archivos/${a.id}`} alt={a.nombre} className="mt-2 max-h-[70vh] w-full object-contain rounded border border-borde bg-white" />
        ) : (
          <iframe src={`/archivos/${a.id}`} title={a.nombre} className="mt-2 w-full h-[75vh] rounded border border-borde bg-white" />
        ))}
    </li>
  );
}

function SubirArchivos({ entidad, entidadId }: { entidad: EntidadArchivo; entidadId: string }) {
  const [estado, setEstado] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const avisar = useAviso();
  const router = useRouter();

  async function subir(files: FileList | null) {
    if (!files?.length) return;
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    let ok = 0;
    for (const [i, f] of Array.from(files).entries()) {
      setEstado(`Subiendo ${i + 1} de ${files.length}: ${f.name}…`);
      const p = await prepararSubida(entidad, entidadId, f.name, f.size);
      if (!p.ok) {
        avisar({ tipo: "error", texto: p.error });
        continue;
      }
      const up = await sb.storage.from("planos").uploadToSignedUrl(p.ruta, p.token, f, { contentType: f.type || "application/octet-stream" });
      if (up.error) {
        avisar({ tipo: "error", texto: `${f.name}: ${up.error.message}` });
        continue;
      }
      const c = await confirmarSubida(entidad, entidadId, f.name, f.size, p.ruta);
      if (c.ok) ok++;
      else avisar({ tipo: "error", texto: c.error });
    }
    setEstado(null);
    if (input.current) input.current.value = "";
    if (ok) avisar({ tipo: "ok", texto: ok === 1 ? "Archivo subido" : `${ok} archivos subidos` });
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <label className="btn min-h-9 px-3 text-sm cursor-pointer">
        ⇪ Subir archivos
        <input ref={input} type="file" multiple className="sr-only" accept=".pdf,.dwg,.dxf,.stp,.step,image/*" onChange={(e) => subir(e.currentTarget.files)} disabled={!!estado} />
      </label>
      <span className="text-xs text-tenue" aria-live="polite">
        {estado ?? "PDF, DWG, STP/STEP o imágenes · hasta 50 MB"}
      </span>
    </div>
  );
}
