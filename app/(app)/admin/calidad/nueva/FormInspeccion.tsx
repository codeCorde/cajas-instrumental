"use client";
import { useMemo, useState } from "react";
import FormAccion from "@/components/FormAccion";
import { RESULTADO_LABEL, type EntidadInspeccion, type MedidaControlada, type PlantillaCalidad, type Resultado } from "@/lib/tipos";
import { crearInspeccion } from "../acciones";

type Opcion = { id: string; etiqueta: string; instrumentalId?: string };

export default function FormInspeccion({
  opciones,
  plantillas,
  motivos,
  hoy,
  inicial,
  pedidos,
}: {
  opciones: Record<EntidadInspeccion, Opcion[]>;
  plantillas: PlantillaCalidad[];
  motivos: string[];
  hoy: string;
  inicial: { entidad: EntidadInspeccion; id: string | null };
  pedidos: Opcion[];
}) {
  const [entidad, setEntidad] = useState<EntidadInspeccion>(inicial.entidad);
  const [entidadId, setEntidadId] = useState(inicial.id ?? "");
  const instrumentalId = useMemo(() => {
    if (entidad === "instrumental") return entidadId;
    if (entidad === "componente") return opciones.componente.find((o) => o.id === entidadId)?.instrumentalId ?? "";
    return "";
  }, [entidad, entidadId, opciones]);
  const sugeridas = plantillas.filter((p) => !p.instrumental_id || p.instrumental_id === instrumentalId);
  const [plantillaId, setPlantillaId] = useState(sugeridas.find((p) => p.instrumental_id)?.id ?? sugeridas[0]?.id ?? "");
  const plantilla = plantillas.find((p) => p.id === plantillaId);
  const [marcas, setMarcas] = useState<Record<string, boolean>>({});
  const [medidas, setMedidas] = useState<MedidaControlada[]>([{ cota: "", nominal: "", tolerancia: "", medido: "", ok: true }]);
  const [resultado, setResultado] = useState<Resultado>("conforme");
  const checklist = (plantilla?.items ?? []).map((item) => ({ item, ok: marcas[item] ?? true }));
  const etiquetaEntidad = opciones[entidad].find((o) => o.id === entidadId)?.etiqueta ?? "";

  const setMedida = (n: number, cambios: Partial<MedidaControlada>) => setMedidas(medidas.map((m, i) => (i === n ? { ...m, ...cambios } : m)));

  return (
    <FormAccion accion={crearInspeccion} className="grid gap-4 sm:grid-cols-2" textoBoton="Guardar inspección" limpiar={false}>
      <input type="hidden" name="checklist" value={JSON.stringify(checklist)} />
      <input type="hidden" name="medidas" value={JSON.stringify(medidas)} />
      <input type="hidden" name="descripcion_entidad" value={etiquetaEntidad} />

      <fieldset className="sm:col-span-2 grid gap-3 sm:grid-cols-[12rem_1fr]">
        <legend className="etiqueta">Qué se inspecciona</legend>
        <select
          name="entidad"
          value={entidad}
          onChange={(e) => {
            setEntidad(e.target.value as EntidadInspeccion);
            setEntidadId("");
          }}
          className="campo"
          aria-label="Tipo"
        >
          <option value="instrumental">Instrumental</option>
          <option value="componente">Pieza o medida</option>
          <option value="caja">Caja armada</option>
          <option value="pedido">Pedido</option>
        </select>
        <select name="entidad_id" value={entidadId} onChange={(e) => setEntidadId(e.target.value)} className="campo" required aria-label="Cuál">
          <option value="" disabled>
            Elegí…
          </option>
          {opciones[entidad].map((o) => (
            <option key={o.id} value={o.id}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      </fieldset>

      <label>
        <span className="etiqueta">Fecha</span>
        <input type="date" name="fecha" defaultValue={hoy} className="campo" />
      </label>
      {entidad !== "pedido" && (
        <label>
          <span className="etiqueta">Pedido (opcional)</span>
          <select name="pedido_id" className="campo" defaultValue="">
            <option value="">—</option>
            {pedidos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.etiqueta}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        <span className="etiqueta">Cantidad inspeccionada</span>
        <input type="number" name="cantidad" min={1} className="campo font-mono" />
      </label>
      <label>
        <span className="etiqueta">Lote</span>
        <input name="lote" className="campo font-mono" />
      </label>

      <fieldset className="sm:col-span-2 space-y-2">
        <legend className="etiqueta">Checklist</legend>
        <select value={plantillaId} onChange={(e) => setPlantillaId(e.target.value)} className="campo" aria-label="Plantilla de checklist">
          <option value="">Sin checklist</option>
          {sugeridas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
              {p.instrumental_id ? " (de este instrumental)" : ""}
            </option>
          ))}
        </select>
        <ul className="grid gap-1 sm:grid-cols-2">
          {checklist.map((c) => (
            <li key={c.item}>
              <label className={`flex items-center gap-2 rounded border px-3 py-2 ${c.ok ? "border-borde" : "border-falta bg-falta-bg"}`}>
                <input type="checkbox" checked={c.ok} onChange={(e) => setMarcas({ ...marcas, [c.item]: e.target.checked })} className="w-5 h-5" />
                <span className="text-sm">{c.item}</span>
                <span className={`ml-auto text-xs font-semibold ${c.ok ? "text-disponible" : "text-falta"}`}>{c.ok ? "✓ OK" : "✕ No OK"}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className="sm:col-span-2 space-y-2">
        <legend className="etiqueta">Medidas controladas</legend>
        <div className="overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Cota</th>
                <th>Nominal</th>
                <th>Tolerancia</th>
                <th>Medido</th>
                <th>OK</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {medidas.map((m, n) => (
                <tr key={n}>
                  {(["cota", "nominal", "tolerancia", "medido"] as const).map((k) => (
                    <td key={k}>
                      <input value={m[k]} onChange={(e) => setMedida(n, { [k]: e.target.value })} className="campo min-h-9 py-1 font-mono" aria-label={`${k} ${n + 1}`} placeholder={k === "tolerancia" ? "±0,05" : ""} />
                    </td>
                  ))}
                  <td>
                    <input type="checkbox" checked={m.ok} onChange={(e) => setMedida(n, { ok: e.target.checked })} className="w-5 h-5" aria-label={`Medida ${n + 1} OK`} />
                  </td>
                  <td>
                    <button type="button" className="btn min-h-9 px-2" onClick={() => setMedidas(medidas.filter((_, i) => i !== n))} aria-label={`Quitar medida ${n + 1}`}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="btn text-sm" onClick={() => setMedidas([...medidas, { cota: "", nominal: "", tolerancia: "", medido: "", ok: true }])}>
          + Otra medida
        </button>
      </fieldset>

      <fieldset className="sm:col-span-2">
        <legend className="etiqueta">Resultado</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(RESULTADO_LABEL) as Resultado[]).map((r) => (
            <label
              key={r}
              className={`btn min-h-12 justify-start ${resultado === r ? (r === "conforme" ? "border-disponible bg-disponible-bg text-disponible" : r === "observaciones" ? "border-proceso bg-proceso-bg text-proceso" : "border-falta bg-falta-bg text-falta") : ""}`}
            >
              <input type="radio" name="resultado" value={r} checked={resultado === r} onChange={() => setResultado(r)} className="w-4 h-4" />
              {r === "conforme" ? "✓" : r === "observaciones" ? "◐" : "✕"} {RESULTADO_LABEL[r]}
            </label>
          ))}
        </div>
      </fieldset>

      {resultado !== "conforme" && (
        <label>
          <span className="etiqueta">Motivo</span>
          <select name="motivo" className="campo" defaultValue="">
            <option value="">—</option>
            {motivos.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
      )}
      <label className="sm:col-span-2">
        <span className="etiqueta">Observaciones</span>
        <textarea name="observaciones" className="campo" rows={3} />
      </label>
      {resultado !== "conforme" && (
        <label className="sm:col-span-2">
          <span className="etiqueta">Acción correctiva</span>
          <textarea name="accion_correctiva" className="campo" rows={2} placeholder="Qué se hace para corregirlo" />
        </label>
      )}
      <p className="sm:col-span-2 text-xs text-tenue">Las fotos y archivos se adjuntan después de guardar, en la ficha de la inspección.</p>
    </FormAccion>
  );
}
