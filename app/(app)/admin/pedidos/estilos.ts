import type { EstadoPedido } from "@/lib/tipos";

export const ESTADO_PEDIDO_CLASE: Record<EstadoPedido, string> = {
  pendiente: "bg-proceso-bg text-proceso",
  en_produccion: "bg-acento/15 text-acento",
  listo: "bg-disponible-bg text-disponible",
  entregado: "bg-sin-bg text-sin",
  cancelado: "bg-sin-bg text-sin line-through",
};
