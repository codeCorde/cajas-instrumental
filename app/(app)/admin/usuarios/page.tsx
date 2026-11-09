import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import FormAccion from "@/components/FormAccion";
import { cambiarRol, crearUsuarioConClave, invitarUsuario } from "../acciones";
import type { Perfil } from "@/lib/tipos";

export const dynamic = "force-dynamic";

function SelectRol({ valor }: { valor?: string }) {
  return (
    <label>
      <span className="etiqueta">Rol</span>
      <select name="rol" defaultValue={valor ?? "operario"} className="campo">
        <option value="operario">Operario</option>
        <option value="admin">Admin</option>
      </select>
    </label>
  );
}

export default async function UsuariosPage() {
  const yo = await exigirAdmin();
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("perfiles").select("id, nombre, email, rol").order("rol").order("nombre");
  const usuarios = (data ?? []) as Perfil[];
  const hayServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="btn px-3" aria-label="Volver a Administración">
          ‹
        </Link>
        <h1 className="titulo text-4xl">Usuarios</h1>
      </div>

      <section className="card p-4 space-y-2">
        <h2 className="titulo text-2xl">Usuarios actuales</h2>
        <ul className="divide-y divide-borde">
          {usuarios.map((u) => (
            <li key={u.id} className="py-2">
              <FormAccion accion={cambiarRol} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={u.id} />
                <label className="flex-1 min-w-40">
                  <span className="etiqueta">Nombre</span>
                  <input name="nombre" defaultValue={u.nombre} className="campo" />
                </label>
                <span className="flex-1 min-w-48 font-mono text-sm min-h-11 inline-flex items-center">
                  {u.email} {u.id === yo.id && <span className="ml-2 text-tenue">(vos)</span>}
                </span>
                <SelectRol valor={u.rol} />
                <button className="btn">Guardar</button>
              </FormAccion>
            </li>
          ))}
        </ul>
      </section>

      {!hayServiceRole && (
        <p role="alert" className="card border-proceso bg-proceso-bg p-4 text-sm text-proceso">
          ⚠ Para invitar o crear usuarios desde acá, configurá <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> en las
          variables de entorno (ver README). Mientras tanto podés crearlos desde el panel de Supabase.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-4 space-y-3">
          <h2 className="titulo text-2xl">Invitar por email</h2>
          <p className="text-sm text-tenue">Le llega un email con un link para elegir su contraseña.</p>
          <FormAccion accion={invitarUsuario} className="flex flex-wrap items-end gap-3">
            <label className="flex-1 min-w-48">
              <span className="etiqueta">Email</span>
              <input name="email" type="email" className="campo" required />
            </label>
            <label className="flex-1 min-w-40">
              <span className="etiqueta">Nombre</span>
              <input name="nombre" className="campo" />
            </label>
            <SelectRol />
            <button className="btn btn-primario" disabled={!hayServiceRole}>
              Invitar
            </button>
          </FormAccion>
        </section>

        <section className="card p-4 space-y-3">
          <h2 className="titulo text-2xl">Crear con contraseña</h2>
          <p className="text-sm text-tenue">Sin email: vos elegís una contraseña inicial y se la pasás al operario.</p>
          <FormAccion accion={crearUsuarioConClave} className="flex flex-wrap items-end gap-3">
            <label className="flex-1 min-w-48">
              <span className="etiqueta">Email</span>
              <input name="email" type="email" className="campo" required />
            </label>
            <label className="flex-1 min-w-40">
              <span className="etiqueta">Nombre</span>
              <input name="nombre" className="campo" />
            </label>
            <label className="flex-1 min-w-40">
              <span className="etiqueta">Contraseña inicial</span>
              <input name="clave" type="text" minLength={8} className="campo font-mono" autoComplete="off" required />
            </label>
            <SelectRol />
            <button className="btn btn-primario" disabled={!hayServiceRole}>
              Crear
            </button>
          </FormAccion>
        </section>
      </div>
    </div>
  );
}
