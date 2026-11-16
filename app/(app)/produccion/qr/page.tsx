import { qrSvg, urlBase } from "@/lib/qr";
import BotonImprimir from "@/components/BotonImprimir";
import MarcaInstrumentARG from "@/components/MarcaInstrumentARG";

/** QR para hacer pedidos (abre /pedir, sin contraseña). Para imprimir y dejar a la vista de quien pide. */
export default async function QrPedidosPage() {
  const url = `${await urlBase()}/pedir`;
  const svg = await qrSvg(url);
  return (
    <div className="space-y-4">
      <div className="no-imprimir flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="titulo text-3xl">QR de pedidos</h2>
          <p className="text-sm text-tenue">Quien lo escanee puede hacer un pedido sin contraseña. Los pedidos llegan a «Órdenes de producción» para recepcionar.</p>
        </div>
        <BotonImprimir />
      </div>
      <div className="card mx-auto p-10 bg-white text-black text-center space-y-6" style={{ maxWidth: "19cm" }}>
        <MarcaInstrumentARG />
        <div className="mx-auto w-[12cm] max-w-full [&_svg]:w-full [&_svg]:h-auto" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="text-2xl font-semibold">Escaneá para hacer tu pedido</p>
        <p className="font-mono text-xs break-all">{url}</p>
      </div>
    </div>
  );
}
