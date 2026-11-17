import "server-only";
import { archivosDe, cargarCatalogo, composicionDe } from "./datos";
import { componentesDe, infoFaltante, type ClaveFaltante } from "./calculos";

export interface PiezaConFaltantes {
  instId: string;
  codigo: string;
  nombre: string;
  caja: string;
  cajaCodigo: string;
  preguntas: { clave: ClaveFaltante; pregunta: string }[];
}

/** Toda la información que falta cargar, pieza por pieza, en el orden de las cajas (una pieza compartida aparece una vez). */
export async function cargarFaltantes(): Promise<PiezaConFaltantes[]> {
  const cat = await cargarCatalogo();
  const ids = cat.instrumentales.map((i) => i.id);
  const compIds = cat.instrumentales.flatMap((i) => i.componentes.map((c) => c.id));
  const [arch, archComp] = await Promise.all([archivosDe("instrumental", ids), archivosDe("componente", compIds)]);
  const vistos = new Set<string>();
  const out: PiezaConFaltantes[] = [];
  for (const caja of cat.cajas) {
    for (const { inst } of composicionDe(cat, caja.id)) {
      if (vistos.has(inst.id)) continue;
      vistos.add(inst.id);
      const partes = componentesDe(inst) as typeof inst.componentes;
      const archivos = [
        ...arch.filter((a) => a.entidad_id === inst.id && a.vigente),
        ...archComp.filter((a) => a.vigente && partes.some((p) => p.id === a.entidad_id)),
      ].map((a) => a.tipo);
      const preguntas = infoFaltante({
        nombre: inst.nombre,
        tipo: inst.tipo,
        origen: inst.origen,
        a_confirmar: inst.a_confirmar,
        proceso: inst.proceso,
        maquina: inst.maquina,
        herramientas: inst.herramientas,
        etapa: inst.etapa,
        partes: partes.map((p) => ({ nombre: p.nombre ? `${p.codigo_o_medida} ${p.nombre}` : p.codigo_o_medida, etapa: p.etapa })),
        archivos,
      });
      if (preguntas.length) out.push({ instId: inst.id, codigo: inst.codigo, nombre: inst.nombre, caja: caja.nombre, cajaCodigo: caja.codigo, preguntas });
    }
  }
  return out;
}

/** N preguntas para un recordatorio, rotando según el día y el horario para no repetir siempre las mismas. */
export function elegirPreguntas(faltantes: PiezaConFaltantes[], n: number, semilla: number): string[] {
  const todas = faltantes.flatMap((f) => f.preguntas.map((p) => p.pregunta));
  if (todas.length === 0) return [];
  const desde = (semilla * n) % todas.length;
  return Array.from({ length: Math.min(n, todas.length) }, (_, i) => todas[(desde + i) % todas.length]);
}
