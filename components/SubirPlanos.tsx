"use client";
// Sube planos directo del navegador a Supabase Storage (sin pasar por el servidor de Vercel,
// que limita el tamaño de lo que recibe). RLS solo deja subir al admin.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { ACEPTA_PLANOS, BUCKET_PLANOS, nombreDeArchivo, slug } from "@/lib/planos";

export default function SubirPlanos({
  cajaId,
  cajaNumero,
  instrumentalId,
}: {
  cajaId: string;
  cajaNumero: number;
  instrumentalId: string | null;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<{ tipo: "ok" | "error" | "progreso"; texto: string } | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  async function subir(e: React.FormEvent) {
    e.preventDefault();
    const archivos = [...(input.current?.files ?? [])];
    if (archivos.length === 0) return setEstado({ tipo: "error", texto: "Elegí uno o más archivos." });
    const supabase = crearClienteNavegador();
    setSubiendo(true);
    const errores: string[] = [];
    for (const [n, archivo] of archivos.entries()) {
      setEstado({ tipo: "progreso", texto: `Subiendo ${n + 1} de ${archivos.length}: ${archivo.name}` });
      if (archivo.size > 50 * 1024 * 1024) {
        errores.push(`${archivo.name}: pesa más de 50 MB`);
        continue;
      }
      const { nombre, formato } = nombreDeArchivo(archivo.name);
      const ruta = `caja-${cajaNumero}/${instrumentalId ?? "caja"}/${Date.now()}-${slug(archivo.name)}`;
      const up = await supabase.storage
        .from(BUCKET_PLANOS)
        .upload(ruta, archivo, { contentType: archivo.type || (formato === "pdf" ? "application/pdf" : "application/octet-stream") });
      if (up.error) {
        errores.push(`${archivo.name}: ${up.error.message}`);
        continue;
      }
      const ins = await supabase
        .from("planos")
        .insert({ caja_id: cajaId, instrumental_id: instrumentalId, nombre, ruta, formato, tamano: archivo.size });
      if (ins.error) {
        await supabase.storage.from(BUCKET_PLANOS).remove([ruta]);
        errores.push(`${archivo.name}: ${ins.error.message}`);
      }
    }
    setSubiendo(false);
    if (input.current) input.current.value = "";
    setEstado(
      errores.length
        ? { tipo: "error", texto: `No se pudieron subir: ${errores.join(" · ")}` }
        : { tipo: "ok", texto: `${archivos.length} archivo${archivos.length === 1 ? "" : "s"} subido${archivos.length === 1 ? "" : "s"}.` },
    );
    router.refresh();
  }

  return (
    <form onSubmit={subir} className="flex flex-wrap items-end gap-3" aria-busy={subiendo}>
      <label className="flex-1 min-w-56">
        <span className="etiqueta">Agregar planos (PDF, DWG, STEP…)</span>
        <input ref={input} type="file" multiple accept={ACEPTA_PLANOS} className="campo py-2" disabled={subiendo} />
      </label>
      <button className="btn btn-primario" disabled={subiendo}>
        {subiendo ? "Subiendo…" : "Subir"}
      </button>
      {estado && (
        <p
          role={estado.tipo === "error" ? "alert" : "status"}
          className={`basis-full text-sm ${estado.tipo === "error" ? "text-falta" : estado.tipo === "ok" ? "text-disponible" : "text-tenue"}`}
        >
          {estado.tipo === "error" ? "✕ " : estado.tipo === "ok" ? "✓ " : ""}
          {estado.texto}
        </p>
      )}
    </form>
  );
}
