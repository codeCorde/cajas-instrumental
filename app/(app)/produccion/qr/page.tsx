import { qrSvg, urlBase } from "@/lib/qr";
import { clavePedir } from "@/lib/pedidos";
import BotonAccion from "@/components/BotonAccion";
import { cambiarClavePedir } from "../../admin/config/acciones";
import BotonImprimir from "@/components/BotonImprimir";
import MarcaInstrumentARG from "@/components/MarcaInstrumentARG";

/** QR para hacer pedidos (abre /pedir, sin contraseña). Para imprimir y dejar a la vista de quien pide. */
export default async function QrPedidosPage() {
  const clave = await clavePedir();
  const url = `${await urlBase()}/pedir${clave ? `?k=${clave}` : ""}`;
  const svg = await qrSvg(url);
  return (
    <div className="space-y-4">
      <div className="no-imprimir flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="titulo text-3xl">QR de pedidos</h2>
          <p className="text-sm text-tenue">
            Solo quien tenga este QR (o su link) puede hacer pedidos; sin él la página no se abre. Los pedidos llegan a «Órdenes de producción» para recepcionar.
            Si el link se filtra, cambialo: los QR impresos dejan de funcionar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BotonAccion accion={cambiarClavePedir} className="btn btn-peligro" confirmar="¿Cambiar el link? Los QR impresos dejan de funcionar y hay que imprimir el nuevo." ok="Link cambiado: imprimí el QR nuevo">
            Cambiar link
          </BotonAccion>
          <BotonImprimir />
        </div>
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
