import Link from "next/link";
import { obtenerPerfil } from "@/lib/auth";
import TemaToggle from "@/components/TemaToggle";
import NavLinks from "@/components/NavLinks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const perfil = await obtenerPerfil();
  const esAdmin = perfil.rol === "admin";

  const links = [
    { href: "/", label: "Resumen" },
    { href: "/cargar", label: "Cargar" },
    { href: "/fabricar", label: "Qué fabricar" },
    { href: "/planos", label: "Planos" },
    ...(esAdmin
      ? [
          { href: "/historial", label: "Historial" },
          { href: "/admin", label: "Administración" },
        ]
      : []),
  ];

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="no-imprimir sticky top-0 z-30 border-b border-borde bg-superficie">
        <div className="mx-auto max-w-7xl px-4 flex items-center gap-3 h-14">
          <Link href="/" className="titulo text-xl shrink-0">
            Cajas<span className="text-acento">·</span>Instrumental
          </Link>
          <NavLinks links={links} />
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <span className="hidden md:inline text-sm text-tenue">
              {perfil.nombre} · <span className="font-mono text-xs uppercase">{perfil.rol}</span>
            </span>
            <TemaToggle />
            <form action="/auth/salir" method="post">
              <button className="btn px-3 text-sm" aria-label="Cerrar sesión">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-5">{children}</main>
    </div>
  );
}
