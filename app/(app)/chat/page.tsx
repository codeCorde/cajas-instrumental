import { db, sinError } from "@/lib/db";
import { quienSoy } from "@/lib/sesion-servidor";
import type { Mensaje } from "@/lib/tipos";
import Chat from "./Chat";

export default async function ChatPage() {
  const [yo, mensajes] = await Promise.all([
    quienSoy(),
    db().from("mensajes").select("*").order("id", { ascending: false }).limit(150).then((r) => (sinError(r) as Mensaje[]).reverse()),
  ]);
  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-tenue">Equipo</p>
        <h1 className="titulo text-4xl">Chat</h1>
      </div>
      <Chat yo={yo} iniciales={mensajes} />
    </div>
  );
}
