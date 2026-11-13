import "server-only";
import { revalidatePath } from "next/cache";
import type { ResultadoAccion } from "@/components/FormAccion";

/** Corre una Server Action y convierte las excepciones en { ok:false, error } con texto legible. */
export async function seguro(fn: () => Promise<void | { ir?: string; mensaje?: string }>): Promise<ResultadoAccion> {
  try {
    const r = await fn();
    revalidatePath("/", "layout");
    return { ok: true, ...(r ?? {}) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/duplicate key|unique/i.test(msg)) return { ok: false, error: "Ya existe uno con ese código o nombre." };
    if (/violates check constraint/i.test(msg)) return { ok: false, error: "Algún dato no es válido (revisá códigos y cantidades)." };
    if (/foreign key/i.test(msg)) return { ok: false, error: "No se puede: está en uso en otro lado (por ejemplo, en un pedido)." };
    return { ok: false, error: msg };
  }
}

export const texto = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const textoONull = (fd: FormData, k: string) => texto(fd, k) || null;
export function entero(fd: FormData, k: string, min = 0): number {
  const n = Number(texto(fd, k));
  if (!Number.isInteger(n) || n < min) throw new Error(`"${k}" tiene que ser un número entero ≥ ${min}.`);
  return n;
}
export function obligatorio(fd: FormData, k: string, nombre = k): string {
  const v = texto(fd, k);
  if (!v) throw new Error(`Falta ${nombre}.`);
  return v;
}
