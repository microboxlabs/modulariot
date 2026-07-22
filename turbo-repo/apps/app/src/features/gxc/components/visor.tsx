"use client";

import "@/features/gemelo-common/gemelo.css";

// GxC v2 · N1 — VISOR: lo general. Una sola pregunta: ¿dónde se están
// produciendo consecuencias (atraso / carga incumplida / retrabajo) y en
// qué población conviene entrar? Línea base del período arriba (con el
// contraste con/sin señal SIEMPRE visible), una fila por población con su
// mix, sus cuadrantes y sus movers como puertas de entrada a N2/N3.
import { useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import { golFetcher as fetcher } from "@/features/gemelo-common/fetcher";
import { Stat } from "@/features/gemelo-common/ds-widgets";
import {
  TIPOS_GXC, TIPO_META, CUADRANTE_META, MIX_META,
  type PoblacionGxc, type EntidadGxc, pct, deltaTasa,
} from "../model";
import { usePeriodo, PeriodoChips } from "./periodo";
import { useCarrierMode } from "@/features/auth/hooks/use-carrier-mode";

const ORDEN_CUADRANTES = ["urgente", "punto_ciego", "monitoreo_roto", "ruido", "sano", "muestra_insuficiente"];

function MixBar({ atraso, carga, retrabajo }: { atraso: number; carga: number; retrabajo: number }) {
  const tot = Math.max(1, atraso + carga + retrabajo);
  return (
    <span className="flex h-2 rounded-full overflow-hidden w-full" style={{ background: "var(--ghost-hover)" }}>
      <span style={{ width: `${(100 * carga) / tot}%`, background: MIX_META.carga.color }} />
      <span style={{ width: `${(100 * atraso) / tot}%`, background: MIX_META.atraso.color }} />
      <span style={{ width: `${(100 * retrabajo) / tot}%`, background: MIX_META.retrabajo.color }} />
    </span>
  );
}

function usePoblacion(tipo: string, dias: number) {
  return useSWR<PoblacionGxc>(
    `/rpc/fn_dx_gol_gxc_poblacion?p_tipo=${tipo}&p_dias=${dias}`,
    fetcher, { refreshInterval: 300_000, keepPreviousData: true });
}

function FilaTipo({ tipo, dias, lang }: { tipo: string; dias: number; lang: string }) {
  const { data } = usePoblacion(tipo, dias);
  const meta = TIPO_META[tipo];

  const resumen = useMemo(() => {
    const ents = data?.entidades ?? [];
    const porCuadrante: Record<string, number> = {};
    let atraso = 0, carga = 0, retrabajo = 0;
    for (const e of ents) {
      porCuadrante[e.cuadrante] = (porCuadrante[e.cuadrante] ?? 0) + 1;
      atraso += e.c_atraso; carga += e.c_carga; retrabajo += e.c_retrabajo;
    }
    const urgentes = ents.filter((e) => e.cuadrante === "urgente").slice(0, 2);
    const movers = ents
      .filter((e) => e.rankeable && e.tasa_cons_prev != null && (e.viajes_prev ?? 0) >= 5)
      .map((e) => ({ e, d: deltaTasa(e.tasa_cons, e.tasa_cons_prev) ?? 0 }))
      .sort((a, b) => b.d - a.d)
      .filter((x) => x.d > 0.1)
      .slice(0, 2);
    return { porCuadrante, atraso, carga, retrabajo, urgentes, movers };
  }, [data]);

  const teaser = (e: EntidadGxc, nota: string, color: string) => (
    <Link key={e.id} href={`/${lang}/gxc/${tipo}/${encodeURIComponent(e.id)}?dias=${dias}`}
          className="flex items-center gap-2 text-[12px] hover:underline min-w-0 rounded-lg px-2 py-1.5"
          style={{ background: "var(--ghost-hover)" }}>
      <span className="w-2 h-2 rounded-full flex-none" style={{ background: color }} />
      <span className="font-medium flex-none truncate max-w-[150px]">{e.id}</span>
      <span className="truncate" style={{ color: "var(--muted)" }}>{nota}</span>
    </Link>
  );

  return (
    <section className="card px-4 py-2.5 flex-1 min-h-0 grid grid-cols-[190px_1fr_1.1fr_1.35fr] gap-4 items-center">
      {/* Población + volumen */}
      <Link href={`/${lang}/gxc/${tipo}?dias=${dias}`} className="flex flex-col justify-center gap-1 min-w-0 group">
        <div className="font-semibold text-[15px] group-hover:underline">{meta?.label ?? tipo}</div>
        <div className="flex items-baseline gap-3 pt-0.5">
          <Stat label="Con ranking" value={data ? `${data.n_rankeables}/${data.n}` : "—"} />
          <Stat label="Urgentes"
                value={<span style={{ color: CUADRANTE_META.urgente.color }}>{resumen.porCuadrante.urgente ?? 0}</span>} />
        </div>
      </Link>

      {/* Cuadrantes */}
      <div className="flex flex-wrap gap-1.5 content-center">
        {ORDEN_CUADRANTES.map((c) => {
          const n = resumen.porCuadrante[c] ?? 0;
          if (!n) return null;
          const m = CUADRANTE_META[c];
          return (
            <span key={c} title={m.explica}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
              <span className="w-2 h-2 rounded-full" style={{ background: m.color, boxShadow: "0 0 0 1px var(--border)" }} />
              {m.label} <b style={{ fontVariantNumeric: "tabular-nums" }}>{n}</b>
            </span>
          );
        })}
        {!data && <span className="text-[12px]" style={{ color: "var(--muted)" }}>Cargando…</span>}
      </div>

      {/* Mix de consecuencias de la población */}
      <div className="flex flex-col gap-1.5 justify-center min-w-0">
        <MixBar atraso={resumen.atraso} carga={resumen.carga} retrabajo={resumen.retrabajo} />
        <div className="flex gap-3 text-[11px]" style={{ color: "var(--muted)" }}>
          {(["carga", "atraso", "retrabajo"] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm" style={{ background: MIX_META[k].color }} />
              {MIX_META[k].label.split(" ")[0]} <b style={{ fontVariantNumeric: "tabular-nums" }}>
                {(k === "carga" ? resumen.carga : k === "atraso" ? resumen.atraso : resumen.retrabajo).toLocaleString()}</b>
            </span>
          ))}
        </div>
      </div>

      {/* Puertas de entrada: urgentes y movers */}
      <div className="flex flex-col justify-center gap-1.5 min-w-0">
        {resumen.urgentes.map((e) =>
          teaser(e, `${pct(e.tasa_cons)} consecuencia en ${e.viajes} viajes`, CUADRANTE_META.urgente.color))}
        {resumen.movers.map(({ e, d }) =>
          teaser(e, `empeoró ${pct(e.tasa_cons_prev)} → ${pct(e.tasa_cons)} (+${Math.round(d * 100)} pts)`,
                 MIX_META.atraso.color))}
        {data && !resumen.urgentes.length && !resumen.movers.length && (
          <span className="text-[12px] px-2" style={{ color: "var(--muted)" }}>
            Sin urgentes ni deterioros relevantes en el período
          </span>
        )}
      </div>
    </section>
  );
}

type BaselineAnonima = {
  viajes: number; tasa_consecuencia: number; tasa_exposicion: number;
  contraste: { con_exposicion: number | null; sin_exposicion: number | null };
  mix: { atraso: number; retrabajo: number; carga: number };
  umbral_cons_alto: number;
};

export function Visor({ lang }: { lang: string }) {
  const { dias, setDias } = usePeriodo();
  const { carrierMode } = useCarrierMode();
  // La línea base es del PERÍODO (mismos viajes en las 4 poblaciones):
  // basta leerla de una sola llamada. En modo carrier el server filtra todo
  // a SU mundo, así que esa misma llamada trae su fila propia.
  const { data: base } = usePoblacion("carrier", dias);
  const bl = base?.baseline;
  const totViajes = useMemo(
    () => (base?.entidades ?? []).reduce((a, e) => a + e.viajes, 0), [base]);

  // Modo carrier: línea base ANÓNIMA del período completo (solo agregados,
  // fn abierta en el proxy) — la referencia contra la que se compara.
  const { data: blAnon } = useSWR<BaselineAnonima>(
    carrierMode ? `/rpc/fn_dx_gol_gxc_baseline?p_dias=${dias}` : null,
    fetcher, { refreshInterval: 300_000, keepPreviousData: true });
  const yo = carrierMode ? base?.entidades?.[0] : undefined;

  return (
    <div className="gemelo-scope h-full w-full overflow-y-auto"><div className="p-4 space-y-4 max-w-[1440px] mx-auto">
      <div className="h-[calc(100vh-64px-40px-48px)] flex flex-col gap-2.5 overflow-hidden">
        <div className="flex items-center gap-3 flex-wrap flex-none">
          <h2 className="text-[17px] font-semibold">{carrierMode ? "Mi cumplimiento" : "GxC · Gestión por consecuencia"}</h2>
          <span className="text-[12px]" style={{ color: "var(--muted)" }}>
            consecuencia = atraso ETA &gt;1 h · carga incumplida · retrabajo — por viaje cerrado
          </span>
          <span className="flex-1" />
          <PeriodoChips dias={dias} onChange={setDias} />
        </div>

        {/* Modo carrier: TU operación contra la línea base anónima del período */}
        {carrierMode && (
          <section className="card px-4 py-2.5 flex-none flex items-center gap-6 flex-wrap">
            <Stat label="Tus viajes cerrados" value={yo ? yo.viajes.toLocaleString() : "—"} />
            <Stat label="Tu tasa de consecuencia"
                  value={<span style={{ color: yo && blAnon && Number(yo.tasa_cons) >= blAnon.umbral_cons_alto
                    ? "var(--rose-600)" : "var(--green-500)" }}>{pct(yo?.tasa_cons)}</span>}
                  sub={blAnon ? `línea base del período: ${pct(blAnon.tasa_consecuencia)} · umbral alto: ${pct(blAnon.umbral_cons_alto)}` : undefined} />
            <div className="flex flex-col gap-1 min-w-[220px]">
              <MixBar atraso={yo?.c_atraso ?? 0} carga={yo?.c_carga ?? 0} retrabajo={yo?.c_retrabajo ?? 0} />
              <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                tu mix: carga {yo?.c_carga ?? 0} · atraso {yo?.c_atraso ?? 0} · retrabajo {yo?.c_retrabajo ?? 0}
              </span>
            </div>
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>
              La línea base es el agregado anónimo de la operación completa — nunca pares con nombre.
            </span>
            <span className="flex-1" />
            {yo && (
              <Link className="btn-primary" href={`/${lang}/gxc/carrier/${encodeURIComponent(yo.id)}?dias=${dias}`}>
                Ver mi historia →
              </Link>
            )}
          </section>
        )}

        {/* Línea base del período — el contraste se muestra siempre */}
        {!carrierMode && (
        <section className="card px-4 py-2.5 flex-none flex items-center gap-6 flex-wrap">
          <Stat label="Viajes cerrados" value={totViajes ? totViajes.toLocaleString() : "—"} />
          <Stat label="Tasa de consecuencia" value={pct(bl?.tasa_consecuencia)} />
          <Stat label="Viajes con señal" value={pct(bl?.tasa_exposicion)}
                sub="síntomas ICU≥2 durante el viaje" />
          <div className="flex items-center gap-2 text-[12px]">
            <span style={{ color: "var(--muted)" }}>Contraste:</span>
            <span className="badge" style={{ background: "rgba(225,29,72,0.10)", color: "var(--rose-600)" }}>
              con señal {pct(bl?.contraste?.con_exposicion)}
            </span>
            <span className="badge" style={{ background: "var(--ghost-hover)" }}>
              sin señal {pct(bl?.contraste?.sin_exposicion)}
            </span>
            <span style={{ color: "var(--muted)" }}>— contraste observado, no causalidad</span>
          </div>
          <span className="flex-1" />
          <span className="text-[11px]" style={{ color: "var(--muted)" }}>
            nivel vs línea base ±25% · piso {bl?.piso_viajes ?? 5} viajes
          </span>
        </section>
        )}

        {(carrierMode ? TIPOS_GXC.filter((t) => t !== "carrier") : TIPOS_GXC)
          .map((t) => <FilaTipo key={t} tipo={t} dias={dias} lang={lang} />)}
      </div>
    </div></div>
  );
}
