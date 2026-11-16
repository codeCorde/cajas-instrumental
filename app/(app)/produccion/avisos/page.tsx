import { armarResumenDiario } from "@/lib/resumen";
import BotonAccion from "@/components/BotonAccion";
import { probarAvisos } from "../acciones";

export const dynamic = "force-dynamic";

/** Avisos al celular: qué canales están configurados, vista previa del resumen diario y botón para probar. */
export default async function AvisosPage() {
  const canales = [
    { nombre: "Telegram", ok: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) },
    { nombre: "WhatsApp (CallMeBot)", ok: !!(process.env.CALLMEBOT_TELEFONOS && process.env.CALLMEBOT_APIKEYS) },
    { nombre: "Notificación push (ntfy)", ok: !!process.env.NTFY_TEMA },
  ];
  const resumen = await armarResumenDiario();
  const alguno = canales.some((c) => c.ok);
  return (
    <div className="space-y-4 max-w-3xl">
      <h2 className="titulo text-3xl">Avisos al celular</h2>
      <p className="text-sm text-tenue">
        Cada pedido nuevo, recepcionado, finalizado, firmado o cancelado manda un aviso. Además, todos los días a las 8:00 llega este resumen. Los canales se
        configuran con variables de entorno en Vercel (ver README).
      </p>
      <ul className="card divide-y divide-borde">
        {canales.map((c) => (
          <li key={c.nombre} className="p-3 flex justify-between">
            <span>{c.nombre}</span>
            <span className={`font-semibold ${c.ok ? "text-disponible" : "text-sin"}`}>{c.ok ? "✓ Configurado" : "○ Sin configurar"}</span>
          </li>
        ))}
      </ul>
      <section className="card p-4 space-y-2">
        <h3 className="titulo text-xl">Vista previa del resumen diario</h3>
        <p className="font-semibold">{resumen.titulo}</p>
        <pre className="whitespace-pre-wrap text-sm font-mono bg-superficie-2 p-3 rounded">{resumen.texto}</pre>
        <BotonAccion accion={probarAvisos} className="btn btn-primario" ok="Resumen enviado">
          {alguno ? "Mandar el resumen ahora" : "Mandar (no hay canales configurados)"}
        </BotonAccion>
      </section>
    </div>
  );
}
