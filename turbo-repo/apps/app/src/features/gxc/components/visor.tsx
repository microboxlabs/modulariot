"use client";

import "@/features/gemelo-common/gemelo.css";

// GxC v4 · N1 — LA HISTORIA DEL PERÍODO (contrato:
// mockup_gxc_n1_historia_CONTRATO_20260806.html). El visor deja de ser un
// inventario de poblaciones y cuenta la gestión en 7 capítulos, al estilo
// del reporte ISO 39001 (capítulos en el orden del proceso, doble propósito
// evidencia+gestión): 1 qué pasó (prosa + evolutivo diario) · 2 dónde
// entrar hoy (carrusel) · 3 la mezcla 360° como CONCENTRACIÓN
// (sujeto×ruta) · 4 los que se movieron (evolutivos semanales) · 5 pulso
// de síntomas (expirado = volvió a normal, se registra para medir) ·
// 6 la consecuencia en el orden del viaje · 7 la foto por población
// (plegada). Con filtros activos TODOS los capítulos se recuentan.
import { useMemo, useRef } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { EChartsOption } from "echarts";
import { golFetcher as fetcher } from "@/features/gemelo-common/fetcher";
import { Stat, EChart, useTemaChart } from "@/features/gemelo-common/ds-widgets";
import {
  TIPOS_GXC, TIPO_META, MIX_META,
  type PoblacionGxc, type EntidadGxc, pct,
} from "../model";
import { usePeriodo, PeriodoChips } from "./periodo";
import { useGxcFiltros, GxcFiltrosBar } from "./filtros";
import { useCarrierMode } from "@/features/auth/hooks/use-carrier-mode";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

// ── tipos del resumen (fn_dx_gol_gxc_resumen, migración 063) ──
type Cruce = { sujeto: string; ruta: string; viajes: number; casos: number; total_sujeto: number };
type Resumen = {
  serie_diaria: [number, number, number, number, number, number, number][];
  pulso: { tratados: number; normalizados: number; activos: number; viajes_con_tratamiento: number };
  cruces: { conductor_ruta: Cruce[]; carrier_ruta: Cruce[]; camion_ruta: Cruce[] };
  semanal_conductor: Record<string, [number, number, number][]>;
};
type BaselineAnonima = {
  viajes: number; tasa_consecuencia: number; tasa_exposicion: number;
  contraste: { con_exposicion: number | null; sin_exposicion: number | null };
  mix: Record<string, number>; umbral_cons_alto: number;
};

const capNombre = (s: string) =>
  s.trim().split(/\s+/).map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
const pts = (a: number | null | undefined, b: number | null | undefined) =>
  a == null || b == null ? null : Math.round((a - b) * 100);

function usePoblacion(tipo: string, q: string) {
  return useSWR<PoblacionGxc>(
    `/rpc/fn_dx_gol_gxc_poblacion?p_tipo=${tipo}&${q}`,
    fetcher, { refreshInterval: 300_000, keepPreviousData: true });
}

// ── carrusel estilo Netflix: riel horizontal + flechas + Ver todos ──
function Carrusel({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const mv = (dir: number) =>
    ref.current?.scrollBy({ left: dir * (ref.current.clientWidth - 120), behavior: "smooth" });
  return (
    <div className="relative">
      <button type="button" onClick={() => mv(-1)} aria-label="anterior"
        className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full items-center justify-center shadow"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}>‹</button>
      <div ref={ref} className="flex gap-2.5 overflow-x-auto pb-2"
           style={{ scrollSnapType: "x mandatory", scrollbarWidth: "thin" }}>
        {children}
      </div>
      <button type="button" onClick={() => mv(1)} aria-label="siguiente"
        className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full items-center justify-center shadow"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}>›</button>
    </div>
  );
}

function Tarjeta({ children }: { children: React.ReactNode }) {
  return (
    <div className="card px-4 py-3 flex flex-col gap-1.5 flex-none"
         style={{ minWidth: 300, maxWidth: 300, scrollSnapAlign: "start" }}>
      {children}
    </div>
  );
}

function Etiqueta({ tono, children }: { tono: "rojo" | "ambar" | "azul" | "verde"; children: React.ReactNode }) {
  const c = { rojo: "#E11D48", ambar: "var(--amber-600, #B45309)", azul: "var(--blue-600)", verde: "#0E9F6E" }[tono];
  return (
    <span className="text-[10.5px] font-bold rounded-full px-2 py-0.5 tracking-wide"
          style={{ color: c, background: "color-mix(in srgb, " + c + " 12%, transparent)" }}>
      {children}
    </span>
  );
}

function VerTodos({ href, n }: { href: string; n: string }) {
  return (
    <Link href={href} className="card flex-none flex items-center justify-center text-center"
          style={{ minWidth: 160, maxWidth: 160, borderStyle: "dashed", scrollSnapAlign: "start",
                   background: "rgba(28,100,242,0.05)", color: "var(--blue-700)" }}>
      <span><b className="block text-[15px]">{n}</b>
        <span className="text-[13px] font-semibold">Ver todos →</span></span>
    </Link>
  );
}

// ── evolutivo semanal acabado (contrato): eje 0-100%, área, % extremos ──
function SparkSemanal({ serie, color }: { serie?: [number, number, number][]; color: string }) {
  if (!serie?.length) return null;
  let rates = serie.map(([, v, c]) => (v ? c / v : 0));
  let vols = serie.map(([, v]) => v);
  if (rates.length === 1) { rates = [...rates, ...rates]; vols = [...vols, ...vols]; }
  const w = 250, h = 64, l = 30, t = 12, b = 18, nx = rates.length;
  const px = (i: number) => l + (i * (w - l - 8)) / (nx - 1);
  const py = (r: number) => t + (1 - r) * (h - t - b);
  const ptsStr = rates.map((r, i) => `${px(i).toFixed(1)},${py(r).toFixed(1)}`).join(" ");
  const area = `${l},${py(rates[0]).toFixed(1)} ${ptsStr} ${px(nx - 1).toFixed(1)},${h - b} ${l},${h - b}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", maxWidth: 250, height: "auto" }}>
      <line x1={l} x2={w - 8} y1={py(1)} y2={py(1)} stroke="var(--border)" strokeDasharray="2 3" />
      <line x1={l} x2={w - 8} y1={h - b} y2={h - b} stroke="var(--border)" />
      <text x={l - 4} y={py(1) + 3} fontSize="8.5" fill="var(--muted)" textAnchor="end">100%</text>
      <text x={l - 4} y={h - b + 3} fontSize="8.5" fill="var(--muted)" textAnchor="end">0%</text>
      <polygon points={area} fill={color} opacity="0.10" />
      <polyline points={ptsStr} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {rates.map((r, i) => (
        <g key={i}>
          <circle cx={px(i)} cy={py(r)} r="3" fill={color} />
          <text x={px(i)} y={h - 4} fontSize="8.5" fill="var(--muted)" textAnchor="middle">
            S{i + 1}·{vols[i]}vj</text>
        </g>
      ))}
      <text x={px(0)} y={py(rates[0]) - 6} fontSize="10" fontWeight="700" fill={color} textAnchor="start">
        {Math.round(rates[0] * 100)}%</text>
      <text x={px(nx - 1)} y={py(rates[nx - 1]) - 6} fontSize="10" fontWeight="700" fill={color} textAnchor="end">
        {Math.round(rates[nx - 1] * 100)}%</text>
    </svg>
  );
}

function CapTitulo({ n, titulo, nota }: { n: string; titulo: string; nota?: string }) {
  return (
    <div className="flex items-baseline gap-2.5 flex-wrap mb-2.5 mt-7">
      <span className="text-[11px] font-bold tracking-widest" style={{ color: "var(--muted)" }}>{n}</span>
      <h2 className="text-[15px] font-semibold">{titulo}</h2>
      {nota && <span className="text-[12px]" style={{ color: "var(--muted)" }}>{nota}</span>}
    </div>
  );
}

export function Visor({ lang, dict }: { lang: string; dict: I18nRecord }) {
  const { dias, setDias } = usePeriodo();
  const { carrierMode } = useCarrierMode();
  const gx = useGxcFiltros(carrierMode);
  const sp = useSearchParams();
  const tema = useTemaChart();
  const q = gx.q(dias);
  const qsNav = useMemo(() => {
    const p = new URLSearchParams(sp.toString());
    p.set("dias", String(dias));
    return p.toString();
  }, [sp, dias]);

  const { data: pCar } = usePoblacion("carrier", q);
  const { data: pCond } = usePoblacion("conductor", q);
  const { data: pCam } = usePoblacion("camion", q);
  const { data: pRuta } = usePoblacion("ruta", q);
  const { data: rs } = useSWR<Resumen>(`/rpc/fn_dx_gol_gxc_resumen?${q}`,
    fetcher, { refreshInterval: 300_000, keepPreviousData: true });
  const { data: blAnon } = useSWR<BaselineAnonima>(
    carrierMode ? `/rpc/fn_dx_gol_gxc_baseline?${q}&p_tipo=carrier` : null,
    fetcher, { refreshInterval: 300_000, keepPreviousData: true });

  const bl = pCar?.baseline;
  const blGlobal = pCar?.baseline_global;
  const yo = carrierMode ? pCar?.entidades?.[0] : undefined;

  // ── derivaciones de la historia ──
  const hechos = useMemo(() => {
    if (!bl || !pCond) return null;
    // En modo carrier el baseline del payload es el GLOBAL ANÓNIMO (062):
    // la historia se cuenta desde SU propia fila, no desde la población.
    const propio = carrierMode ? pCar?.entidades?.[0] : undefined;
    if (carrierMode && !propio) return null;
    const totViajes = propio ? propio.viajes : bl.viajes ?? 0;
    const tasaAct = propio ? propio.tasa_cons : bl.tasa_consecuencia;
    const entsCar = pCar?.entidades ?? [];
    const vPrev = propio ? (propio.viajes_prev ?? 0)
      : entsCar.reduce((a, e) => a + (e.viajes_prev ?? 0), 0);
    const cPrev = propio ? (propio.tasa_cons_prev ?? 0) * (propio.viajes_prev ?? 0)
      : entsCar.reduce((a, e) => a + (e.tasa_cons_prev ?? 0) * (e.viajes_prev ?? 0), 0);
    const tasaPrev = vPrev ? cPrev / vPrev : null;
    const delta = pts(tasaAct, tasaPrev);
    const mix = (propio ? propio.mix : bl.mix) ?? {};
    const totMix = Object.values(mix).reduce((a, b) => a + b, 0);
    const [topKey, topN] = Object.entries(mix).sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
    // concentración: share de los 5 conductores con más casos del mix dominante
    const entsCond = pCond.entidades ?? [];
    const totCond = entsCond.reduce((a, e) => a + (e.mix?.[topKey] ?? 0), 0);
    const top5 = [...entsCond].sort((a, b) => (b.mix?.[topKey] ?? 0) - (a.mix?.[topKey] ?? 0)).slice(0, 5);
    const share5 = totCond ? Math.round(top5.reduce((a, e) => a + (e.mix?.[topKey] ?? 0), 0) / totCond * 100) : 0;
    const umbralCond = (pCond.baseline?.umbral_cons_alto ?? 1);
    const urgCond = entsCond.filter((e) => e.cuadrante === "urgente");
    const urgCar = entsCar.filter((e) => e.cuadrante === "urgente");
    const esNuevo = (e: EntidadGxc, umbral: number) =>
      !((e.viajes_prev ?? 0) >= 5 && (e.tasa_cons_prev ?? 0) >= umbral);
    const nuevosCar = urgCar.filter((e) => esNuevo(e, blGlobal?.umbral_cons_alto ?? umbralCond)).length;
    // cruce dominante: el de mayor volumen con concentración total
    const cruces = rs ? [...rs.cruces.conductor_ruta, ...rs.cruces.carrier_ruta] : [];
    const dominante = cruces
      .filter((c) => c.total_sujeto > 0 && c.casos / c.total_sujeto >= 0.999)
      .sort((a, b) => b.casos - a.casos)[0];
    return { totViajes, tasaAct, tasaPrev, delta, topKey, topN, totMix, share5,
             urgCond, urgCar, nuevosCar, umbralCond, esNuevo, dominante };
  }, [bl, blGlobal, pCar, pCond, rs, carrierMode]);

  // gráfico diario: barras de viajes + línea de tasa
  const opcionDiaria = useMemo<EChartsOption | null>(() => {
    if (!rs?.serie_diaria?.length) return null;
    const cat = rs.serie_diaria.map(([d]) =>
      new Date(d * 1000).toLocaleDateString("es-CL", { day: "2-digit", month: "short" }));
    return {
      grid: { left: 44, right: 44, top: 24, bottom: 22 },
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: cat,
        axisLabel: { fontSize: 9, color: tema.muted, interval: Math.ceil(cat.length / 9) },
        axisLine: { lineStyle: { color: tema.border } } },
      yAxis: [
        { type: "value", name: "viajes", nameTextStyle: { fontSize: 9, color: tema.muted },
          axisLabel: { fontSize: 9, color: tema.muted }, splitLine: { show: false } },
        { type: "value", max: 100, axisLabel: { fontSize: 9, color: tema.muted, formatter: "{value}%" },
          splitLine: { lineStyle: { color: tema.border, type: "dashed" } } },
      ],
      series: [
        { name: "Viajes", type: "bar", data: rs.serie_diaria.map((d) => d[1]),
          itemStyle: { color: "rgba(28,100,242,0.25)", borderRadius: [3, 3, 0, 0] } },
        { name: "Tasa de consecuencia", type: "line", yAxisIndex: 1, symbol: "circle", symbolSize: 4,
          data: rs.serie_diaria.map((d) => (d[1] ? Math.round((d[2] / d[1]) * 100) : 0)),
          lineStyle: { color: "#E11D48", width: 2 }, itemStyle: { color: "#E11D48" } },
      ],
    };
  }, [rs, tema]);

  // cruce dominante por sujeto: "dónde le pasa" — el hallazgo 360 vive
  // DENTRO de la tarjeta de cada entidad, no como sección aparte.
  const crucePorSujeto = useMemo(() => {
    const m = new Map<string, Cruce>();
    if (rs) {
      const fuentes: [string, Cruce[]][] = [
        ["conductor", rs.cruces.conductor_ruta],
        ["carrier", rs.cruces.carrier_ruta],
        ["camion", rs.cruces.camion_ruta],
      ];
      for (const [t, lista] of fuentes)
        for (const c of lista) {
          const k = `${t}|${c.sujeto}`;
          const prev = m.get(k);
          if (!prev || c.casos > prev.casos) m.set(k, c);
        }
    }
    return m;
  }, [rs]);

  // un RIEL por entidad: urgentes primero, luego deterioros y mejoras.
  type CasoCard = {
    id: string; href: string; tag: [Parameters<typeof Etiqueta>[0]["tono"], string];
    why: React.ReactNode; donde?: React.ReactNode; serie?: [number, number, number][];
  };
  const rieles = useMemo(() => {
    const tipos = (carrierMode ? TIPOS_GXC.filter((t) => t !== "carrier") : TIPOS_GXC);
    const data: Record<string, PoblacionGxc | undefined> =
      { carrier: pCar, conductor: pCond, camion: pCam, ruta: pRuta };
    const out: { tipo: string; cards: CasoCard[]; total: number }[] = [];
    for (const tipo of tipos) {
      const d = data[tipo];
      const ents = d?.entidades ?? [];
      const umbral = d?.baseline?.umbral_cons_alto ?? 1;
      const esNuevo = (e: EntidadGxc) =>
        !((e.viajes_prev ?? 0) >= 5 && (e.tasa_cons_prev ?? 0) >= umbral);
      const donde = (e: EntidadGxc): React.ReactNode => {
        const c = crucePorSujeto.get(`${tipo}|${e.id}`);
        if (!c || !c.total_sujeto || c.casos < 3) return undefined;
        const conc = Math.round((c.casos / c.total_sujeto) * 100);
        return (<>Dónde le pasa: <b>{c.casos} de sus {c.total_sujeto} casos en {c.ruta}</b>
          {conc >= 100 ? " — toda su falla vive ahí" : ` (${conc}%)`}.</>);
      };
      const cards: CasoCard[] = [];
      const vistos = new Set<string>();
      const href = (id: string) => `/${lang}/gxc/${tipo}/${encodeURIComponent(id)}?${qsNav}`;
      // 1) urgentes (por volumen)
      for (const e of ents.filter((x) => x.cuadrante === "urgente")
                          .sort((a, b) => b.viajes - a.viajes)) {
        if (vistos.has(e.id)) continue; vistos.add(e.id);
        cards.push({
          id: e.id, href: href(e.id),
          tag: esNuevo(e) ? ["rojo", "ENTRÓ A URGENTE"] : ["ambar", "SIGUE EN URGENTE"],
          why: tipo === "camion"
            ? <><b>{pct(e.tasa_cons)} de falla de equipo en {e.viajes} viajes</b> — la conversación es con mantenimiento.</>
            : tipo === "ruta"
            ? <><b>{e.v_cons} de {e.viajes} viajes con incumplimiento de carga</b> ({pct(e.tasa_cons)}).</>
            : <><b>{e.v_cons} de {e.viajes} viajes con consecuencia</b> ({pct(e.tasa_cons)}) — {
                e.tasa_cons_prev != null ? `venía en ${pct(e.tasa_cons_prev)}` : "sin historia previa comparable"}.</>,
          donde: donde(e),
          serie: tipo === "conductor" ? rs?.semanal_conductor?.[e.id] : undefined,
        });
      }
      // 2) movimientos entre períodos
      const movibles = ents.filter((e) =>
        e.rankeable && (e.viajes_prev ?? 0) >= 5 && e.tasa_cons_prev != null && !vistos.has(e.id))
        .map((e) => ({ e, delta: (e.tasa_cons ?? 0) - (e.tasa_cons_prev ?? 0) }));
      for (const { e } of movibles.filter((x) => x.delta > 0.1).sort((a, b) => b.delta - a.delta)) {
        vistos.add(e.id);
        cards.push({
          id: e.id, href: href(e.id), tag: ["rojo", "SE DETERIORÓ"],
          why: <>De <b>{pct(e.tasa_cons_prev)} → {pct(e.tasa_cons)}</b> en un período ({e.viajes} viajes).
            Un salto así casi siempre tiene causa concreta.</>,
          donde: donde(e),
          serie: tipo === "conductor" ? rs?.semanal_conductor?.[e.id] : undefined,
        });
      }
      for (const { e } of movibles.filter((x) => x.delta < -0.15).sort((a, b) => a.delta - b.delta)) {
        if (vistos.has(e.id)) continue; vistos.add(e.id);
        cards.push({
          id: e.id, href: href(e.id), tag: ["verde", "MEJORÓ"],
          why: <>De <b>{pct(e.tasa_cons_prev)} → {pct(e.tasa_cons)}</b> manteniendo volumen ({e.viajes} viajes)
            — mejora real, no rebote.</>,
          serie: tipo === "conductor" ? rs?.semanal_conductor?.[e.id] : undefined,
        });
      }
      // 3) rutas: el volumen con consecuencia también pide gestión
      if (tipo === "ruta") {
        const rk = ents.filter((e) => e.rankeable && !vistos.has(e.id))
          .sort((a, b) => b.v_cons - a.v_cons);
        for (const e of rk.slice(0, 2)) {
          if ((e.v_cons ?? 0) < 5) continue;
          vistos.add(e.id);
          cards.push({
            id: e.id, href: href(e.id), tag: ["azul", "VOLUMEN CON CONSECUENCIA"],
            why: <><b>{e.viajes} viajes</b> y {pct(e.tasa_cons)} con incumplimiento — donde un ajuste rinde más.</>,
          });
        }
      }
      out.push({ tipo, cards: cards.slice(0, 10), total: cards.length });
    }
    return out;
  }, [pCar, pCond, pCam, pRuta, rs, crucePorSujeto, lang, qsNav, carrierMode]);

  // capítulo 6: el orden del viaje
  const etapas = useMemo(() => {
    // En modo carrier: SU mix (fila propia) y el equipo sumado de SU flota
    // (el baseline del payload es global anónimo, no sirve aquí).
    const mix = (carrierMode ? yo?.mix : bl?.mix) ?? {};
    const equipo = carrierMode
      ? (pCam?.entidades ?? []).reduce((a, e) => a + (e.mix?.equipo ?? 0), 0)
      : pCam?.baseline?.mix?.equipo ?? 0;
    const enRuta = (mix.conduccion ?? 0) + equipo;
    const llegada = mix.atraso ?? 0;
    const despues = (mix.senal ?? 0) + (mix.cierre ?? 0);
    const max = Math.max(enRuta, llegada, despues, 1);
    return { enRuta, llegada, despues, max, mix, equipo };
  }, [bl, pCam, carrierMode, yo]);

  const cargando = !bl || !hechos;
  const fmtN = (x: number) => x.toLocaleString("es-CL");

  return (
    <div className="gemelo-scope h-full w-full overflow-y-auto"><div className="p-4 pb-14 max-w-[1120px] mx-auto">

      {/* cabecera + filtros (misma interacción que Despachos) */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-[17px] font-semibold">{carrierMode ? "Mi cumplimiento" : "GxC · Gestión por consecuencia"}</h2>
        <span className="text-[12px]" style={{ color: "var(--muted)" }}>
          la historia del período, no solo los datos
        </span>
        <span className="flex-1" />
        <PeriodoChips dias={dias} onChange={setDias} />
      </div>
      <div className="flex items-center gap-2 flex-wrap mt-2.5">
        <GxcFiltrosBar dict={dict} carrierMode={carrierMode} />
        <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>
          {gx.conRango ? "el rango de fechas manda sobre los chips de período · " : ""}
          al filtrar, todos los capítulos se recuentan
        </span>
      </div>

      {/* modo carrier: tu operación contra la base anónima */}
      {carrierMode && (
        <section className="card px-4 py-2.5 mt-4 flex items-center gap-6 flex-wrap">
          <Stat label="Tus viajes cerrados" value={yo ? fmtN(yo.viajes) : "—"} />
          <Stat label="Tu tasa de consecuencia"
                value={<span style={{ color: yo && blAnon && Number(yo.tasa_cons) >= blAnon.umbral_cons_alto
                  ? "var(--rose-600)" : "var(--green-500)" }}>{pct(yo?.tasa_cons)}</span>}
                sub={blAnon ? `línea base anónima del período: ${pct(blAnon.tasa_consecuencia)} · umbral alto: ${pct(blAnon.umbral_cons_alto)}` : undefined} />
          <span className="text-[12px]" style={{ color: "var(--muted)" }}>
            La línea base es el agregado anónimo de la operación completa — nunca pares con nombre.
          </span>
          <span className="flex-1" />
          {yo && (
            <Link className="btn-primary" href={`/${lang}/gxc/carrier/${encodeURIComponent(yo.id)}?${qsNav}`}>
              Ver mi historia →
            </Link>
          )}
        </section>
      )}

      {/* 1 · QUÉ PASÓ */}
      <CapTitulo n="1 · QUÉ PASÓ" titulo="El período en una historia" />
      <section className="card px-5 py-4">
        {cargando ? (
          <span className="text-[13px]" style={{ color: "var(--muted)" }}>Contando la historia…</span>
        ) : (
          <p className="text-[15px] leading-[1.75] max-w-[62em]">
            En {gx.conRango ? "el rango elegido" : `estas ${dias === 7 ? "1 semana" : dias === 28 ? "4 semanas" : "12 semanas"}`}{" "}
            {carrierMode ? "tu operación cerró" : "cerraste"} <b>{fmtN(hechos.totViajes)} viajes</b> y el{" "}
            <b style={{ color: "var(--rose-600)" }}>{pct(hechos.tasaAct)}</b> tuvo alguna consecuencia exigible
            {hechos.delta != null && (Math.abs(hechos.delta) <= 2
              ? <> — prácticamente igual que el período anterior ({pct(hechos.tasaPrev)}): <b>el problema no está cediendo</b></>
              : hechos.delta > 0
              ? <> — <b style={{ color: "var(--rose-600)" }}>{hechos.delta} puntos peor</b> que el período anterior ({pct(hechos.tasaPrev)})</>
              : <> — <b style={{ color: "var(--green-500)" }}>{-hechos.delta} puntos mejor</b> que el período anterior ({pct(hechos.tasaPrev)})</>)}.{" "}
            {hechos.topKey && hechos.totMix > 0 && (<>
              La presión viene de <b>{(MIX_META[hechos.topKey]?.label ?? hechos.topKey).toLowerCase()}</b>{" "}
              ({fmtN(hechos.topN)} casos, el {Math.round((hechos.topN / hechos.totMix) * 100)}% del mix)
              {hechos.share5 > 0 && hechos.share5 < 15 && (<>
                , y está <b>repartida en toda la operación</b>: los 5 conductores con más eventos apenas
                explican el {hechos.share5}% — eso apunta a un problema de <b>sistema</b>, más que de personas</>)}
              {hechos.share5 >= 30 && (<>
                , <b>concentrada</b>: los 5 conductores con más eventos explican el {hechos.share5}%</>)}.{" "}
            </>)}
            Con nombre propio: <b>{hechos.urgCond.length} conductores</b>
            {!carrierMode && <> y <b>{hechos.urgCar.length} transportistas</b></>} en urgente
            {!carrierMode && hechos.nuevosCar > 0 && <> ({hechos.nuevosCar} entraron este período)</>}
            {hechos.dominante && (<>
              , y una combinación domina: <b>{capNombre(hechos.dominante.sujeto)} en {hechos.dominante.ruta},{" "}
              {hechos.dominante.casos} de {hechos.dominante.casos} viajes con consecuencia</b></>)}.
          </p>
        )}
        {opcionDiaria && <div className="mt-3"><EChart option={opcionDiaria} height={190} /></div>}
      </section>

      {/* 2..N · UN RIEL POR ENTIDAD — urgentes primero, luego los que se movieron */}
      {rieles.map((r, i) => (
        <section key={r.tipo}>
          <CapTitulo n={`${i + 2} · ${(TIPO_META[r.tipo]?.label ?? r.tipo).toUpperCase()}`}
                     titulo={{
                       conductor: "Los conductores que piden gestión",
                       carrier: "Los transportistas que piden gestión",
                       camion: "La flota que pide gestión",
                       ruta: "Las rutas que piden gestión",
                     }[r.tipo] ?? `${TIPO_META[r.tipo]?.label ?? r.tipo} — gestión`}
                     nota="urgentes primero · luego deterioros y mejoras — clic abre su perfil" />
          {r.cards.length ? (
            <Carrusel>
              {r.cards.map((c) => (
                <Tarjeta key={c.id}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-[14px] truncate">{capNombre(c.id)}</span>
                    <Etiqueta tono={c.tag[0]}>{c.tag[1]}</Etiqueta>
                  </div>
                  <div className="text-[13px] leading-[1.55]" style={{ color: "var(--muted)" }}>{c.why}</div>
                  {c.donde && (
                    <div className="text-[12.5px] leading-[1.5] rounded-lg px-2.5 py-1.5"
                         style={{ background: "var(--ghost-hover)" }}>
                      📍 {c.donde}
                    </div>
                  )}
                  {c.serie && <SparkSemanal serie={c.serie}
                    color={c.tag[0] === "verde" ? "#0E9F6E" : c.tag[0] === "ambar" ? "#B45309" : "#E11D48"} />}
                  <Link href={c.href} className="text-[12.5px] font-semibold mt-auto pt-1"
                        style={{ color: "var(--blue-700)" }}>Abrir su historia →</Link>
                </Tarjeta>
              ))}
              <VerTodos href={`/${lang}/gxc/${r.tipo}?${qsNav}`}
                        n={`${r.total} ${r.total === 1 ? "caso" : "casos"}`} />
            </Carrusel>
          ) : (
            <div className="text-[13px] px-1 py-2" style={{ color: "var(--muted)" }}>
              {cargando ? "Cargando…" : "Sin urgentes ni movimientos relevantes en este subconjunto."}
            </div>
          )}
        </section>
      ))}

      {/* PULSO */}
      <CapTitulo n={`${rieles.length + 2} · EL PULSO DE LOS SÍNTOMAS`} titulo="Registro y autorregulación"
                 nota="los tratamientos que expiran = el síntoma volvió a normal; se registran para medir" />
      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
        <div className="card px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>Síntomas tratados en el período</div>
          <div className="text-[26px] font-extrabold" style={{ fontVariantNumeric: "tabular-nums" }}>
            {rs ? fmtN(rs.pulso.tratados) : "—"}</div>
          <div className="text-[12.5px]" style={{ color: "var(--muted)" }}>
            registrados en {rs ? fmtN(rs.pulso.viajes_con_tratamiento) : "—"} viajes — el sistema está mirando y anotando</div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>Volvieron a normal</div>
          <div className="text-[26px] font-extrabold" style={{ fontVariantNumeric: "tabular-nums" }}>
            {rs && rs.pulso.tratados ? Math.round((rs.pulso.normalizados / rs.pulso.tratados) * 100) + "%" : "—"}</div>
          <div className="text-[12.5px]" style={{ color: "var(--muted)" }}>
            {rs ? fmtN(rs.pulso.normalizados) : "—"} se normalizaron y expiraron solos. Son la <b>medición</b> del
            comportamiento, no una deuda de gestión.</div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>Activos ahora</div>
          <div className="text-[26px] font-extrabold" style={{ color: "var(--rose-600)", fontVariantNumeric: "tabular-nums" }}>
            {rs ? fmtN(rs.pulso.activos) : "—"}</div>
          <div className="text-[12.5px]" style={{ color: "var(--muted)" }}>
            síntomas aún en estado anormal — la cola viva que sí espera acción hoy.</div>
        </div>
      </div>

      {/* DÓNDE OCURRE */}
      <CapTitulo n={`${rieles.length + 3} · DÓNDE OCURRE`} titulo="La consecuencia en el orden del viaje"
                 nota="mismo orden que el proceso: ruta → llegada → cierre" />
      <div className="grid gap-2.5 md:grid-cols-3">
        {[
          { fase: "En ruta", n: etapas.enRuta, color: "#E11D48",
            d: <><b>Conducción grave {fmtN(etapas.mix.conduccion ?? 0)}</b> · equipo/trazabilidad {fmtN(etapas.equipo)}.
              La batalla está aquí y es transversal.</> },
          { fase: "En la llegada", n: etapas.llegada, color: "#B45309",
            d: <><b>Atrasos sobre el plan comprometido</b> (&gt;1 h). Concentrados en pocas rutas — ver la mezcla 360°.</> },
          { fase: "Después del viaje", n: etapas.despues, color: "#7E3AF2",
            d: <><b>Señal cortada {fmtN(etapas.mix.senal ?? 0)}</b> · cierre/POD tardío {fmtN(etapas.mix.cierre ?? 0)}.
              Integración y disciplina de cierre del transportista.</> },
        ].map((x) => (
          <div key={x.fase} className="card px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>{x.fase}</div>
            <div className="text-[22px] font-extrabold my-0.5" style={{ fontVariantNumeric: "tabular-nums" }}>{fmtN(x.n)}</div>
            <div className="h-[7px] rounded-full overflow-hidden my-1.5" style={{ background: "var(--ghost-hover)" }}>
              <i className="block h-full rounded-full" style={{ width: `${Math.round((x.n / etapas.max) * 100)}%`, background: x.color }} />
            </div>
            <div className="text-[12.5px] leading-[1.55]" style={{ color: "var(--muted)" }}>{x.d}</div>
          </div>
        ))}
      </div>

      {/* 7 · LA FOTO POR POBLACIÓN */}
      <CapTitulo n={`${rieles.length + 4} · PARA EL QUE QUIERE MÁS`} titulo="La foto por población" />
      <details className="card px-0 py-0 overflow-hidden">
        <summary className="cursor-pointer px-4 py-3 text-[13.5px] font-semibold" style={{ color: "var(--muted)" }}>
          Transportistas · Flota · Conductores · Rutas — cuadrantes y bases del período
        </summary>
        <div className="px-4 pb-3 grid gap-2">
          {(carrierMode ? TIPOS_GXC.filter((t) => t !== "carrier") : TIPOS_GXC).map((t) => {
            const d = { carrier: pCar, conductor: pCond, camion: pCam, ruta: pRuta }[t];
            const cuadr: Record<string, number> = {};
            for (const e of d?.entidades ?? []) cuadr[e.cuadrante] = (cuadr[e.cuadrante] ?? 0) + 1;
            return (
              <Link key={t} href={`/${lang}/gxc/${t}?${qsNav}`}
                    className="grid md:grid-cols-[150px_1fr_1fr] gap-2 items-center border-t pt-2 text-[13px] hover:underline"
                    style={{ borderColor: "var(--border)" }}>
                <span className="font-bold">{TIPO_META[t]?.label ?? t}</span>
                <span style={{ color: "var(--muted)" }}>
                  {d ? `${d.n_rankeables}/${d.n} con ranking · base ${pct(d.baseline?.tasa_consecuencia)}` : "…"}</span>
                <span style={{ color: "var(--muted)" }}>
                  {["urgente", "punto_ciego", "monitoreo_roto", "ruido", "sano", "muestra_insuficiente"]
                    .filter((c) => cuadr[c]).map((c) => `${c === "muestra_insuficiente" ? "sin muestra" : c.replace("_", " ")} ${cuadr[c]}`)
                    .join(" · ") || "—"}</span>
              </Link>
            );
          })}
        </div>
      </details>
      {gx.filtros && blGlobal && bl && (
        <div className="text-[12px] mt-3" style={{ color: "var(--muted)" }}>
          Historia contada para el subconjunto filtrado ({fmtN(bl.viajes ?? 0)} viajes · base ajustada{" "}
          {pct(bl.tasa_consecuencia)}) — global de contraste: {pct(blGlobal.tasa_consecuencia)} en{" "}
          {fmtN(blGlobal.viajes ?? 0)} viajes.
        </div>
      )}
    </div></div>
  );
}
