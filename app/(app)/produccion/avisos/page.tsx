import { armarRecordatorio, armarResumenDiario } from "@/lib/resumen";
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
  const [resumen, recordatorio] = await Promise.all([armarResumenDiario(), armarRecordatorio("09:40")]);
  const alguno = canales.some((c) => c.ok);
  return (
    <div className="space-y-4 max-w-3xl">
      <h2 className="titulo text-3xl">Avisos al celular</h2>
      <p className="text-sm text-tenue">
        Cada pedido nuevo, recepcionado, finalizado, entregado (también parcial) o cancelado manda un aviso. Además, todos los días: <strong>resumen a las 6:40</strong>
        y <strong>recordatorios a las 9:40, 12:40 y 15:40</strong> con lo pendiente y 3 preguntas sobre información que falta cargar.
        Un <strong>canal</strong> es el camino por donde llega el mensaje al celular: WhatsApp (CallMeBot), Telegram o una notificación push (ntfy).
        Se elige WhatsApp; se configura una sola vez en Vercel (ver README).
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
      <section className="card p-4 space-y-2">
        <h3 className="titulo text-xl">Vista previa de un recordatorio (9:40)</h3>
        {recordatorio ? (
          <>
            <p className="font-semibold">{recordatorio.titulo}</p>
            <pre className="whitespace-pre-wrap text-sm font-mono bg-superficie-2 p-3 rounded">{recordatorio.texto}</pre>
          </>
        ) : (
          <p className="text-sm text-tenue">✓ No hay nada pendiente: el recordatorio no se manda.</p>
        )}
      </section>
    </div>
  );
}
