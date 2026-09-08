"use client";

// Primitivas de dashboard del Design System — port de
// design-system/ui_kits/modulariot-shell/Dashboard.jsx (Widget, StatCard,
// EChart con ECharts 5, la misma versión que carga el shell canónico).
// Colores desde los tokens; paleta de ejes consciente del modo oscuro.
import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

// Paleta semántica del DS (tokens de colors_and_type.css)
export const DS = {
  blue: "#1C64F2", blueDeep: "#1A56DB", green: "#0E9F6E", amber: "#F1B300",
  rose: "#E11D48", gray400: "#9CA3AF", gray500: "#6B7280", ink: "#111928",
  nivel: { A: "#0E9F6E", B: "#1C64F2", C: "#F1B300", D: "#E11D48" } as Record<string, string>,
};

// ── Tooltip-tarjeta (estilo card del Coordinador): título + badge + filas ──
export type TipTono = "rojo" | "verde" | "gris" | "azul" | "ambar" | "negro" | "violeta";
const TIP_TONOS: Record<TipTono, [string, string]> = {
  rojo: ["rgba(225,29,72,0.14)", "#E11D48"], verde: ["rgba(14,159,110,0.16)", "#0E9F6E"],
  gris: ["rgba(107,114,128,0.18)", "#6B7280"], azul: ["rgba(28,100,242,0.14)", "#1C64F2"],
  ambar: ["rgba(241,179,0,0.2)", "#B45309"], negro: ["rgba(17,25,40,0.85)", "#FFFFFF"],
  violeta: ["rgba(126,58,242,0.16)", "#7E3AF2"],
};
export function tipCard(o: {
  titulo: string;
  badge?: { texto: string; tono: TipTono };
  filas: [string, string][];
  pie?: string;
}): string {
  const badge = o.badge
    ? `<span style="margin-left:8px;padding:1px 8px;border-radius:999px;font-size:10px;font-weight:600;` +
      `background:${TIP_TONOS[o.badge.tono][0]};color:${TIP_TONOS[o.badge.tono][1]}">${o.badge.texto}</span>`
    : "";
  const filas = o.filas.map(([k, v]) =>
    `<tr><td style="padding:1px 10px 1px 0;opacity:.62;white-space:nowrap;font-size:10.5px">${k}</td>` +
    `<td style="padding:1px 0;font-size:11.5px;font-weight:500">${v}</td></tr>`).join("");
  const pie = o.pie
    ? `<div style="margin-top:6px;padding-top:5px;border-top:1px solid rgba(128,128,128,.25);` +
      `font-size:10px;opacity:.6;font-style:italic">${o.pie}</div>`
    : "";
  return `<div style="min-width:210px;max-width:320px">` +
    `<div style="font-weight:700;font-size:12.5px;display:flex;align-items:center">${o.titulo}${badge}</div>` +
    `<table style="margin-top:5px;border-collapse:collapse">${filas}</table>${pie}</div>`;
}
export const fmtDur = (h: number) =>
  h >= 48 ? `${(h / 24).toFixed(1)} días` : `${h.toFixed(1)} h`;

// Modo oscuro (prefers-color-scheme) → paleta de ejes/rejilla para ECharts
export function useTemaChart() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const fn = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return {
    dark,
    eje: dark ? "#4B5563" : "#E5E7EB",
    rejilla: dark ? "#2a3441" : "#F3F4F6",
    texto: dark ? "#9CA3AF" : "#6B7280",
    textoFuerte: dark ? "#F9FAFB" : "#111928",
    tooltipBg: dark ? "#1F2A37" : "#fff",
  };
}

export function EChart({ option, height = 200, onEvents }: {
  option: EChartsOption; height?: number | string;
  onEvents?: Record<string, (params: unknown) => void>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inst = useRef<echarts.ECharts | null>(null);
  const handlers = useRef(onEvents);
  handlers.current = onEvents;
  useEffect(() => {
    if (!ref.current) return;
    inst.current = echarts.init(ref.current);
    inst.current.setOption(option);
    for (const ev of Object.keys(handlers.current ?? {})) {
      inst.current.on(ev, (p: unknown) => handlers.current?.[ev]?.(p));
    }
    const ro = new ResizeObserver(() => inst.current?.resize());
    ro.observe(ref.current);
    return () => { ro.disconnect(); inst.current?.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    // Merge puro: las series se ACTUALIZAN en su lugar (los puntos con `name`
    // interpolan su posición — efecto motion chart) y ejes/grilla/zoom no se
    // recrean. Contrato: cada gráfico mantiene NÚMERO Y ORDEN de series
    // constante entre renders (series vacías en vez de ausentes).
    inst.current?.setOption(option);
  }, [option]);
  return <div ref={ref} style={{ width: "100%", height, minHeight: 0 }} />;
}

// Contenedor Widget del DS: título 13/600 + meta 11.5 + cuerpo flexible
export function Widget({ title, meta, actions, children, className = "" }: {
  title: React.ReactNode; meta?: React.ReactNode; actions?: React.ReactNode;
  children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`card px-4 py-3 flex flex-col min-w-0 min-h-0 ${className}`}>
      <div className="flex items-start justify-between mb-2 flex-none">
        <div>
          <div className="text-[13px] font-semibold" style={{ letterSpacing: "-0.005em" }}>{title}</div>
          {meta && <div className="text-[11.5px] mt-0.5" style={{ color: "var(--muted)" }}>{meta}</div>}
        </div>
        {actions}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

// StatCard del DS: valor 26/700 tabular + delta pill + sub
export function Stat({ label, value, delta, deltaTone = "neutral", sub }: {
  label: string; value: React.ReactNode; delta?: string;
  deltaTone?: "positive" | "negative" | "neutral"; sub?: React.ReactNode;
}) {
  const tone = {
    positive: { bg: "rgba(14,159,110,0.14)", fg: "#0E9F6E" },
    negative: { bg: "rgba(225,29,72,0.12)", fg: "#E11D48" },
    neutral: { bg: "var(--gray-100)", fg: "var(--muted)" },
  }[deltaTone];
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="text-[11.5px] font-medium" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-[24px] font-bold" style={{ letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
          {value}
        </span>
        {delta && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                style={{ background: tone.bg, color: tone.fg }}>{delta}</span>
        )}
      </div>
      {sub && <div className="text-[11px]" style={{ color: "var(--muted)" }}>{sub}</div>}
    </div>
  );
}

// Donut de distribución A/B/C/D (patrón exposureOpt del Dashboard del DS)
export function donutNiveles(dist: Record<string, number>, tema: ReturnType<typeof useTemaChart>): EChartsOption {
  return {
    tooltip: { trigger: "item", backgroundColor: tema.tooltipBg, textStyle: { color: tema.textoFuerte, fontSize: 11 } },
    series: [{
      type: "pie", radius: ["58%", "82%"], center: ["50%", "50%"],
      avoidLabelOverlap: false,
      label: { show: true, position: "center", formatter: () => `${dist.D ?? 0}\nen D`,
               fontSize: 16, fontWeight: 700, color: DS.rose, lineHeight: 16 },
      data: (["A", "B", "C", "D"] as const).map((n) => ({
        value: dist[n] ?? 0, name: `Nivel ${n}`, itemStyle: { color: DS.nivel[n] },
      })),
    }],
  };
}

// Evolutivo combinado: barras de negros + línea/área de peso (tripsOpt+fuelOpt)
export function comboEvolutivo(
  evo: { semana: string; peso: number; negros: number; n_d: number }[],
  tema: ReturnType<typeof useTemaChart>,
): EChartsOption {
  const sem = evo.map((x) => x.semana.slice(5));
  const sube = evo.length >= 2 && Number(evo[evo.length - 1].peso) > Number(evo[0].peso);
  const linea = sube ? DS.rose : DS.green;
  return {
    grid: { left: 44, right: 40, top: 14, bottom: 20 },
    tooltip: { trigger: "axis", backgroundColor: tema.tooltipBg, textStyle: { color: tema.textoFuerte, fontSize: 11 } },
    xAxis: { type: "category", data: sem, axisLine: { lineStyle: { color: tema.eje } },
             axisLabel: { color: tema.texto, fontSize: 10 } },
    yAxis: [
      { type: "value", splitLine: { lineStyle: { color: tema.rejilla } },
        axisLabel: { color: tema.texto, fontSize: 10 } },
      { type: "value", splitLine: { show: false }, axisLabel: { color: tema.texto, fontSize: 10 } },
    ],
    series: [
      { name: "Cód. negro", type: "bar", data: evo.map((x) => x.negros), barWidth: 14,
        itemStyle: { color: DS.ink, borderRadius: [3, 3, 0, 0], opacity: 0.85 } },
      { name: "Peso ICU", type: "line", yAxisIndex: 1, smooth: true, symbol: "circle", symbolSize: 5,
        data: evo.map((x) => x.peso), lineStyle: { color: linea, width: 2 },
        itemStyle: { color: linea },
        areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [
          { offset: 0, color: sube ? "rgba(225,29,72,0.18)" : "rgba(14,159,110,0.18)" },
          { offset: 1, color: "rgba(0,0,0,0)" }] } } },
    ],
  };
}
