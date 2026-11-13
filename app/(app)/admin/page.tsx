import Link from "next/link";
import { db } from "@/lib/db";
import { hoyISO } from "@/lib/formato";

export default async function AdminPage() {
  const hoy = hoyISO();
  const [abiertos, vencidos, noConf] = await Promise.all([
    db().from("pedidos").select("id", { count: "exact", head: true }).in("estado", ["pendiente", "en_produccion", "listo"]),
    db().from("pedidos").select("id", { count: "exact", head: true }).in("estado", ["pendiente", "en_produccion", "listo"]).lt("fecha_compromiso", hoy),
    db().from("inspecciones").select("id", { count: "exact", head: true }).eq("resultado", "no_conforme").eq("accion_cerrada", false),
  ]);
  const tarjetas = [
    {
      href: "/admin/pedidos",
      titulo: "Pedidos",
      texto: "Cargá pedidos, seguí qué falta para cumplirlos y registrá las entregas.",
      dato: `${abiertos.count ?? 0} abiertos`,
      alerta: vencidos.count ? `${vencidos.count} vencidos` : null,
    },
    {
      href: "/admin/calidad",
      titulo: "Control de calidad",
      texto: "Notas de conformidad: inspecciones, checklist, medidas y acciones correctivas.",
      dato: null,
      alerta: noConf.count ? `${noConf.count} no conformidades abiertas` : null,
    },
    { href: "/admin/config", titulo: "Configuración", texto: "Apariencia, nombres de las personas y plantillas de calidad.", dato: null, alerta: null },
  ];
  return (
    <div className="space-y-5">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-tenue">Administración</p>
        <h1 className="titulo text-4xl">Administración</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {tarjetas.map((t) => (
          <Link key={t.href} href={t.href} className="card p-5 space-y-2 hover:border-acento">
            <h2 className="titulo text-2xl">{t.titulo}</h2>
            <p className="text-sm text-tenue">{t.texto}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {t.dato && <span className="rounded-full bg-superficie-2 px-2.5 py-1 text-xs font-semibold">{t.dato}</span>}
              {t.alerta && <span className="rounded-full bg-falta-bg text-falta px-2.5 py-1 text-xs font-semibold">✕ {t.alerta}</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
