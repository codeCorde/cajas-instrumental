"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  const activo = (href: string) => (href === "/" ? path === "/" || path.startsWith("/cajas") : path.startsWith(href));
  return (
    <nav aria-label="Principal" className="flex-1 min-w-0 overflow-x-auto">
      <ul className="flex gap-1 whitespace-nowrap">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={activo(l.href) ? "page" : undefined}
              className={`inline-flex items-center h-10 px-3 rounded text-sm font-semibold ${
                activo(l.href) ? "bg-acento text-acento-texto" : "text-tenue hover:bg-superficie-2 hover:text-texto"
              }`}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
