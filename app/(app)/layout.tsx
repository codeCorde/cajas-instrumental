import Link from "next/link";
import { quienSoy } from "@/lib/sesion-servidor";
import { leerApariencia } from "@/lib/datos";
import TemaToggle from "@/components/TemaToggle";
import NavLinks from "@/components/NavLinks";
import { ProveedorAvisos } from "@/components/Aviso";
import LogoEmpresa from "@/components/LogoEmpresa";

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/", label: "Conteo de cajas" },
  { href: "/instrumental", label: "Instrumental" },
  { href: "/stock", label: "Stock" },
  { href: "/admin", label: "Administración" },
  { href: "/tareas", label: "Tareas" },
  { href: "/novedades", label: "Novedades" },
  { href: "/chat", label: "Chat" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [nombre, ap] = await Promise.all([quienSoy(), leerApariencia()]);
  return (
    <ProveedorAvisos>
      <div className="min-h-dvh flex flex-col">
        <header className="no-imprimir sticky top-0 z-30 border-b border-borde bg-superficie">
          <div className="mx-auto max-w-7xl px-4 flex items-center gap-3 h-14">
            <Link href="/" className="titulo text-xl shrink-0 flex items-center gap-2">
              <LogoEmpresa logoPath={ap.logo_path} />
              <span className="hidden sm:inline">{ap.empresa}</span>
            </Link>
            <NavLinks links={LINKS} />
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <Link href="/ingresar/nombre" className="text-sm text-tenue hover:text-texto hover:underline max-w-32 truncate" title="Cambiar de persona">
                <span aria-hidden="true">👤 </span>
                {nombre}
              </Link>
              <TemaToggle />
              <form action="/salir" method="post">
                <button className="btn px-3 text-sm" aria-label="Cerrar sesión">
                  Salir
                </button>
              </form>
            </div>
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-5">{children}</main>
      </div>
    </ProveedorAvisos>
  );
}
