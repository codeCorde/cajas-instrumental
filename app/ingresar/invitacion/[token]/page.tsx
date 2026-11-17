import { db } from "@/lib/db";
import { aceptarInvitacion } from "../../acciones";

export const dynamic = "force-dynamic";

/** Link de invitación (un solo uso, vence a los 7 días). Al aceptarlo, la persona queda habilitada y entra sin contraseña. */
export default async function InvitacionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valido = /^[0-9a-f-]{36}$/i.test(token);
  const { data } = valido ? await db().from("invitaciones").select("nombre, usada_en, vence_en").eq("token", token).maybeSingle() : { data: null };
  const ok = data && !data.usada_en && new Date(data.vence_en) > new Date();
  return (
    <main className="min-h-dvh grid place-items-center p-4">
      <div className="w-full max-w-sm card p-6 space-y-4">
        {ok ? (
          <>
            <h1 className="titulo text-3xl">Te invitaron al taller</h1>
            <p>
              Vas a entrar como <strong>{data!.nombre}</strong>. El link sirve una sola vez: guardá la contraseña que te pasen para entrar desde otros equipos.
            </p>
            <form action={aceptarInvitacion}>
              <input type="hidden" name="token" value={token} />
              <button className="btn btn-primario w-full min-h-12">Aceptar y entrar</button>
            </form>
          </>
        ) : (
          <>
            <h1 className="titulo text-3xl">Link no válido</h1>
            <p className="text-tenue">La invitación no existe, ya se usó o venció. Pedile una nueva a quien administra el taller.</p>
          </>
        )}
      </div>
    </main>
  );
}
