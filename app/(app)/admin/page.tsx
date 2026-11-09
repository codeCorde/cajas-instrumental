import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { listarCajasCompletas } from "@/lib/datos";
import { EtiquetaEjemplo } from "@/components/Estado";
import FormAccion from "@/components/FormAccion";
import { guardarCaja } from "./acciones";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await exigirAdmin();
  const cajas = await listarCajasCompletas(false);
  const proximoNumero = Math.max(0, ...cajas.map((c) => c.numero)) + 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="titulo text-4xl">Administración</h1>
        <div className="flex gap-2">
          <Link href="/admin/usuarios" className="btn">
            Usuarios
          </Link>
          <Link href="/admin/qr" className="btn">
            QR de carga
          </Link>
        </div>
      </div>

      <section className="card overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr>
              <th>N°</th>
              <th>Caja</th>
              <th className="text-right">Instrumentales</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cajas.map((c) => (
              <tr key={c.id}>
                <td className="font-mono">{c.numero}</td>
                <td className="font-semibold">
                  {c.nombre} {c.ejemplo && <EtiquetaEjemplo />}
                </td>
                <td className="text-right font-mono">{c.instrumentales.length}</td>
                <td>{c.activa ? "Activa" : <span className="text-tenue">Inactiva (no aparece en la carga)</span>}</td>
                <td className="text-right">
                  <Link href={`/admin/cajas/${c.id}`} className="btn text-sm">
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="titulo text-2xl">Nueva caja</h2>
        <FormAccion accion={guardarCaja} className="flex flex-wrap gap-3 items-end">
          <label className="w-24">
            <span className="etiqueta">N°</span>
            <input name="numero" type="number" min={1} defaultValue={proximoNumero} className="campo font-mono" required />
          </label>
          <label className="flex-1 min-w-48">
            <span className="etiqueta">Nombre</span>
            <input name="nombre" className="campo" required />
          </label>
          <input type="hidden" name="activa" value="on" />
          <button className="btn btn-primario">Crear caja</button>
        </FormAccion>
      </section>
    </div>
  );
}
