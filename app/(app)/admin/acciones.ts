"use server";
// Server Actions de administración. Usan la sesión del usuario: RLS valida que sea admin.
// (exigirAdmin además corta antes y da un mensaje claro.)

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import type { Resultado } from "@/components/FormAccion";
import { BUCKET_PLANOS } from "@/lib/planos";

// ---------- helpers ----------
const txt = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};
const ent = (fd: FormData, k: string, min = 0) => {
  const v = Math.trunc(Number(fd.get(k)));
  return Number.isFinite(v) && v >= min ? v : null;
};
const url = (fd: FormData, k: string) => {
  const v = txt(fd, k);
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
};
function errorDB(e: { message: string; code?: string } | null): string {
  if (!e) return "Error desconocido";
  if (e.code === "23505") return "Ya existe un registro con ese número/código.";
  if (e.code === "42501") return "No tenés permiso para hacer esto.";
  return e.message;
}
/** Borra de Storage los archivos de planos que cumplan el filtro (antes de borrar la fila en cascada). */
async function borrarArchivosPlanos(supabase: Awaited<ReturnType<typeof crearClienteServidor>>, campo: "caja_id" | "instrumental_id" | "id", valor: string) {
  const { data } = await supabase.from("planos").select("ruta").eq(campo, valor);
  const rutas = (data ?? []).map((p) => p.ruta as string);
  if (rutas.length) await supabase.storage.from(BUCKET_PLANOS).remove(rutas);
}
function refrescar() {
  revalidatePath("/", "layout");
}

// ================= CAJAS =================
export async function guardarCaja(fd: FormData): Promise<Resultado> {
  await exigirAdmin();
  const supabase = await crearClienteServidor();
  const id = txt(fd, "id");
  const datos = {
    numero: ent(fd, "numero", 1),
    nombre: txt(fd, "nombre"),
    foto_url: url(fd, "foto_url"),
    activa: fd.get("activa") === "on",
  };
  if (!datos.numero || !datos.nombre) return { error: "Completá número y nombre." };
  if (id) {
    const { error } = await supabase.from("cajas").update(datos).eq("id", id);
    if (error) return { error: errorDB(error) };
    refrescar();
    return { ok: "Caja guardada." };
  }
  const { data, error } = await supabase.from("cajas").insert(datos).select("id").single();
  if (error) return { error: errorDB(error) };
  refrescar();
  redirect(`/admin/cajas/${data.id}`);
}

export async function borrarCaja(fd: FormData): Promise<Resultado> {
  await exigirAdmin();
  const supabase = await crearClienteServidor();
  await borrarArchivosPlanos(supabase, "caja_id", txt(fd, "id")!);
  const { error } = await supabase.from("cajas").delete().eq("id", txt(fd, "id")!);
  if (error) return { error: errorDB(error) };
  refrescar();
  redirect("/admin");
}

// ================= INSTRUMENTALES =================
export async function crearInstrumental(fd: FormData): Promise<Resultado> {
  await exigirAdmin();
  const supabase = await crearClienteServidor();
  const caja_id = txt(fd, "caja_id")!;
  const codigo = txt(fd, "codigo");
  const nombre = txt(fd, "nombre");
  const cant_por_caja = ent(fd, "cant_por_caja", 1);
  const tipo = txt(fd, "tipo") ?? "simple";
  if (!codigo || !nombre || !cant_por_caja) return { error: "Completá código, nombre y cantidad por caja (≥ 1)." };
  const { data: ultimo } = await supabase
    .from("instrumentales")
    .select("orden")
    .eq("caja_id", caja_id)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("instrumentales")
    .insert({ caja_id, codigo, nombre, tipo, cant_por_caja, orden: (ultimo?.orden ?? 0) + 1 })
    .select("id")
    .single();
  if (error) return { error: errorDB(error) };
  refrescar();
  redirect(`/admin/instrumentales/${data.id}`);
}

export async function guardarInstrumental(fd: FormData): Promise<Resultado> {
  await exigirAdmin();
  const supabase = await crearClienteServidor();
  const id = txt(fd, "id")!;
  const datos = {
    codigo: txt(fd, "codigo"),
    nombre: txt(fd, "nombre"),
    alias: txt(fd, "alias"),
    tipo: txt(fd, "tipo"),
    cant_por_caja: ent(fd, "cant_por_caja", 1),
    material: txt(fd, "material"),
    terminacion: txt(fd, "terminacion"),
    barra: txt(fd, "barra"),
    origen: txt(fd, "origen") ?? "propio",
    proveedor: txt(fd, "proveedor"),
    foto_url: url(fd, "foto_url"),
    link_2d: url(fd, "link_2d"),
    link_3d: url(fd, "link_3d"),
    link_cnc: url(fd, "link_cnc"),
    link_fotos: url(fd, "link_fotos"),
  };
  if (!datos.codigo || !datos.nombre || !datos.cant_por_caja || !datos.tipo) {
    return { error: "Completá código, nombre, tipo y cantidad por caja (≥ 1)." };
  }
  const { error } = await supabase.from("instrumentales").update(datos).eq("id", id);
  if (error) return { error: errorDB(error) };
  refrescar();
  return { ok: "Instrumental guardado." };
}

export async function borrarInstrumental(fd: FormData): Promise<Resultado> {
  await exigirAdmin();
  const supabase = await crearClienteServidor();
  const id = txt(fd, "id")!;
  const { data: inst } = await supabase.from("instrumentales").select("caja_id").eq("id", id).single();
  await borrarArchivosPlanos(supabase, "instrumental_id", id);
  const { error } = await supabase.from("instrumentales").delete().eq("id", id);
  if (error) return { error: errorDB(error) };
  refrescar();
  redirect(inst ? `/admin/cajas/${inst.caja_id}` : "/admin");
}

/** Intercambia el orden con el vecino de arriba/abajo. */
async function mover(tabla: "instrumentales" | "partes", fk: "caja_id" | "instrumental_id", fd: FormData): Promise<Resultado> {
  await exigirAdmin();
  const supabase = await crearClienteServidor();
  const id = txt(fd, "id")!;
  const dir = txt(fd, "dir") === "arriba" ? -1 : 1;
  const { data: actual } = await supabase.from(tabla).select(`id, orden, ${fk}`).eq("id", id).single();
  if (!actual) return { error: "No encontrado." };
  const padre = (actual as Record<string, unknown>)[fk] as string;
  const { data: hermanos } = await supabase.from(tabla).select("id, orden").eq(fk, padre).order("orden").order("id");
  const lista = (hermanos ?? []).map((h, i) => ({ id: h.id as string, orden: i + 1 }));
  const pos = lista.findIndex((h) => h.id === id);
  const otro = pos + dir;
  if (otro < 0 || otro >= lista.length) return {};
  [lista[pos], lista[otro]] = [lista[otro], lista[pos]];
  for (let i = 0; i < lista.length; i++) {
    const { error } = await supabase.from(tabla).update({ orden: i + 1 }).eq("id", lista[i].id);
    if (error) return { error: errorDB(error) };
  }
  refrescar();
  return {};
}
export async function moverInstrumental(fd: FormData) {
  return mover("instrumentales", "caja_id", fd);
}

// ================= PARTES / MEDIDAS =================
export async function guardarParte(fd: FormData): Promise<Resultado> {
  await exigirAdmin();
  const supabase = await crearClienteServidor();
  const id = txt(fd, "id");
  const datos = {
    codigo_o_medida: txt(fd, "codigo_o_medida"),
    nombre: txt(fd, "nombre"),
    cant_por_unidad: ent(fd, "cant_por_unidad", 1),
    nota: txt(fd, "nota"),
  };
  if (!datos.codigo_o_medida || !datos.cant_por_unidad) return { error: "Completá código/medida y cantidad (≥ 1)." };
  if (id) {
    const { error } = await supabase.from("partes").update(datos).eq("id", id);
    if (error) return { error: errorDB(error) };
    refrescar();
    return { ok: "Guardado." };
  }
  const instrumental_id = txt(fd, "instrumental_id")!;
  const { data: ultimo } = await supabase
    .from("partes")
    .select("orden")
    .eq("instrumental_id", instrumental_id)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("partes").insert({ ...datos, instrumental_id, orden: (ultimo?.orden ?? 0) + 1 });
  if (error) return { error: errorDB(error) };
  refrescar();
  return { ok: "Agregado." };
}

/** Crea varias medidas de una: ej. Ø44 a Ø60 de a 2. */
export async function agregarRangoMedidas(fd: FormData): Promise<Resultado> {
  await exigirAdmin();
  const supabase = await crearClienteServidor();
  const instrumental_id = txt(fd, "instrumental_id")!;
  const prefijo = txt(fd, "prefijo") ?? "";
  const desde = Number(fd.get("desde"));
  const hasta = Number(fd.get("hasta"));
  const paso = Number(fd.get("paso"));
  const cant = ent(fd, "cant_por_unidad", 1) ?? 1;
  if (!Number.isFinite(desde) || !Number.isFinite(hasta) || !(paso > 0) || hasta < desde) return { error: "Revisá desde / hasta / paso." };
  const cantidad = Math.floor((hasta - desde) / paso + 1e-9) + 1;
  if (cantidad > 60) return { error: "Son demasiadas medidas (máx. 60)." };
  const { data: ultimo } = await supabase
    .from("partes")
    .select("orden")
    .eq("instrumental_id", instrumental_id)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  const base = ultimo?.orden ?? 0;
  const filas = Array.from({ length: cantidad }, (_, k) => ({
    instrumental_id,
    codigo_o_medida: `${prefijo}${+(desde + k * paso).toFixed(2)}`,
    cant_por_unidad: cant,
    orden: base + k + 1,
  }));
  const { error } = await supabase.from("partes").insert(filas);
  if (error) return { error: errorDB(error) };
  refrescar();
  return { ok: `Se agregaron ${cantidad} medidas.` };
}

export async function borrarParte(fd: FormData): Promise<Resultado> {
  await exigirAdmin();
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("partes").delete().eq("id", txt(fd, "id")!);
  if (error) return { error: errorDB(error) };
  refrescar();
  return {};
}

export async function moverParte(fd: FormData) {
  return mover("partes", "instrumental_id", fd);
}

// ================= NOTAS =================
export async function agregarNota(fd: FormData): Promise<Resultado> {
  await exigirAdmin();
  const supabase = await crearClienteServidor();
  const texto = txt(fd, "texto");
  if (!texto) return { error: "Escribí la nota." };
  const { error } = await supabase
    .from("notas")
    .insert({ instrumental_id: txt(fd, "instrumental_id")!, tipo: txt(fd, "tipo") ?? "General", texto });
  if (error) return { error: errorDB(error) };
  refrescar();
  return { ok: "Nota agregada." };
}

export async function borrarNota(fd: FormData): Promise<Resultado> {
  await exigirAdmin();
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("notas").delete().eq("id", txt(fd, "id")!);
  if (error) return { error: errorDB(error) };
  refrescar();
  return {};
}

// ================= PLANOS =================
export async function borrarPlano(fd: FormData): Promise<Resultado> {
  await exigirAdmin();
  const supabase = await crearClienteServidor();
  const id = txt(fd, "id")!;
  await borrarArchivosPlanos(supabase, "id", id);
  const { error } = await supabase.from("planos").delete().eq("id", id);
  if (error) return { error: errorDB(error) };
  refrescar();
  return {};
}

export async function renombrarPlano(fd: FormData): Promise<Resultado> {
  await exigirAdmin();
  const supabase = await crearClienteServidor();
  const nombre = txt(fd, "nombre");
  if (!nombre) return { error: "El nombre no puede quedar vacío." };
  const { error } = await supabase.from("planos").update({ nombre }).eq("id", txt(fd, "id")!);
  if (error) return { error: errorDB(error) };
  refrescar();
  return { ok: "Guardado." };
}

// ================= USUARIOS =================
export async function invitarUsuario(fd: FormData): Promise<Resultado> {
  await exigirAdmin();
  const email = txt(fd, "email");
  const nombre = txt(fd, "nombre") ?? "";
  const rol = txt(fd, "rol") === "admin" ? "admin" : "operario";
  if (!email) return { error: "Completá el email." };
  const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  try {
    const admin = crearClienteAdmin();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { nombre },
      redirectTo: `${sitio}/auth/nueva-clave`,
    });
    if (error) return { error: error.message };
    await admin.from("perfiles").update({ rol, nombre }).eq("id", data.user.id);
  } catch (e) {
    return { error: (e as Error).message };
  }
  refrescar();
  return { ok: `Invitación enviada a ${email}.` };
}

/** Alternativa sin email: el admin crea el usuario con una contraseña inicial y se la pasa al operario. */
export async function crearUsuarioConClave(fd: FormData): Promise<Resultado> {
  await exigirAdmin();
  const email = txt(fd, "email");
  const clave = String(fd.get("clave") ?? "");
  const nombre = txt(fd, "nombre") ?? "";
  const rol = txt(fd, "rol") === "admin" ? "admin" : "operario";
  if (!email || clave.length < 8) return { error: "Completá el email y una contraseña de al menos 8 caracteres." };
  try {
    const admin = crearClienteAdmin();
    const { data, error } = await admin.auth.admin.createUser({ email, password: clave, email_confirm: true, user_metadata: { nombre } });
    if (error) return { error: error.message };
    await admin.from("perfiles").update({ rol, nombre }).eq("id", data.user.id);
  } catch (e) {
    return { error: (e as Error).message };
  }
  refrescar();
  return { ok: `Usuario ${email} creado.` };
}

export async function cambiarRol(fd: FormData): Promise<Resultado> {
  const yo = await exigirAdmin();
  const id = txt(fd, "id")!;
  const rol = txt(fd, "rol") === "admin" ? "admin" : "operario";
  if (id === yo.id && rol !== "admin") return { error: "No podés quitarte el rol de admin a vos mismo." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("perfiles").update({ rol, nombre: txt(fd, "nombre") ?? "" }).eq("id", id);
  if (error) return { error: errorDB(error) };
  refrescar();
  return { ok: "Guardado." };
}
