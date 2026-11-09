"use client";
// Estado "en vivo" de una caja en el navegador: aplica los + / − al instante
// (actualización optimista) y los revierte si la RPC falla.

import { useCallback, useEffect, useRef, useState } from "react";
import { crearClienteNavegador } from "./supabase/client";
import { planArmadoCaja } from "./armado";
import type { CajaCompleta, CampoStock } from "./tipos";

export interface Aviso {
  tipo: "error" | "ok";
  texto: string;
}

function leer(c: CajaCompleta, instId: string, campo: CampoStock, parteId?: string | null): number {
  const i = c.instrumentales.find((x) => x.id === instId);
  if (!i) return 0;
  if (campo === "stock_parte") return i.partes.find((p) => p.id === parteId)?.stock ?? 0;
  return i[campo];
}

function escribir(c: CajaCompleta, instId: string, campo: CampoStock, parteId: string | null | undefined, valor: number): CajaCompleta {
  return {
    ...c,
    instrumentales: c.instrumentales.map((i) => {
      if (i.id !== instId) return i;
      if (campo === "stock_parte") return { ...i, partes: i.partes.map((p) => (p.id === parteId ? { ...p, stock: valor } : p)) };
      return { ...i, [campo]: valor };
    }),
  };
}

function mensajeError(e: { message?: string } | null): string {
  const m = e?.message ?? "";
  if (/fetch|network/i.test(m)) return "Sin conexión. No se guardó el cambio.";
  return m ? `No se guardó: ${m}` : "No se guardó el cambio.";
}

export function useCaja(inicial: CajaCompleta) {
  const [caja, setCajaState] = useState(inicial);
  const ref = useRef(inicial);
  const pendientes = useRef(new Map<string, number>());
  const [aviso, setAviso] = useState<Aviso | null>(null);

  const setCaja = useCallback((c: CajaCompleta) => {
    ref.current = c;
    setCajaState(c);
  }, []);

  // Si el servidor manda datos nuevos (router.refresh), los tomamos.
  useEffect(() => {
    if ([...pendientes.current.values()].every((v) => v === 0)) setCaja(inicial);
  }, [inicial, setCaja]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), aviso.tipo === "error" ? 6000 : 3000);
    return () => clearTimeout(t);
  }, [aviso]);

  /** + / − sobre stock terminado, unidades armadas o una medida/parte. */
  const ajustar = useCallback(
    async (instId: string, campo: CampoStock, delta: number, parteId?: string | null) => {
      const clave = `${instId}:${campo}:${parteId ?? ""}`;
      const actual = leer(ref.current, instId, campo, parteId);
      const nuevo = Math.max(0, actual + delta);
      const aplicado = nuevo - actual;
      if (aplicado === 0) return;

      setCaja(escribir(ref.current, instId, campo, parteId, nuevo));
      pendientes.current.set(clave, (pendientes.current.get(clave) ?? 0) + 1);

      const { data, error } = await crearClienteNavegador().rpc("ajustar_stock", {
        p_instrumental: instId,
        p_campo: campo,
        p_delta: aplicado,
        p_parte: parteId ?? null,
      });

      const quedan = (pendientes.current.get(clave) ?? 1) - 1;
      pendientes.current.set(clave, quedan);

      if (error) {
        const ahora = leer(ref.current, instId, campo, parteId);
        setCaja(escribir(ref.current, instId, campo, parteId, Math.max(0, ahora - aplicado)));
        setAviso({ tipo: "error", texto: mensajeError(error) });
        return;
      }
      // Sin otros cambios en vuelo: el valor del servidor manda (por si otro operario cargó a la vez).
      if (quedan === 0 && typeof data === "number") {
        setCaja(escribir(ref.current, instId, campo, parteId, data));
      }
    },
    [setCaja],
  );

  /** Suma una caja armada y descuenta el stock (RPC transaccional). */
  const armar = useCallback(
    async (nota?: string): Promise<{ ok: boolean; faltantes: string[] }> => {
      const { data, error } = await crearClienteNavegador().rpc("armar_caja", { p_caja: ref.current.id, p_nota: nota ?? null });
      if (error) {
        setAviso({ tipo: "error", texto: mensajeError(error) });
        return { ok: false, faltantes: [] };
      }
      const r = data as { ok: boolean; faltantes: string[]; cajas_armadas: number };
      if (!r.ok) return { ok: false, faltantes: r.faltantes };

      let c = ref.current;
      for (const d of planArmadoCaja(c.instrumentales).descuentos) {
        c = escribir(c, d.instrumentalId, d.campo, d.parteId, Math.max(0, leer(c, d.instrumentalId, d.campo, d.parteId) - d.cantidad));
      }
      setCaja({ ...c, cajas_armadas: r.cajas_armadas });
      setAviso({ tipo: "ok", texto: "Caja armada. Se descontó el stock." });
      return { ok: true, faltantes: [] };
    },
    [setCaja],
  );

  /** Resta una caja armada (entrega / venta). Solo baja el contador. */
  const entregar = useCallback(async () => {
    const antes = ref.current.cajas_armadas;
    if (antes <= 0) return;
    setCaja({ ...ref.current, cajas_armadas: antes - 1 });
    const { data, error } = await crearClienteNavegador().rpc("entregar_caja", { p_caja: ref.current.id });
    if (error) {
      setCaja({ ...ref.current, cajas_armadas: ref.current.cajas_armadas + 1 });
      setAviso({ tipo: "error", texto: mensajeError(error) });
      return;
    }
    if (typeof data === "number") setCaja({ ...ref.current, cajas_armadas: data });
  }, [setCaja]);

  return { caja, ajustar, armar, entregar, aviso, setAviso };
}
