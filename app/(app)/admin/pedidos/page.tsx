import { redirect } from "next/navigation";

// Los pedidos ahora viven en Producción (QR de pedidos → órdenes → entregados).
export default function PedidosViejosPage() {
  redirect("/produccion");
}
