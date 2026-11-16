"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Pestanas({ porRecepcionar, sinFirmar }: { porRecepcionar: number; sinFirmar: number }) {
  const path = usePathname();
  const tabs = [
    { href: "/produccion", n: 1, label: "Órdenes de producción", badge: porRecepcionar ? `${porRecepcionar} por recepcionar` : null, activo: path === "/produccion" || path.startsWith("/produccion/pedido") },
    { href: "/produccion/partes", n: 2, label: "Stock de partes", badge: null, activo: path.startsWith("/produccion/partes") },
    { href: "/produccion/terminadas", n: 3, label: "Stock de piezas terminadas", badge: null, activo: path.startsWith("/produccion/terminadas") },
    { href: "/produccion/entregados", n: 4, label: "Pedidos entregados", badge: sinFirmar ? `${sinFirmar} sin firmar` : null, activo: path.startsWith("/produccion/entregados") },
  ];
  return (
    <nav aria-label="Secciones de producción" className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.activo ? "page" : undefined}
          className={`card p-3 flex items-start gap-2 min-h-16 ${t.activo ? "border-acento bg-acento text-acento-texto" : "hover:border-acento"}`}
        >
          <span className="font-mono font-semibold">{t.n}</span>
          <span className="min-w-0">
            <span className="block font-semibold leading-tight">{t.label}</span>
            {t.badge && <span className={`block text-xs font-semibold ${t.activo ? "" : "text-proceso"}`}>■ {t.badge}</span>}
          </span>
        </Link>
      ))}
    </nav>
  );
}
