import { db, sinError } from "@/lib/db";
import { urlBase } from "@/lib/qr";
import { fechaHora } from "@/lib/formato";
import FormAccion from "@/components/FormAccion";
import BotonAccion from "@/components/BotonAccion";
import CopiarTexto from "@/components/CopiarTexto";
import { borrarInvitacion, crearInvitacion } from "./acciones";

type Invitacion = { id: string; token: string; nombre: string; creada_por: string; creado_en: string; vence_en: string; usada_en: string | null };

/** El taller es privado: se entra solo con una invitación (link de un solo uso, 7 días). */
export default async function Invitaciones() {
  const [lista, base] = await Promise.all([
    db().from("invitaciones").select("*").order("creado_en", { ascending: false }).limit(30).then((r) => sinError(r) as Invitacion[]),
    urlBase(),
  ]);
  const ahora = new Date();
  return (
    <section className="card p-4 space-y-4">
      <h2 className="titulo text-2xl">Invitaciones al taller</h2>
      <p className="text-sm text-tenue">
        El taller es privado. Para sumar a alguien (por ejemplo, a tu socio) creá una invitación y mandale el link: sirve una sola vez y vence a los 7 días.
        Para sacarle el acceso a alguien, desactivalo en «Personas».
      </p>
      <FormAccion accion={crearInvitacion} className="flex gap-2" textoBoton="+ Crear invitación" botonAparte>
        <input name="nombre" className="campo" placeholder="Nombre de la persona" required maxLength={40} aria-label="Nombre de la persona invitada" />
      </FormAccion>
      {lista.length > 0 && (
        <ul className="divide-y divide-borde">
          {lista.map((i) => {
            const link = `${base}/ingresar/invitacion/${i.token}`;
            const vencida = new Date(i.vence_en) < ahora;
            return (
              <li key={i.id} className="py-2 space-y-1">
                <p className="text-sm">
                  <strong>{i.nombre}</strong> · creada por {i.creada_por} el {fechaHora(i.creado_en)} ·{" "}
                  {i.usada_en ? (
                    <span className="text-disponible font-semibold">✓ aceptada {fechaHora(i.usada_en)}</span>
                  ) : vencida ? (
                    <span className="text-falta font-semibold">✕ vencida</span>
                  ) : (
                    <span className="text-proceso font-semibold">◐ pendiente (vence {fechaHora(i.vence_en)})</span>
                  )}
                </p>
                {!i.usada_en && !vencida && (
                  <div className="flex flex-wrap items-center gap-2">
                    <CopiarTexto texto={link} etiqueta="Copiar link" />
                    <BotonAccion accion={borrarInvitacion.bind(null, i.id)} className="btn btn-peligro text-sm" confirmar={`¿Anular la invitación de ${i.nombre}?`}>
                      Anular
                    </BotonAccion>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
