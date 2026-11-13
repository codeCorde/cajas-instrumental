"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { useAviso } from "@/components/Aviso";
import LogoEmpresa from "@/components/LogoEmpresa";
import { guardarLogo, prepararLogo } from "./acciones";

export default function SubirLogo({ logoPath }: { logoPath: string | null }) {
  const [subiendo, setSubiendo] = useState(false);
  const avisar = useAviso();
  const router = useRouter();

  async function subir(f: File | undefined) {
    if (!f) return;
    setSubiendo(true);
    const p = await prepararLogo(f.name, f.size);
    if (!p.ok) {
      avisar({ tipo: "error", texto: p.error });
      return setSubiendo(false);
    }
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const up = await sb.storage.from("planos").uploadToSignedUrl(p.ruta, p.token, f, { contentType: f.type });
    if (up.error) avisar({ tipo: "error", texto: up.error.message });
    else {
      const r = await guardarLogo(p.ruta);
      avisar(r.ok ? { tipo: "ok", texto: "Logo guardado" } : { tipo: "error", texto: r.error });
    }
    setSubiendo(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <LogoEmpresa logoPath={logoPath} grande />
      <label className="btn cursor-pointer">
        {subiendo ? "Subiendo…" : logoPath ? "Cambiar logo" : "Subir logo"}
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => subir(e.currentTarget.files?.[0])} disabled={subiendo} />
      </label>
      {logoPath && (
        <button
          type="button"
          className="btn btn-peligro text-sm"
          onClick={async () => {
            await guardarLogo(null);
            router.refresh();
          }}
        >
          Quitar
        </button>
      )}
    </div>
  );
}
