// Tipos de las tablas del esquema "taller".

export type TipoInstrumental = "simple" | "medidas" | "complejo";
export type ClaseComponente = "medida" | "pieza";
export type Origen = "propia" | "tercerizado";

export interface Caja {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  foto_path: string | null;
  cajas_armadas: number;
  orden: number;
  activa: boolean;
}

export interface Componente {
  id: string;
  instrumental_id: string;
  clase: ClaseComponente;
  codigo_o_medida: string;
  nombre: string | null;
  cant_por_unidad: number;
  stock: number;
  descripcion: string | null;
  proceso: string | null;
  orden: number;
}

export interface Instrumental {
  id: string;
  codigo: string;
  nombre: string;
  alias: string | null;
  tipo: TipoInstrumental;
  stock_terminado: number;
  unidades_armadas: number;
  material: string | null;
  terminacion: string | null;
  origen: Origen;
  proveedor: string | null;
  foto_path: string | null;
  descripcion: string | null;
  proceso: string | null;
  a_confirmar: boolean;
  orden: number;
  componentes: Componente[];
}

export interface Composicion {
  caja_id: string;
  instrumental_id: string;
  cant_por_caja: number;
  orden: number;
}

export type EntidadArchivo = "instrumental" | "componente" | "caja" | "calidad" | "sin_clasificar";
export interface Archivo {
  id: string;
  entidad: EntidadArchivo;
  entidad_id: string;
  nombre: string;
  tipo: string;
  tamano: number;
  storage_path: string;
  vigente: boolean;
  subido_por: string | null;
  creado_en: string;
}

export const TIPOS_NOTA = ["General", "Herramienta", "Medición", "Proceso", "Proveedor"] as const;
export type TipoNota = (typeof TIPOS_NOTA)[number];
export interface Nota {
  id: string;
  instrumental_id: string;
  componente_id: string | null;
  tipo: TipoNota;
  texto: string;
  autor: string | null;
  creado_en: string;
}

export type Motivo = "carga" | "correccion" | "armado_instrumental" | "armado_caja" | "desarmado" | "entrega";
export const MOTIVO_LABEL: Record<Motivo, string> = {
  carga: "Carga",
  correccion: "Corrección",
  armado_instrumental: "Armado de instrumental",
  armado_caja: "Armado de caja",
  desarmado: "Desarmado",
  entrega: "Entrega",
};
export type CampoStock = "stock_terminado" | "unidades_armadas" | "stock" | "cajas_armadas";
export const CAMPO_LABEL: Record<CampoStock, string> = {
  stock_terminado: "Stock terminado",
  unidades_armadas: "Unidades armadas",
  stock: "Medida / pieza",
  cajas_armadas: "Cajas armadas",
};
export interface Movimiento {
  id: number;
  creado_en: string;
  autor: string;
  caja_id: string | null;
  instrumental_id: string | null;
  componente_id: string | null;
  caja_nombre: string | null;
  instrumental_nombre: string | null;
  componente_nombre: string | null;
  campo: CampoStock;
  delta: number;
  stock_resultante: number;
  motivo: Motivo;
  nota: string | null;
}

export type EstadoPedido = "pendiente" | "en_produccion" | "listo" | "entregado" | "cancelado";
export const ESTADO_PEDIDO_LABEL: Record<EstadoPedido, string> = {
  pendiente: "Pendiente",
  en_produccion: "En producción",
  listo: "Listo",
  entregado: "Entregado",
  cancelado: "Cancelado",
};
export interface PedidoItem {
  id: string;
  pedido_id: string;
  caja_id: string;
  cantidad: number;
}
export interface Pedido {
  id: string;
  numero: string;
  cliente: string;
  fecha_pedido: string;
  fecha_compromiso: string | null;
  estado: EstadoPedido;
  notas: string | null;
  entregado_en: string | null;
  items: PedidoItem[];
}

export type Resultado = "conforme" | "observaciones" | "no_conforme";
export const RESULTADO_LABEL: Record<Resultado, string> = {
  conforme: "Conforme",
  observaciones: "Conforme con observaciones",
  no_conforme: "No conforme",
};
export type EntidadInspeccion = "instrumental" | "componente" | "caja" | "pedido";
export interface ItemChecklist {
  item: string;
  ok: boolean;
}
export interface MedidaControlada {
  cota: string;
  nominal: string;
  tolerancia: string;
  medido: string;
  ok: boolean;
}
export interface Inspeccion {
  id: string;
  fecha: string;
  inspector: string;
  entidad: EntidadInspeccion;
  entidad_id: string;
  instrumental_id: string | null;
  caja_id: string | null;
  pedido_id: string | null;
  cantidad: number | null;
  lote: string | null;
  resultado: Resultado;
  motivo: string | null;
  checklist: ItemChecklist[];
  medidas: MedidaControlada[];
  observaciones: string | null;
  accion_correctiva: string | null;
  accion_cerrada: boolean;
  cerrada_en: string | null;
  cerrada_por: string | null;
  creado_en: string;
}
export interface PlantillaCalidad {
  id: string;
  instrumental_id: string | null;
  nombre: string;
  items: string[];
}

export interface Persona {
  id: string;
  nombre: string;
  activa: boolean;
}

export interface Apariencia {
  empresa: string;
  color: string;
  logo_path: string | null;
  modo: "claro" | "oscuro" | "auto";
}

export interface SinClasificar {
  id: string;
  caja_id: string | null;
  nombre: string;
  nota: string | null;
}

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
  hecha_por: string | null;
  creado_por: string | null;
  creado_en: string;
}
export interface Novedad {
  id: number;
  creado_en: string;
  autor: string;
  origen: "app" | "manual" | "claude" | "sistema";
  seccion: string;
  titulo: string;
  detalle: string | null;
}
export interface Mensaje {
  id: number;
  autor: string;
  texto: string;
  creado_en: string;
}
