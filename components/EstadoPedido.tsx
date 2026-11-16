import { ESTADO_PEDIDO_LABEL, type EstadoPedido } from "@/lib/tipos";

// Colores pedidos en las fotos: Finalizado en letras naranjas, Entregado en letras verdes. Siempre con ícono.
export const ESTADO_PEDIDO_ESTILO: Record<EstadoPedido, { clase: string; icono: string }> = {
  pendiente: { clase: "bg-acento/10 text-acento", icono: "○" },
  en_produccion: { clase: "bg-superficie-2 text-texto", icono: "◐" },
  listo: { clase: "bg-proceso-bg text-proceso", icono: "■" },
  entregado: { clase: "bg-disponible-bg text-disponible", icono: "✓" },
  cancelado: { clase: "bg-sin-bg text-sin line-through", icono: "✕" },
};

export function EstadoPedidoChip({ estado, chico }: { estado: EstadoPedido; chico?: boolean }) {
  const e = ESTADO_PEDIDO_ESTILO[estado];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap ${e.clase} ${chico ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-sm"}`}>
      <span aria-hidden="true" className="font-mono no-underline">
        {e.icono}
      </span>
      {ESTADO_PEDIDO_LABEL[estado]}
    </span>
  );
}
