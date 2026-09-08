"use client";

// Filtros GxC — la MISMA interacción de chips del Despachos
// (ParametrizedFilterBar: estado en la URL, chips de texto multi-valor y
// rango de fechas), traducida al objeto p_filtros de las funciones GxC
// (migración 062). Claves de URL idénticas a shipping para reusar las
// etiquetas estándar de searchbar (Patente, RUT conductor, Origen…).
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import ParametrizedFilterBar from "@/features/layout/components/secured-navbar/searchbar/parametrized-filter-bar";
import type { NavParam } from "@/features/layout/components/secured-navbar/searchbar/navegation_params";
import { trDynamic } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

const DIA_MS = 86_400_000;

/** URL param → clave del objeto p_filtros (mismas claves que shipping) */
const PARAM_A_FILTRO: Record<string, string> = {
  licensePlate: "patentes",
  driverId: "conductores",
  carrierName: "carriers",
  origin: "origenes",
  destination: "destinos",
};

const LABEL_FALLBACK: Record<string, string> = {
  licensePlate: "Patente",
  driverId: "RUT conductor",
  carrierName: "Transportista",
  origin: "Origen",
  destination: "Destino",
  date_range: "Rango de fechas",
};

export function gxcFilterParams(dict: I18nRecord, carrierMode: boolean): NavParam[] {
  const sb = (dict as Record<string, unknown>)?.searchbar as I18nRecord | undefined;
  const label = (k: string) => {
    const t = sb ? trDynamic(k, sb) : k;
    return !t || t === k ? LABEL_FALLBACK[k] ?? k : t;
  };
  const keys = Object.keys(PARAM_A_FILTRO)
    .filter((k) => !(carrierMode && k === "carrierName"));
  return [
    ...keys.map((k) => ({
      label: label(k),
      param: { key: k, type: "text" },
      unique: false,
    })),
    { label: label("date_range"), param: { key: "date_range", type: "date_range" }, unique: false },
  ];
}

export type GxcFiltros = {
  /** objeto p_filtros o null si no hay filtros de dimensión */
  filtros: Record<string, string[]> | null;
  /** true si hay cualquier filtro activo (dimensión o fechas) */
  activo: boolean;
  /** query-string de período+filtros para las RPCs: p_dias=…[&p_fin=…][&p_filtros=…] */
  q: (diasChips: number) => string;
  /** días efectivos (rango de fechas pisa los chips de período) */
  diasEfectivos: (diasChips: number) => number;
  conRango: boolean;
};

export function useGxcFiltros(carrierMode = false): GxcFiltros {
  const sp = useSearchParams();
  const spKey = sp.toString();

  return useMemo(() => {
    const filtros: Record<string, string[]> = {};
    for (const [param, clave] of Object.entries(PARAM_A_FILTRO)) {
      if (carrierMode && clave === "carriers") continue;
      const raw = sp.get(param);
      if (!raw) continue;
      const vals = raw.split(",").map((v) => v.trim()).filter(Boolean);
      if (vals.length) filtros[clave] = vals;
    }
    const tieneDim = Object.keys(filtros).length > 0;

    // Rango de fechas → p_fin (epoch s, fin exclusivo) + p_dias derivados.
    const from = sp.get("date_range_from");
    const to = sp.get("date_range_to");
    let rango: { fin: number | null; dias: number | null } | null = null;
    if (from || to) {
      const iniMs = from ? new Date(`${from}T00:00:00`).getTime() : null;
      // fin exclusivo = día siguiente al 'to' a las 00:00; sin 'to' = ahora
      const finMs = to ? new Date(`${to}T00:00:00`).getTime() + DIA_MS : null;
      const dias = iniMs != null
        ? Math.max(1, Math.round(((finMs ?? Date.now()) - iniMs) / DIA_MS))
        : null;
      rango = { fin: finMs != null ? Math.round(finMs / 1000) : null, dias };
    }

    const diasEfectivos = (diasChips: number) => rango?.dias ?? diasChips;
    const q = (diasChips: number) => {
      let s = `p_dias=${diasEfectivos(diasChips)}`;
      if (rango?.fin != null) s += `&p_fin=${rango.fin}`;
      if (tieneDim) s += `&p_filtros=${encodeURIComponent(JSON.stringify(filtros))}`;
      return s;
    };

    return {
      filtros: tieneDim ? filtros : null,
      activo: tieneDim || rango != null,
      q,
      diasEfectivos,
      conRango: rango != null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spKey, carrierMode]);
}

export function GxcFiltrosBar({ dict, carrierMode = false }: {
  dict: I18nRecord; carrierMode?: boolean;
}) {
  const params = useMemo(() => gxcFilterParams(dict, carrierMode), [dict, carrierMode]);
  return <ParametrizedFilterBar dict={dict} navegation_params={params} />;
}
