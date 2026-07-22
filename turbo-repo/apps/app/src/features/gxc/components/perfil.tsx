"use client";

import "@/features/gemelo-common/gemelo.css";

// GxC v2 · N3 — EL INDIVIDUO: la historia en 4 capítulos (exposición →
// consecuencia → respuesta → tendencia) y un TIMELINE HORIZONTAL de 4
// carriles: viajes (barras), síntomas (bins por hora), consecuencias y
// respuesta. Cada elemento con servicio salta al microscopio del replay.
// El contraste con/sin señal se muestra siempre — contraste, no causalidad.
import { useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { EChartsOption } from "echarts";
import { golFetcher as fetcher } from "@/features/gemelo-common/fetcher";
import { EChart, Widget, useTemaChart } from "@/features/gemelo-common/ds-widgets";
import { TIPO_META, MIX_META, type PerfilGxc, pct } from "../model";
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

const fmtTs = (ts: number) =>
  new Date(ts * 1000).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function opcionTimeline(p: PerfilGxc, tema: Tema): EChartsOption {
  const finMs = p.periodo.fin * 1000;
  const iniMs = finMs - p.periodo.dias * 86_400_000;
  const tl = p.timeline;

  // Empaquetado en sub-carriles POR VENTANA DE MONITOREO (la barra sólida).
  // El proceso logístico se dibuja como línea tenue en el mismo sub-carril:
  // son dos relojes distintos (proceso vs monitoreo) y ambos se ven.
  const lanesFin: number[] = [];
  const viajes = [...tl.viajes].sort((a, b) => a.ini - b.ini).map((v) => {
    let li = lanesFin.findIndex((f) => f <= v.ini);
    if (li === -1) { li = lanesFin.length; lanesFin.push(v.fin); } else lanesFin[li] = v.fin;
    // [iniMonMs, finMonMs, cons01, servicio, ruta, camion, subcarril, iniLogMs, finLogMs, mon01]
    return [v.ini * 1000, Math.max(v.fin, v.ini + 900) * 1000, v.cons ? 1 : 0, v.s, v.ruta, v.camion, li,
            v.ini_log * 1000, Math.max(v.fin_log, v.ini_log + 900) * 1000, v.mon ? 1 : 0];
  });
  const nSub = Math.max(1, lanesFin.length);
  const sintomas = tl.sintomas.map((s) => [s.t * 1000, "Síntomas", s.n, Math.min(4, Math.max(1, s.icu))]);
  const consecuencias = tl.consecuencias.map((c) => [c.t * 1000, "Consecuencias", c.tipo, c.s, c.detalle]);
  const respuesta = tl.respuesta.map((r) => [r.t * 1000, "Respuesta", r.estado, r.quien, r.tipo, r.s]);

  return {
    tooltip: {
      backgroundColor: tema.tooltipBg, textStyle: { color: tema.textoFuerte, fontSize: 11 },
      formatter: (q: unknown) => {
        const { seriesName, data } = q as { seriesName: string; data: (string | number)[] };
        const f = (ms: number) => fmtTs(ms / 1000);
        if (seriesName === "Viajes") {
          const hMon = ((Number(data[1]) - Number(data[0])) / 3_600_000).toFixed(1);
          const hLog = ((Number(data[8]) - Number(data[7])) / 3_600_000).toFixed(1);
          return `<b>${data[3]}</b>${data[2] ? " · con consecuencia" : ""}<br/>${data[4]}<br/>` +
                 `${data[5]} · monitoreo ${f(Number(data[0]))} → ${f(Number(data[1]))} (${hMon} h)<br/>` +
                 `proceso logístico: ${hLog} h${data[9] ? "" : " · sin ventana de monitoreo"}<br/>` +
                 `<i>clic → microscopio</i>`;
        }
        if (seriesName === "Síntomas")
          return `${f(Number(data[0]))}<br/>${data[2]} síntomas en la hora · ICU máx ${data[3]}`;
        if (seriesName === "Consecuencias")
          return `<b>${MIX_META[String(data[2])]?.label ?? data[2]}</b> · ${data[3]}<br/>` +
                 `${data[4]} · ${f(Number(data[0]))}<br/><i>clic → microscopio</i>`;
        return `${data[4]} (${data[2]})<br/>responsable: ${data[3]}<br/>` +
               `${data[5]} · ${f(Number(data[0]))}<br/><i>clic → microscopio</i>`;
      },
    },
    grid: { left: 100, right: 20, top: 14, bottom: 28 },
    xAxis: {
      type: "time", min: iniMs, max: finMs,
      axisLabel: { color: tema.texto, fontSize: 10, hideOverlap: true },
      splitLine: { lineStyle: { color: tema.rejilla } },
    },
    yAxis: {
      type: "category", data: LANES, inverse: true,
      axisLine: { lineStyle: { color: tema.eje } },
      axisLabel: { color: tema.texto, fontSize: 11 },
      splitLine: { show: true, lineStyle: { color: tema.rejilla } },
    },
    series: [
      {
        name: "Viajes", type: "custom", clip: true,
        encode: { x: [0, 1] },
        data: viajes,
        renderItem: (_p: unknown, api: {
          value: (i: number) => number | string;
          coord: (v: (number | string)[]) => number[];
          size: (v: number[]) => number[];
        }) => {
          const a = api.coord([api.value(0), "Viajes"]);
          const b = api.coord([api.value(1), "Viajes"]);
          const gl = api.coord([api.value(7), "Viajes"]);
          const fl = api.coord([api.value(8), "Viajes"]);
          const bandH = api.size([0, 1])[1];
          const rowH = Math.max(2, Math.min(12, (bandH - 10) / nSub));
          const li = Number(api.value(6));
          const y0 = a[1] - (nSub * rowH) / 2 + li * rowH;
          const barH = Math.max(1.5, rowH - 1.5);
          const color = api.value(2) ? "rgba(225,29,72,0.85)" : "rgba(28,100,242,0.65)";
          return {
            type: "group",
            children: [
              // proceso logístico: línea tenue (el reloj del negocio)
              {
                type: "rect",
                shape: { x: gl[0], y: y0 + barH / 2 - 0.75, width: Math.max(2, fl[0] - gl[0]), height: 1.5 },
                style: { fill: api.value(2) ? "rgba(225,29,72,0.25)" : "rgba(28,100,242,0.22)" },
              },
              // ventana de monitoreo: barra sólida (el reloj de la vigilancia)
              {
                type: "rect",
                shape: { x: a[0], y: y0, width: Math.max(2, b[0] - a[0]), height: barH, r: 2 },
                style: { fill: color },
              },
            ],
          };
        },
      },
      {
        name: "Síntomas", type: "scatter", data: sintomas,
        symbolSize: (d: (string | number)[]) => 5 + Math.min(14, Math.sqrt(Number(d[2])) * 3),
        itemStyle: {
          color: (q: { data: (string | number)[] }) => {
            const icu = Number(q.data[3]);
            return icu === 4 && tema.dark ? "#F3F4F6" : ICU_COLOR[icu];
          },
          opacity: 0.8,
        },
      },
      {
        name: "Consecuencias", type: "scatter", data: consecuencias,
        symbol: "triangle", symbolSize: 11,
        itemStyle: {
          color: (q: { data: (string | number)[] }) => MIX_META[String(q.data[2])]?.color ?? "#E11D48",
        },
      },
      {
        name: "Respuesta", type: "scatter", data: respuesta, symbolSize: 6,
        itemStyle: {
          color: (q: { data: (string | number)[] }) => ESTADO_COLOR(String(q.data[2]), tema.dark),
          opacity: 0.75,
        },
      },
    ] as unknown as EChartsOption["series"],
  };
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

  const cap = p?.capitulos;
  const camionPorServicio = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of p?.timeline?.viajes ?? []) m.set(v.s, v.camion);
    return m;
  }, [p]);

  const opcion = useMemo(() => (p ? opcionTimeline(p, tema) : null), [p, tema]);

  const irMicroscopio = (q: unknown) => {
    const { seriesName, data } = q as { seriesName: string; data: (string | number)[] };
    if (seriesName === "Síntomas") return; // bin agregado: sin servicio único
    let ini: number, fin: number, servicio: string | undefined;
    if (seriesName === "Viajes") {
      ini = Number(data[0]) / 1000; fin = Number(data[1]) / 1000; servicio = String(data[3]);
    } else {
      const t = Number(data[0]) / 1000;
      ini = t - 1800; fin = t + 1800;
      servicio = String(seriesName === "Consecuencias" ? data[3] : data[5]);
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
          <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>1 · Exposición</div>
          <div className="text-[24px] font-semibold">
            {cap ? `${cap.con_exposicion}/${cap.viajes}` : "—"}
            <span className="text-[13px] font-normal ml-2" style={{ color: "var(--muted)" }}>
              {cap ? pct(cap.con_exposicion / Math.max(1, cap.viajes)) : ""}
            </span>
          </div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            viajes con síntomas ICU≥2
            {p?.cobertura_monitoreo != null && (
              <> · monitoreo cubre {pct(p.cobertura_monitoreo)} del tiempo de proceso</>
            )}
          </div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>2 · Consecuencia</div>
          <div className="text-[24px] font-semibold">
            {cap ? `${cap.con_consecuencia}/${cap.viajes}` : "—"}
            <span className="text-[13px] font-normal ml-2" style={{ color: "var(--muted)" }}>
              {cap ? pct(cap.con_consecuencia / Math.max(1, cap.viajes)) : ""}
            </span>
          </div>
          <div className="text-[12px] flex gap-2 flex-wrap">
            {cap && (["carga", "atraso", "retrabajo"] as const).map((k) => (
              (cap.mix[k] ?? 0) > 0 && (
                <span key={k} className="inline-flex items-center gap-1" style={{ color: "var(--muted)" }}>
                  <span className="w-2 h-2 rounded-sm" style={{ background: MIX_META[k].color }} />
                  {k} <b>{cap.mix[k]}</b>
                </span>
              )
            ))}
            {cap && !cap.con_consecuencia && <span style={{ color: "var(--muted)" }}>sin consecuencias</span>}
          </div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>3 · Respuesta</div>
          <div className="text-[24px] font-semibold">
            {p?.respuesta?.total?.toLocaleString() ?? "—"}
            {p && p.respuesta.total > 0 && (
              <span className="text-[13px] font-normal ml-2" style={{ color: "var(--muted)" }}>
                {p.respuesta.total - p.respuesta.expirados} en curso
              </span>
            )}
          </div>
          <div className="text-[12px] truncate" style={{ color: "var(--muted)" }}>
            {topResp ? `mayor volumen asignado: ${topResp.quien} (${topResp.n})` : "tratamientos generados en el período"}
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
              meta="viajes: barra sólida = ventana de monitoreo · línea tenue = proceso logístico · rojo = con consecuencia | síntomas por hora (tamaño = cantidad, color = ICU máx) · consecuencias (▲ por tipo) · tratamientos (● verde = gestionado, azul = en curso, gris = ciclo terminado) — clic salta al microscopio">
        {opcion && p && p.timeline.viajes.length
          ? <EChart option={opcion} height={330} onEvents={{ click: irMicroscopio }} />
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
        {/* Contraste — siempre visible */}
        <section className="card px-5 py-4 space-y-2">
          <div className="font-semibold text-[14px]">Contraste con / sin señal</div>
          <div className="flex items-center gap-2 text-[13px] flex-wrap">
            <span className="badge" style={{ background: "rgba(225,29,72,0.10)", color: "var(--rose-600)" }}>
              con señal: {pct(cap?.contraste?.con_exposicion)} terminó con consecuencia
            </span>
            <span className="badge" style={{ background: "var(--ghost-hover)" }}>
              sin señal: {pct(cap?.contraste?.sin_exposicion)}
            </span>
          </div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            Es un contraste observado en {cap?.viajes ?? "—"} viajes del período, no una relación causal.
            Si «sin señal» supera a «con señal», el problema es de cobertura de monitoreo, no de conducta.
          </div>
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
