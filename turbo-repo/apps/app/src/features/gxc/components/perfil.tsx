"use client";

import "@/features/gemelo-common/gemelo.css";

// GxC v2 · N3 — EL INDIVIDUO: la historia en 4 capítulos (exposición →
// consecuencia → respuesta → tendencia) y un TIMELINE HORIZONTAL de 4
// carriles: viajes (barras), síntomas (bins por hora), consecuencias y
// respuesta. Cada elemento con servicio salta al microscopio del replay.
// El contraste con/sin señal se muestra siempre — contraste, no causalidad.
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { EChartsOption } from "echarts";
import { golFetcher as fetcher } from "@/features/gemelo-common/fetcher";
import { EChart, Widget, useTemaChart, tipCard, fmtDur } from "@/features/gemelo-common/ds-widgets";
import { TIPO_META, MIX_META, TIPO_MIX, DUENIO_META, type PerfilGxc, pct } from "../model";
import { usePeriodo, PeriodoChips } from "./periodo";

type Tema = ReturnType<typeof useTemaChart>;

const ICU_COLOR: Record<number, string> = {
  1: "#1C64F2", 2: "#F1B300", 3: "#E11D48", 4: "#111928",
};
// Semántica corregida (Erick 2026-07-22): "expired" = el ciclo del síntoma
// terminó — es el estado terminal normal (>99% histórico), NO implica
// no-respuesta ni responsabilidad. Gestión real = validated/invalidated.
const ESTADO_COLOR = (estado: string, dark: boolean) =>
  ["validated", "invalidated", "done", "closed", "completed"].includes(estado) ? "#0E9F6E"
  : ["active", "pending"].includes(estado) ? "#1C64F2"
  : dark ? "#6B7280" : "#9CA3AF";

const LANES = ["Viajes", "Síntomas", "Consecuencias", "Respuesta"];

const fmtDia = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
const fmtTs = (ts: number) =>
  new Date(ts * 1000).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// HISTORIA v2 — "fila por viaje" (decisión Erick): cada viaje es una fila y
// TODO lo suyo (monitoreo, proceso, síntomas, consecuencia, tratamientos)
// vive sobre esa fila. La conexión se ve, no se deduce.
function opcionHistoria(
  p: PerfilGxc, tema: Tema,
  cursor: number | null,
  zoom: { start: number; end: number } | null
): { option: EChartsOption; filas: number } | null {
  const finMs = p.periodo.fin * 1000;
  const iniMs = finMs - p.periodo.dias * 86_400_000;
  const tl = p.timeline;
  if (!tl.viajes.length) return null;

  const corte = cursor ?? Number.MAX_SAFE_INTEGER;
  const porDia = p.periodo.dias >= 84;
  const DIA = 86_400;

  // Filas: cronológico por inicio (bitácora). El eje categórico usa el código.
  const orden = [...tl.viajes].sort((a, b) => a.ini - b.ini);
  const cats = orden.map((v) => v.s);
  const consPorViaje = new Map(orden.map((v) => [v.s, v.cons]));

  // Barras (recortadas al cursor durante la reproducción)
  const viajes = orden
    .filter((v) => v.ini <= corte)
    .map((v) => [
      v.ini * 1000, Math.min(Math.max(v.fin, v.ini + 900), corte) * 1000,
      v.cons ? 1 : 0, v.s, v.ruta, v.camion,
      v.ini_log * 1000, Math.min(Math.max(v.fin_log, v.ini_log + 900), corte) * 1000,
      v.mon ? 1 : 0,
    ]);

  // Síntomas del viaje (hora; por día en rangos largos)
  let sintomas: (string | number)[][];
  if (porDia) {
    const bins = new Map<string, { t: number; n: number; icu: number }>();
    for (const x of tl.sintomas) {
      if (x.t > corte) continue;
      const d = Math.floor(x.t / DIA) * DIA;
      const k = `${x.s}|${d}`;
      const b = bins.get(k) ?? { t: d + DIA / 2, n: 0, icu: 1 };
      b.n += x.n; b.icu = Math.max(b.icu, x.icu); bins.set(k, b);
    }
    sintomas = [...bins.entries()].map(([k, b]) =>
      [b.t * 1000, k.split("|")[0], b.n, Math.min(4, Math.max(1, b.icu))]);
  } else {
    sintomas = tl.sintomas.filter((x) => x.t <= corte)
      .map((x) => [x.t * 1000, x.s, x.n, Math.min(4, Math.max(1, x.icu))]);
  }

  const consecuencias = tl.consecuencias.filter((c) => c.t <= corte)
    .map((c) => [c.t * 1000, c.s, c.tipo, c.s, c.detalle]);

  let respuesta: (string | number)[][];
  if (porDia) {
    const bins = new Map<string, { t: number; n: number; enCurso: number; gestion: number }>();
    for (const r of tl.respuesta) {
      if (r.t > corte) continue;
      const d = Math.floor(r.t / DIA) * DIA;
      const k = `${r.s}|${d}`;
      const b = bins.get(k) ?? { t: d + DIA / 2, n: 0, enCurso: 0, gestion: 0 };
      b.n += 1;
      if (["active", "pending"].includes(r.estado)) b.enCurso += 1;
      if (["validated", "invalidated"].includes(r.estado)) b.gestion += 1;
      bins.set(k, b);
    }
    respuesta = [...bins.entries()].map(([k, b]) => [b.t * 1000, k.split("|")[0],
      b.gestion > 0 ? "validated" : b.enCurso > 0 ? "active" : "expired",
      `${b.n} tratamientos${b.enCurso ? ` · ${b.enCurso} en curso` : ""}`, "día", k.split("|")[0], b.n]);
  } else {
    respuesta = tl.respuesta.filter((r) => r.t <= corte)
      .map((r) => [r.t * 1000, r.s, r.estado, r.quien, r.tipo, r.s, 1]);
  }

  const zoomStart = zoom ? zoom.start : p.periodo.dias > 28 ? (1 - 28 / p.periodo.dias) * 100 : 0;
  const zoomEnd = zoom ? zoom.end : 100;

  const option: EChartsOption = {
    tooltip: {
      backgroundColor: tema.tooltipBg, textStyle: { color: tema.textoFuerte, fontSize: 11 },
      formatter: (q: unknown) => {
        const { seriesName, data } = q as { seriesName: string; data: (string | number)[] };
        const f = (ms: number) => fmtTs(ms / 1000);
        if (seriesName === "Viajes") {
          const hMon = (Number(data[1]) - Number(data[0])) / 3_600_000;
          const hLog = (Number(data[7]) - Number(data[6])) / 3_600_000;
          return tipCard({
            titulo: `Viaje ${data[3]}`,
            badge: data[2] ? { texto: "con consecuencia", tono: "rojo" }
                           : { texto: "sin consecuencia", tono: "verde" },
            filas: [
              ["Ruta", String(data[4])],
              ["Camión", String(data[5])],
              ["Monitoreo", `${f(Number(data[0]))} → ${f(Number(data[1]))} · ${fmtDur(hMon)}`],
              ["Proceso", `${fmtDur(hLog)}${data[8] ? "" : " · sin ventana de monitoreo"}`],
            ],
            pie: "clic → microscopio del replay",
          });
        }
        if (seriesName === "Síntomas") {
          const icu = Number(data[3]);
          return tipCard({
            titulo: `Viaje ${data[1]}`,
            badge: { texto: `ICU máx ${icu}`, tono: icu >= 4 ? "negro" : icu === 3 ? "rojo" : icu === 2 ? "ambar" : "azul" },
            filas: [["Momento", f(Number(data[0]))], ["Síntomas", `${data[2]}`]],
            pie: "clic → microscopio del replay",
          });
        }
        if (seriesName === "Consecuencias") {
          const k = String(data[2]);
          const duenio = DUENIO_META[MIX_META[k]?.duenio ?? ""];
          return tipCard({
            titulo: MIX_META[k]?.label ?? k,
            badge: duenio ? { texto: duenio.label, tono: duenio.tono } : undefined,
            filas: [["Viaje", String(data[3])], ["Detalle", String(data[4])], ["Momento", f(Number(data[0]))]],
            pie: "clic → microscopio del replay",
          });
        }
        if (seriesName === "Cursor") return "";
        if (data[4] === "día")
          return tipCard({ titulo: `Viaje ${data[1]}`,
            filas: [["Tratamientos", String(data[3])], ["Día", f(Number(data[0]))]] });
        const estado = String(data[2]);
        return tipCard({
          titulo: `Tratamiento · ${data[4]}`,
          badge: ["validated", "invalidated"].includes(estado)
            ? { texto: "gestionado", tono: "verde" }
            : ["active", "pending"].includes(estado)
              ? { texto: "en curso", tono: "azul" }
              : { texto: "ciclo terminado", tono: "gris" },
          filas: [["Responsable", String(data[3])], ["Viaje", String(data[5])], ["Momento", f(Number(data[0]))]],
          pie: "clic → microscopio del replay",
        });
      },
    },
    grid: { left: 92, right: 18, top: 8, bottom: 46 },
    dataZoom: [
      { type: "inside", xAxisIndex: 0, filterMode: "weakFilter", start: zoomStart, end: zoomEnd },
      { type: "slider", xAxisIndex: 0, height: 16, bottom: 4,
        filterMode: "weakFilter", brushSelect: false,
        borderColor: tema.eje, handleStyle: { color: tema.texto },
        textStyle: { color: tema.texto, fontSize: 9 },
        start: zoomStart, end: zoomEnd },
    ],
    xAxis: {
      type: "time", min: iniMs, max: finMs,
      axisLabel: { color: tema.texto, fontSize: 10, hideOverlap: true },
      splitLine: { lineStyle: { color: tema.rejilla } },
    },
    yAxis: {
      type: "category", data: cats, inverse: true,
      axisLine: { lineStyle: { color: tema.eje } },
      axisLabel: {
        fontSize: 10, fontFamily: "ui-monospace, monospace",
        color: (v?: string | number) => (consPorViaje.get(String(v)) ? "#E11D48" : tema.texto),
      },
      splitLine: { show: true, lineStyle: { color: tema.rejilla, opacity: 0.5 } },
    },
    series: [
      {
        name: "Viajes", type: "custom", clip: true,
        encode: { x: [0, 1, 6, 7], y: 3 },
        data: viajes,
        renderItem: (_p: unknown, api: {
          value: (i: number) => number | string;
          coord: (v: (number | string)[]) => number[];
        }) => {
          const cat = api.value(3);
          const a = api.coord([api.value(0), cat]);
          const b = api.coord([api.value(1), cat]);
          const gl = api.coord([api.value(6), cat]);
          const fl = api.coord([api.value(7), cat]);
          const color = api.value(2) ? "rgba(225,29,72,0.8)" : "rgba(28,100,242,0.6)";
          return {
            type: "group",
            children: [
              { type: "rect",
                shape: { x: gl[0], y: a[1] - 0.75, width: Math.max(2, fl[0] - gl[0]), height: 1.5 },
                style: { fill: api.value(2) ? "rgba(225,29,72,0.25)" : "rgba(28,100,242,0.22)" } },
              { type: "rect",
                shape: { x: a[0], y: a[1] - 5, width: Math.max(2, b[0] - a[0]), height: 10, r: 2 },
                style: { fill: color } },
            ],
          };
        },
      },
      {
        name: "Síntomas", type: "scatter", data: sintomas,
        symbol: "circle",
        symbolSize: (d: (string | number)[]) => 4 + Math.min(porDia ? 8 : 10, Math.sqrt(Number(d[2])) * 2.2),
        itemStyle: {
          color: (q: { data: (string | number)[] }) => {
            const icu = Number(q.data[3]);
            return icu === 4 && tema.dark ? "#F3F4F6" : ICU_COLOR[icu];
          },
          opacity: 0.75,
        },
        z: 5,
      },
      {
        name: "Consecuencias", type: "scatter", data: consecuencias,
        symbol: "triangle", symbolSize: 11, symbolOffset: [0, -11],
        itemStyle: {
          color: (q: { data: (string | number)[] }) => MIX_META[String(q.data[2])]?.color ?? "#E11D48",
          borderColor: tema.dark ? "#111928" : "#FFFFFF", borderWidth: 1,
        },
        z: 6,
      },
      {
        name: "Respuesta", type: "scatter", data: respuesta,
        symbol: "rect", symbolOffset: [0, 9],
        symbolSize: (d: (string | number)[]) => {
          const n = Math.sqrt(Number(d[6] ?? 1));
          return [4 + Math.min(8, n * 2), 4];
        },
        itemStyle: {
          color: (q: { data: (string | number)[] }) => ESTADO_COLOR(String(q.data[2]), tema.dark),
          opacity: 0.8,
        },
        z: 4,
      },
      {
        name: "Cursor", type: "line" as const, silent: true, animation: false,
        symbol: "none", z: 10,
        lineStyle: { color: tema.textoFuerte, width: 1.5 },
        data: cursor ? [[cursor * 1000, cats[0]], [cursor * 1000, cats[cats.length - 1]]] : [],
      },
    ] as unknown as EChartsOption["series"],
  };
  return { option, filas: cats.length };
}

// ── B · La historia ESCRITA: frases generadas de los datos, con evidencia ──
type Frase = { texto: string; micro?: { ini: number; fin: number; label: string; asset?: string } };
function narrar(p: PerfilGxc): Frase[] {
  const cap = p.capitulos;
  const tl = p.timeline;
  const frases: Frase[] = [];
  if (!cap) return frases;
  const claves = p.mix_claves ?? TIPO_MIX[p.tipo] ?? Object.keys(cap.mix ?? {});
  const mixTxt = claves
    .filter((k) => (cap.mix?.[k] ?? 0) > 0)
    .map((k) => `${MIX_META[k]?.label.split(" ")[0].toLowerCase() ?? k} ${cap.mix[k]}`)
    .join(" · ") || "ninguna";
  frases.push({
    texto: `En ${p.periodo.dias} días cerró ${cap.viajes} viajes: ${cap.con_exposicion} con señal y ` +
      `${cap.con_consecuencia} con consecuencia (${mixTxt}). El monitoreo cubrió ` +
      `${p.cobertura_monitoreo != null ? Math.round(p.cobertura_monitoreo * 100) : "—"}% del tiempo de proceso.`,
  });
  // día pico de síntomas
  if (tl.sintomas.length) {
    const porDia = new Map<number, number>();
    for (const x of tl.sintomas) {
      const d = Math.floor(x.t / 86_400) * 86_400;
      porDia.set(d, (porDia.get(d) ?? 0) + x.n);
    }
    const [dPico, nPico] = [...porDia.entries()].sort((a, b) => b[1] - a[1])[0];
    frases.push({ texto: `El día más ruidoso fue el ${fmtDia(dPico)}: ${nPico} síntomas.` });
  }
  // viaje más duro: con consecuencia y más síntomas
  const porViaje = new Map<string, number>();
  for (const x of tl.sintomas) porViaje.set(x.s, (porViaje.get(x.s) ?? 0) + x.n);
  const duros = tl.viajes.filter((v) => v.cons)
    .map((v) => ({ v, n: porViaje.get(v.s) ?? 0 }))
    .sort((a, b) => b.n - a.n);
  if (duros.length) {
    const { v, n } = duros[0];
    const tipos = tl.consecuencias.filter((c) => c.s === v.s).map((c) => c.tipo);
    frases.push({
      texto: `El viaje más duro fue ${v.s} (${v.camion}, ${v.ruta}): ${n} síntomas y cerró con ` +
        `${[...new Set(tipos)].join(" + ") || "consecuencia"}. Ver la evidencia →`,
      micro: Math.abs(v.fin_log - v.fin) <= 72 * 3600
        ? { ini: v.ini, fin: v.fin, label: v.s, asset: v.camion }
        : { ini: v.fin_log - 86_400, fin: v.fin_log + 3_600, label: v.s, asset: v.camion },
    });
  }
  // respuesta
  const enCurso = p.respuesta.total - p.respuesta.expirados;
  const top = p.respuesta.por_responsable?.[0];
  if (p.respuesta.total > 0) {
    frases.push({
      texto: `Se generaron ${p.respuesta.total} tratamientos` +
        `${enCurso > 0 ? ` (${enCurso} en curso)` : ""}` +
        `${top ? `; el mayor volumen quedó asignado a ${top.quien} (${top.n})` : ""}.`,
    });
  }
  // tendencia
  if (p.tendencia?.tasa_prev != null && p.tendencia?.tasa_act != null) {
    const a = Math.round(Number(p.tendencia.tasa_prev) * 100);
    const b = Math.round(Number(p.tendencia.tasa_act) * 100);
    frases.push({
      texto: `Tendencia: ${a}% → ${b}% de viajes con consecuencia vs el período anterior ` +
        `(${b < a ? "mejorando" : b > a ? "empeorando" : "estable"}).`,
    });
  }
  return frases;
}

export function Perfil({ lang }: { lang: string }) {
  const params = useParams<{ tipo: string; id: string }>();
  const router = useRouter();
  const tema = useTemaChart();
  const tipo = params.tipo;
  const id = decodeURIComponent(params.id);
  const { dias, setDias, qs } = usePeriodo();
  const meta = TIPO_META[tipo];

  const { data: p } = useSWR<PerfilGxc>(
    `/rpc/fn_dx_gol_gxc_perfil?p_tipo=${tipo}&p_id=${encodeURIComponent(id)}&p_dias=${dias}`,
    fetcher, { refreshInterval: 300_000, keepPreviousData: true });

  // Línea base anónima del período (agregados de la operación completa),
  // con la MISMA composición de consecuencias que este tipo de sujeto:
  // la referencia contra la que se lee el mix propio.
  const { data: blAnon } = useSWR<{
    viajes: number; tasa_consecuencia: number;
    mix: Record<string, number>;
    contraste: { con_exposicion: number | null; sin_exposicion: number | null };
  }>(`/rpc/fn_dx_gol_gxc_baseline?p_dias=${dias}&p_tipo=${tipo}`,
    fetcher, { refreshInterval: 300_000, keepPreviousData: true });

  const cap = p?.capitulos;
  const camionPorServicio = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of p?.timeline?.viajes ?? []) m.set(v.s, v.camion);
    return m;
  }, [p]);

  // Reproductor de la historia (patrón del replay del gemelo): un cursor que
  // avanza DÍA a DÍA dentro del período y la historia se construye en pantalla.
  const [cursor, setCursor] = useState<number | null>(null);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [velIdx, setVelIdx] = useState(1);
  const VELS = [900, 450, 180]; // ms por día (×1, ×2, ×5)
  const [zoomWin, setZoomWin] = useState<{ start: number; end: number } | null>(null);
  const zoomRef = useRef(zoomWin); zoomRef.current = zoomWin;
  const periodoIni = p ? p.periodo.fin - p.periodo.dias * 86_400 : 0;

  useEffect(() => {
    if (!reproduciendo || !p) return;
    const id = setInterval(() => {
      setCursor((c) => {
        const next = (c ?? periodoIni) + 86_400;
        if (next >= p.periodo.fin) { setReproduciendo(false); return p.periodo.fin; }
        return next;
      });
    }, VELS[velIdx]);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reproduciendo, velIdx, p?.periodo.fin]);

  // al cambiar de período/entidad, resetear reproducción
  useEffect(() => { setCursor(null); setReproduciendo(false); setZoomWin(null); },
    [dias, id, tipo]);

  const historia = useMemo(
    () => (p ? opcionHistoria(p, tema, cursor, zoomWin) : null),
    [p, tema, cursor, zoomWin]);
  const alturaHistoria = historia ? Math.min(880, Math.max(340, historia.filas * 24 + 90)) : 340;
  const frases = useMemo(() => (p ? narrar(p) : []), [p]);

  const onZoom = (e: unknown) => {
    const ev = e as { start?: number; end?: number; batch?: { start: number; end: number }[] };
    const z = ev.batch?.[0] ?? ev;
    if (typeof z.start === "number" && typeof z.end === "number")
      setZoomWin({ start: z.start, end: z.end });
  };

  const irMicroscopio = (q: unknown) => {
    const { seriesName, data } = q as { seriesName: string; data: (string | number)[] };
    if (seriesName === "Cursor") return;
    let ini: number, fin: number, servicio: string | undefined;
    if (seriesName === "Viajes") {
      // Ventana cuerda: monitoreo solo si es coherente con el cierre
      // logístico (hay trips con mon en otro mes por trip_id reciclado);
      // si no, la llegada logística acotada a 24 h.
      const finMon = Number(data[1]) / 1000;
      const finLog = Number(data[7]) / 1000;
      if (Math.abs(finLog - finMon) <= 72 * 3600) {
        ini = Number(data[0]) / 1000; fin = finMon;
      } else {
        ini = finLog - 86400; fin = finLog + 3600;
      }
      servicio = String(data[3]);
    } else {
      const t = Number(data[0]) / 1000;
      ini = t - 1800; fin = t + 1800;
      servicio = String(seriesName === "Consecuencias" ? data[3]
        : seriesName === "Síntomas" ? data[1] : data[5]);
    }
    const camion = servicio ? camionPorServicio.get(servicio) : undefined;
    router.push(`/${lang}/gemelo/replay?micro_ini=${Math.round(ini)}&micro_fin=${Math.round(fin)}` +
      `&micro_label=${encodeURIComponent(servicio ?? fmtTs(ini))}` +
      (camion ? `&micro_asset=${encodeURIComponent(camion)}` : ""));
  };

  const tend = p?.tendencia;
  const dTend = tend?.tasa_act != null && tend?.tasa_prev != null
    ? Number(tend.tasa_act) - Number(tend.tasa_prev) : null;
  const topResp = p?.respuesta?.por_responsable?.[0];

  // Capítulos AL CURSOR: durante la reproducción los contadores acompañan a
  // la historia (acumulado de viajes cerrados hasta el día del cursor).
  const capAcum = useMemo(() => {
    if (cursor == null || !p?.timeline || !cap) return null;
    const vs = p.timeline.viajes.filter((v) => v.fin_log <= cursor);
    const conSenal = new Set(p.timeline.sintomas.map((x) => x.s));
    const ids = new Set(vs.map((v) => v.s));
    const mix: Record<string, number> = {};
    for (const c of p.timeline.consecuencias) {
      if (ids.has(c.s)) mix[c.tipo] = (mix[c.tipo] ?? 0) + 1;
    }
    return {
      viajes: vs.length,
      con_exposicion: vs.filter((v) => conSenal.has(v.s)).length,
      con_consecuencia: vs.filter((v) => v.cons).length,
      mix,
      respuesta: p.timeline.respuesta.filter((r) => r.t <= cursor).length,
    };
  }, [cursor, p, cap]);
  const alCursor = capAcum != null && cursor != null;

  const paramTele: Record<string, string> = {
    camion: "tele_camion", conductor: "tele_conductor", carrier: "tele_carrier", ruta: "tele_ruta",
  };

  return (
    <div className="gemelo-scope h-full w-full overflow-y-auto"><div className="p-4 space-y-3 max-w-[1440px] mx-auto">
      {/* Cabecera */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href={`/${lang}/gxc/${tipo}?${qs}`} className="text-[13px] hover:underline" style={{ color: "var(--muted)" }}>
          ← {meta?.label ?? tipo}
        </Link>
        <h2 className="text-[20px] font-semibold">{id}</h2>
        <span className="text-[13px]" style={{ color: "var(--muted)" }}>{meta?.singular ?? tipo}</span>
        <span className="flex-1" />
        <PeriodoChips dias={dias} onChange={setDias} />
        {paramTele[tipo] && (
          <Link className="btn-primary"
                href={`/${lang}/gemelo/replay?tele_dias=${dias}&${paramTele[tipo]}=${encodeURIComponent(id)}`}>
            Ver en mapa →
          </Link>
        )}
      </div>

      {/* Los 4 capítulos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            1 · Exposición{alCursor && <span style={{ color: "var(--blue-700)" }}> · al {fmtDia(cursor!)}</span>}
          </div>
          <div className="text-[24px] font-semibold">
            {capAcum ? `${capAcum.con_exposicion}/${capAcum.viajes}` : cap ? `${cap.con_exposicion}/${cap.viajes}` : "—"}
            <span className="text-[13px] font-normal ml-2" style={{ color: "var(--muted)" }}>
              {capAcum ? pct(capAcum.con_exposicion / Math.max(1, capAcum.viajes))
                : cap ? pct(cap.con_exposicion / Math.max(1, cap.viajes)) : ""}
            </span>
          </div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            viajes con síntomas ICU≥2
            {!alCursor && p?.cobertura_monitoreo != null && (
              <> · monitoreo cubre {pct(p.cobertura_monitoreo)} del tiempo de proceso</>
            )}
          </div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            2 · Consecuencia{alCursor && <span style={{ color: "var(--blue-700)" }}> · al {fmtDia(cursor!)}</span>}
          </div>
          <div className="text-[24px] font-semibold">
            {capAcum ? `${capAcum.con_consecuencia}/${capAcum.viajes}` : cap ? `${cap.con_consecuencia}/${cap.viajes}` : "—"}
            <span className="text-[13px] font-normal ml-2" style={{ color: "var(--muted)" }}>
              {capAcum ? pct(capAcum.con_consecuencia / Math.max(1, capAcum.viajes))
                : cap ? pct(cap.con_consecuencia / Math.max(1, cap.viajes)) : ""}
            </span>
          </div>
          <div className="text-[12px] flex gap-2 flex-wrap">
            {cap && (p?.mix_claves ?? TIPO_MIX[tipo] ?? []).map((k) => {
              const n = (capAcum ?? cap).mix?.[k] ?? 0;
              return n > 0 && (
                <span key={k} className="inline-flex items-center gap-1" title={MIX_META[k]?.nota}
                      style={{ color: "var(--muted)" }}>
                  <span className="w-2 h-2 rounded-sm" style={{ background: MIX_META[k]?.color }} />
                  {MIX_META[k]?.label.split(" ")[0].toLowerCase() ?? k} <b>{n}</b>
                </span>
              );
            })}
            {cap && !(capAcum ?? cap).con_consecuencia && <span style={{ color: "var(--muted)" }}>sin consecuencias</span>}
          </div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            3 · Respuesta{alCursor && <span style={{ color: "var(--blue-700)" }}> · al {fmtDia(cursor!)}</span>}
          </div>
          <div className="text-[24px] font-semibold">
            {capAcum ? capAcum.respuesta.toLocaleString() : p?.respuesta?.total?.toLocaleString() ?? "—"}
            {!alCursor && p && p.respuesta.total > 0 && (
              <span className="text-[13px] font-normal ml-2" style={{ color: "var(--muted)" }}>
                {p.respuesta.total - p.respuesta.expirados} en curso
              </span>
            )}
          </div>
          <div className="text-[12px] truncate" style={{ color: "var(--muted)" }}>
            {alCursor ? "tratamientos generados hasta el día del cursor"
              : topResp ? `mayor volumen asignado: ${topResp.quien} (${topResp.n})` : "tratamientos generados en el período"}
          </div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>4 · Tendencia</div>
          <div className="text-[24px] font-semibold flex items-baseline gap-2">
            {pct(tend?.tasa_act)}
            {dTend != null && (
              <span className="text-[14px] font-semibold"
                    style={{ color: dTend > 0 ? "var(--rose-600)" : "var(--green-500)" }}>
                {dTend > 0 ? "▲" : "▼"} {Math.abs(Math.round(dTend * 100))} pts
              </span>
            )}
          </div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            {tend?.tasa_prev != null
              ? `período anterior: ${pct(tend.tasa_prev)} (${tend.viajes_prev} viajes)`
              : "sin período anterior comparable"}
          </div>
        </div>
      </div>

      {/* Timeline horizontal — la historia operacional */}
      <Widget title="Historia operacional"
              meta="cada FILA es un viaje: barra = monitoreo · línea tenue = proceso logístico · rojo = con consecuencia · puntos = sus síntomas (color ICU) · ▲ su consecuencia · marcas bajo la barra = sus tratamientos — clic en cualquier cosa salta al microscopio">
        {historia && p && p.timeline.viajes.length
          ? (
            <div className="space-y-1.5">
              {/* B · la historia escrita — generada de los datos, con evidencia */}
              <div className="rounded-lg px-3 py-2 space-y-0.5 text-[12.5px]"
                   style={{ background: "var(--ghost-hover)" }}>
                {frases.map((fr, i) => (
                  <div key={i} className="flex gap-1.5">
                    <span style={{ color: "var(--muted)" }}>·</span>
                    {fr.micro ? (
                      <button className="text-left hover:underline"
                        style={{ color: "var(--foreground)" }}
                        onClick={() => router.push(`/${lang}/gemelo/replay?micro_ini=${Math.round(fr.micro!.ini)}` +
                          `&micro_fin=${Math.round(fr.micro!.fin)}&micro_label=${encodeURIComponent(fr.micro!.label)}` +
                          (fr.micro!.asset ? `&micro_asset=${encodeURIComponent(fr.micro!.asset)}` : ""))}>
                        {fr.texto}
                      </button>
                    ) : <span>{fr.texto}</span>}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap text-[12px]">
                <button className="btn-primary" style={{ paddingTop: 4, paddingBottom: 4 }}
                  onClick={() => {
                    if (reproduciendo) { setReproduciendo(false); return; }
                    if (cursor == null || cursor >= p.periodo.fin) setCursor(periodoIni);
                    setZoomWin({ start: 0, end: 100 }); // ver el período completo al reproducir
                    setReproduciendo(true);
                  }}>
                  {reproduciendo ? "⏸ Pausa" : "▶ Reproducir día a día"}
                </button>
                {[0, 1, 2].map((i) => (
                  <button key={i} onClick={() => setVelIdx(i)}
                    className="px-2 py-0.5 rounded-full border text-[11px] font-semibold"
                    style={velIdx === i
                      ? { background: "var(--blue-600)", color: "#fff", borderColor: "var(--blue-600)" }
                      : { background: "var(--surface)", color: "var(--muted)", borderColor: "var(--border)" }}>
                    ×{[1, 2, 5][i]}
                  </button>
                ))}
                <input type="range" className="flex-1 min-w-[160px]"
                  min={periodoIni} max={p.periodo.fin} step={86_400}
                  value={cursor ?? p.periodo.fin}
                  onChange={(e) => { setReproduciendo(false); setZoomWin({ start: 0, end: 100 }); setCursor(Number(e.target.value)); }} />
                <span className="font-semibold w-[64px]" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {fmtDia(cursor ?? p.periodo.fin)}
                </span>
                {cursor != null && (
                  <button className="text-[11px] hover:underline" style={{ color: "var(--blue-700)" }}
                    onClick={() => { setReproduciendo(false); setCursor(null); }}>
                    ver todo
                  </button>
                )}
                <span className="text-[10.5px]" style={{ color: "var(--muted)" }}>
                  rueda = zoom · arrastrar barra inferior = desplazar
                </span>
              </div>
              <EChart option={historia.option} height={alturaHistoria}
                onEvents={{ click: irMicroscopio, datazoom: onZoom }} />
            </div>
          )
          : <div className="text-[13px] py-6 space-y-1" style={{ color: "var(--muted)" }}>
              {!p ? "Cargando historia…" : (
                <>
                  <div>
                    Sin viajes cerrados en {dias === 7 ? "los últimos 7 días" : `las últimas ${dias / 7} semanas`}.
                    {p.ultimo_viaje != null && (
                      <> Último viaje cerrado: <b style={{ color: "var(--foreground)" }}>{fmtTs(p.ultimo_viaje)}</b>
                        {" "}(hace {Math.max(1, Math.round((p.periodo.fin - p.ultimo_viaje) / 86_400))} días).
                      </>
                    )}
                    {p.ultimo_viaje == null && <> No hay viajes registrados para esta entidad en el gemelo.</>}
                  </div>
                  {p.ultimo_viaje != null && (
                    <div className="text-[12px]">
                      No es una falla de datos: la entidad estuvo inactiva en la ventana elegida.
                      Amplía el período para ver su historia.
                    </div>
                  )}
                </>
              )}
            </div>}
      </Widget>

      <div className="grid md:grid-cols-2 gap-3">
        {/* Qué mueve tu tasa — la palanca, por tipo, contra la operación */}
        <section className="card px-5 py-4 space-y-2">
          <div className="font-semibold text-[14px]">Qué mueve tu tasa
            <span className="text-[11px] font-normal ml-2" style={{ color: "var(--muted)" }}>
              tu tasa por tipo de consecuencia vs la operación completa (anónima)
            </span>
          </div>
          {cap && blAnon && (() => {
            const claves = p?.mix_claves ?? TIPO_MIX[tipo] ?? [];
            const filas = claves.map((k) => {
              const propia = (cap.mix?.[k] ?? 0) / Math.max(1, cap.viajes);
              const base = (blAnon.mix?.[k] ?? 0) / Math.max(1, blAnon.viajes);
              return { k, propia, base, ratio: base > 0 ? propia / base : propia > 0 ? 99 : 1 };
            }).sort((a, b) => b.ratio - a.ratio);
            const palanca = filas[0];
            return (
              <>
                {filas.map(({ k, propia, base, ratio }) => (
                  <div key={k} className="flex items-center gap-2 text-[12.5px]">
                    <span className="w-2.5 h-2.5 rounded-sm flex-none" style={{ background: MIX_META[k]?.color }} />
                    <span className="w-[150px] flex-none">{MIX_META[k]?.label ?? k}</span>
                    <span className="font-semibold w-[46px] text-right" style={{
                      fontVariantNumeric: "tabular-nums",
                      color: ratio >= 1.25 ? "var(--rose-600)" : ratio <= 0.75 ? "var(--green-500)" : "var(--foreground)",
                    }}>{pct(propia)}</span>
                    <span className="flex-1 h-2 rounded-full overflow-hidden relative" style={{ background: "var(--ghost-hover)" }}>
                      <span className="absolute inset-y-0 left-0 rounded-full"
                            style={{ width: `${Math.min(100, propia * 100)}%`, background: MIX_META[k]?.color, opacity: 0.85 }} />
                      <span className="absolute inset-y-0 w-px" title="operación completa"
                            style={{ left: `${Math.min(100, base * 100)}%`, background: "var(--foreground)" }} />
                    </span>
                    <span className="flex-none text-[11px] w-[110px]" style={{ color: "var(--muted)" }}>
                      operación: {pct(base)}
                    </span>
                  </div>
                ))}
                <div className="text-[12px] pt-1">
                  {palanca && palanca.ratio >= 1.25 ? (
                    <>Lo que más mueve tu tasa es <b>{MIX_META[palanca.k]?.label.toLowerCase() ?? palanca.k}</b>: {pct(palanca.propia)} de
                    tus viajes contra {pct(palanca.base)} de la operación ({palanca.ratio.toFixed(1)}×).{" "}
                    {MIX_META[palanca.k]?.duenio === "conductor" &&
                      <>Es una palanca <b>del conductor</b>: pasa en ruta o en el cierre del servicio — feedback directo a quien conduce.</>}
                    {MIX_META[palanca.k]?.duenio === "transportista" &&
                      <>Es una palanca <b>del transportista</b>: integración y continuidad de señal de su flota, no conducta de un conductor.</>}
                    {MIX_META[palanca.k]?.duenio === "camion" &&
                      <>Es una palanca de <b>equipo</b>: salud del hardware a bordo — mantención, no conducción.</>}
                    {MIX_META[palanca.k]?.duenio === "operacion" &&
                      <>Ojo: esta palanca es de <b>operación Mintral</b> (compromisos de carga en terminal) — la conversación es con la torre.</>}
                  </>) : (
                    <>Ningún tipo destaca sobre la operación (todos bajo 1.25×) — tu mix acompaña al del período.</>
                  )}
                </div>
                <div className="flex gap-3 flex-wrap text-[10.5px] pt-0.5" style={{ color: "var(--muted)" }}>
                  {claves.map((k) => (
                    <span key={k}>· {MIX_META[k]?.nota ?? k}</span>
                  ))}
                </div>
                <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                  {(() => {
                    const c = cap.contraste?.con_exposicion, sn = cap.contraste?.sin_exposicion;
                    if (c == null || sn == null) return "Contraste con/sin señal: sin grupo de comparación en este período.";
                    const d = Math.abs(Number(c) - Number(sn));
                    return d < 0.05
                      ? `Contraste con/sin señal: ${pct(c)} vs ${pct(sn)} — la señal NO discrimina en este período (casi todo viaje termina igual): el diagnóstico útil es el mix de arriba.`
                      : Number(sn) > Number(c)
                        ? `Contraste con/sin señal: ${pct(c)} vs ${pct(sn)} — los viajes SIN señal terminan peor: problema de cobertura de monitoreo, no de conducta.`
                        : `Contraste con/sin señal: ${pct(c)} vs ${pct(sn)} — la señal anticipa consecuencia (contraste observado, no causal).`;
                  })()}
                </div>
              </>
            );
          })()}
        </section>

        {/* Tratamientos por asignado — volumen, sin atribución de culpa:
            "expired" = ciclo del síntoma terminado (estado terminal normal) */}
        <section className="card px-5 py-4 space-y-1.5">
          <div className="font-semibold text-[14px]">Tratamientos por asignado
            <span className="text-[11px] font-normal ml-2" style={{ color: "var(--muted)" }}>
              volumen del período · «expirado» = ciclo del síntoma terminado, no implica falta de gestión
            </span>
          </div>
          {(p?.respuesta?.por_responsable ?? []).map((r) => (
            <div key={r.quien} className="flex items-center gap-2 text-[12px]">
              <span className="truncate flex-1">{r.quien}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{r.n}</span>
              <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                {r.n - r.expirados > 0 ? `${r.n - r.expirados} en curso` : "todos cerrados"}
              </span>
            </div>
          ))}
          {p && !p.respuesta.por_responsable.length && (
            <div className="text-[12px]" style={{ color: "var(--muted)" }}>Sin tratamientos en el período</div>
          )}
        </section>
      </div>
    </div></div>
  );
}
