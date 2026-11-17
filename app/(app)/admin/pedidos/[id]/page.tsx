import { redirect } from "next/navigation";

// Los pedidos ahora viven en Producción.
export default async function PedidoViejoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/produccion/pedido/${encodeURIComponent(id)}`);
}
