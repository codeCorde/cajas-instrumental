import { obtenerPerfil } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Mensaje } from "@/lib/tipos";
import ChatEquipo from "@/components/ChatEquipo";

export const dynamic = "force-dynamic";

const LIMITE = 200;

export default async function ChatPage() {
  const perfil = await obtenerPerfil();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("mensajes")
    .select("id, creado_en, autor_id, autor_nombre, texto")
    .order("creado_en", { ascending: false })
    .order("id", { ascending: false })
    .limit(LIMITE);
  if (error) throw error;
  const mensajes = (data as Mensaje[]).reverse();

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-tenue">Solo para los usuarios de la app</p>
        <h1 className="titulo text-4xl">Chat del equipo</h1>
        <p className="text-sm text-tenue mt-1">
          Para coordinar entre todos. Los mensajes aparecen al instante en las otras pantallas. Podés borrar los tuyos
          {perfil.rol === "admin" ? " (como admin, también los de los demás)" : ""}.
        </p>
      </div>
      <ChatEquipo
        inicial={mensajes}
        yo={perfil.id}
        esAdmin={perfil.rol === "admin"}
        recortado={mensajes.length === LIMITE}
      />
    </div>
  );
}
