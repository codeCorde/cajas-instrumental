import type { Tipo } from "./calculos";

export type Rol = "admin" | "operario";
export type Origen = "propio" | "tercerizado";
export type Motivo = "carga" | "correccion" | "armado_caja" | "entrega";
export type CampoStock = "stock_terminado" | "unidades_armadas" | "stock_parte";

export interface Perfil {
  id: string;
  nombre: string;
  email: string | null;
  rol: Rol;
}

export interface Caja {
  id: string;
  numero: number;
  nombre: string;
  foto_url: string | null;
  cajas_armadas: number;
  activa: boolean;
  ejemplo: boolean;
}

export interface Parte {
  id: string;
  instrumental_id: string;
  codigo_o_medida: string;
  nombre: string | null;
  cant_por_unidad: number;
  stock: number;
  nota: string | null;
  orden: number;
  ejemplo: boolean;
}

export interface Nota {
  id: string;
  instrumental_id: string;
  tipo: string;
  texto: string;
  creado_en: string;
}

export interface Instrumental {
  id: string;
  caja_id: string;
  codigo: string;
  nombre: string;
  alias: string | null;
  tipo: Tipo;
  cant_por_caja: number;
  stock_terminado: number;
  unidades_armadas: number;
  material: string | null;
  terminacion: string | null;
  barra: string | null;
  origen: Origen;
  proveedor: string | null;
  foto_url: string | null;
  link_2d: string | null;
  link_3d: string | null;
  link_cnc: string | null;
  link_fotos: string | null;
  orden: number;
  ejemplo: boolean;
  partes: Parte[];
  notas?: Nota[];
}

export interface CajaCompleta extends Caja {
  instrumentales: Instrumental[];
}

export interface Movimiento {
  id: number;
  creado_en: string;
  usuario_nombre: string | null;
  caja_id: string | null;
  caja_nombre: string | null;
  instrumental_nombre: string | null;
  parte_nombre: string | null;
  campo: string;
  delta: number;
  stock_resultante: number;
  motivo: Motivo;
  nota: string | null;
}

export const MOTIVO_LABEL: Record<Motivo, string> = {
  carga: "Carga",
  correccion: "Corrección",
  armado_caja: "Armado de caja",
  entrega: "Entrega",
};

export const CAMPO_LABEL: Record<string, string> = {
  stock_terminado: "Stock terminado",
  unidades_armadas: "Unidades armadas",
  stock_parte: "Stock medida/parte",
  cajas_armadas: "Cajas armadas",
};

export const TIPO_LABEL: Record<Tipo, string> = {
  simple: "Simple",
  medidas: "Medidas",
  complejo: "Complejo",
};

export const TIPOS_NOTA = ["General", "Herramienta", "Medición", "Proceso", "Calidad", "Proveedor"];

// ---------------- Novedades (registro de cambios) ----------------
export type OrigenNovedad = "app" | "manual" | "claude" | "sistema";

export interface Novedad {
  id: number;
  creado_en: string;
  autor_nombre: string | null;
  origen: OrigenNovedad;
  seccion: string;
  titulo: string;
  detalle: string | null;
}

export const ORIGEN_NOVEDAD_LABEL: Record<OrigenNovedad, string> = {
  app: "Automática",
  manual: "Nota",
  claude: "Claude",
  sistema: "Versión",
};

export const SECCION_NOVEDAD_LABEL: Record<string, string> = {
  cajas: "Caja",
  instrumentales: "Instrumental",
  partes: "Medida/parte",
  planos: "Plano",
  notas: "Nota fabr.",
  tareas: "Tarea",
  codigo: "App",
  general: "General",
};

// ---------------- Tareas de mejora ----------------
export type Prioridad = "alta" | "media" | "baja";

export interface Tarea {
  id: string;
  titulo: string;
  detalle: string | null;
  medico: string | null;
  caja_id: string | null;
  instrumental_id: string | null;
  prioridad: Prioridad;
  hecha: boolean;
  hecha_en: string | null;
  hecha_por_nombre: string | null;
  creado_por_nombre: string | null;
  creado_en: string;
  caja: { id: string; numero: number; nombre: string } | null;
  instrumental: { id: string; codigo: string; nombre: string } | null;
}

export const PRIORIDAD_LABEL: Record<Prioridad, string> = { alta: "Alta", media: "Media", baja: "Baja" };
export const PRIORIDAD_ORDEN: Record<Prioridad, number> = { alta: 0, media: 1, baja: 2 };
