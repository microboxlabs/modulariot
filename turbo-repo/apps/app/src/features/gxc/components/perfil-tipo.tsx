"use client";

import "@/features/gemelo-common/gemelo.css";

// GxC v2 · N2 — POBLACIÓN: el cuadrante operacional como visual principal.
// Eje X = señal (% viajes con exposición), eje Y = resultado (% viajes con
// consecuencia); los umbrales son la línea base del período ×1.25, declarados
// en el gráfico. Burbujas = volumen de viajes. El ranking es secundario y
// cada fila entra al perfil (N3). «Ruido» y «Punto ciego» son problemas de
// REGLAS, no de personas: se señala la salida hacia configuración.
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { EChartsOption } from "echarts";
import { golFetcher as fetcher } from "@/features/gemelo-common/fetcher";
import { EChart, Widget, useTemaChart } from "@/features/gemelo-common/ds-widgets";
import {
  TIPO_META, CUADRANTE_META, MIX_META,
  type PoblacionGxc, type EntidadGxc, pct, deltaTasa,
} from "../model";
import { usePeriodo, PeriodoChips } from "./periodo";

type Tema = ReturnType<typeof useTemaChart>;

const colorCuadrante = (c: string, dark: boolean) =>
  c === "punto_ciego" && dark ? "#F3F4F6" : (CUADRANTE_META[c]?.color ?? "#9CA3AF");

// dato: [x%, y%, viajes, id, cuadrante, mixTxt, deltaTxt]
type Punto = [number, number, number, string, string, string, string];

function opcionCuadrante(
  p: PoblacionGxc, tema: Tema,
  framePuntos: Punto[] | null,
  zoom: { x: [number, number]; y: [number, number] } | null
): EChartsOption | null {
  const bl = p.baseline;
  if (!bl) return null;
  const filas = p.entidades.filter((e) => e.rankeable && e.tasa_exp != null && e.tasa_cons != null);
  const puntos: Punto[] = framePuntos ?? filas.map((e) => {
    const mix = [
      e.c_carga ? `carga ${e.c_carga}` : "", e.c_atraso ? `atraso ${e.c_atraso}` : "",
      e.c_retrabajo ? `retrabajo ${e.c_retrabajo}` : "",
    ].filter(Boolean).join(" · ") || "sin consecuencias";
    const d = deltaTasa(e.tasa_cons, e.tasa_cons_prev);
    const delta = d == null ? "sin período previo comparable"
      : `${d >= 0 ? "+" : ""}${Math.round(d * 100)} pts vs período anterior`;
    return [
      Math.round(Number(e.tasa_exp) * 100), Math.round(Number(e.tasa_cons) * 100),
      e.viajes, e.id, e.cuadrante, mix, delta,
    ];
  });
  const umbralX = Math.round(bl.umbral_exp_alto * 100);
  const umbralY = Math.round(bl.umbral_cons_alto * 100);

  return {
    tooltip: {
      backgroundColor: tema.tooltipBg, textStyle: { color: tema.textoFuerte, fontSize: 11 },
      formatter: (q: unknown) => {
        const d = (q as { data: { value: Punto } }).data.value;
        const m = CUADRANTE_META[d[4]];
        return `<b>${d[3]}</b> · ${m?.label ?? d[4]}<br/>` +
          `${d[2]} viajes — señal ${d[0]}% · consecuencia ${d[1]}%<br/>` +
          `${d[5]}<br/>${d[6]}<br/><i>clic para abrir el perfil</i>`;
      },
    },
    grid: { left: 48, right: 24, top: 38, bottom: 40 },
    dataZoom: [
      { type: "inside", xAxisIndex: 0, filterMode: "none",
        start: zoom?.x[0] ?? 0, end: zoom?.x[1] ?? 100 },
      { type: "inside", yAxisIndex: 0, filterMode: "none",
        start: zoom?.y[0] ?? 0, end: zoom?.y[1] ?? 100 },
    ],
    xAxis: {
      type: "value", max: 100, name: "señal — % viajes con síntomas ICU≥2",
      nameLocation: "middle", nameGap: 24, nameTextStyle: { color: tema.texto, fontSize: 10 },
      splitLine: { lineStyle: { color: tema.rejilla } },
      axisLabel: { color: tema.texto, fontSize: 10, formatter: (v: number) => `${Math.round(v)}%` },
    },
    yAxis: {
      type: "value", max: 100, name: "resultado — % viajes con consecuencia",
      nameTextStyle: { color: tema.texto, fontSize: 10, align: "left", padding: [0, 0, 6, 0] },
      splitLine: { lineStyle: { color: tema.rejilla } },
      axisLabel: { color: tema.texto, fontSize: 10, formatter: (v: number) => `${Math.round(v)}%` },
    },
    series: [{
      type: "scatter" as const,
      animationDurationUpdate: 450,
      animationEasingUpdate: "linear" as const,
      data: puntos.map((d) => ({ name: String(d[3]), value: d })),
      symbolSize: (d: { value?: Punto } | Punto) => { const v = (Array.isArray(d) ? d : d.value) as Punto; return 8 + Math.min(26, Math.sqrt(Number(v[2])) * 2.2); },
      itemStyle: {
        color: (q: { data: { value: Punto } }) => colorCuadrante(q.data.value[4], tema.dark),
        opacity: 0.78, borderColor: tema.dark ? "#111928" : "#FFFFFF", borderWidth: 1,
      },
      label: {
        show: true, position: "top", fontSize: 9, color: tema.texto,
        formatter: (q: { data: { value: Punto } }) =>
          q.data.value[4] === "urgente" || q.data.value[4] === "punto_ciego" ? String(q.data.value[3]).slice(0, 14) : "",
      },
      markLine: {
        silent: true, symbol: "none",
        lineStyle: { color: tema.texto, type: "dashed", width: 1, opacity: 0.6 },
        label: { color: tema.texto, fontSize: 9, position: "insideEndTop" },
        data: [
          { xAxis: umbralX, label: { formatter: `señal alta ≥${umbralX}% (base ×1.25)` } },
          { yAxis: umbralY, label: { formatter: `consecuencia alta ≥${umbralY}% (base ×1.25)` } },
        ],
      },
    }] as unknown as EChartsOption["series"],
  };
}

export function PerfilTipo({ lang }: { lang: string }) {
  const params = useParams<{ tipo: string }>();
  const tipo = params.tipo;
  const router = useRouter();
  const tema = useTemaChart();
  const { dias, setDias, qs } = usePeriodo();
  const meta = TIPO_META[tipo];
  const [busca, setBusca] = useState("");

  const { data } = useSWR<PoblacionGxc>(
    meta ? `/rpc/fn_dx_gol_gxc_poblacion?p_tipo=${tipo}&p_dias=${dias}` : null,
    fetcher, { refreshInterval: 300_000, keepPreviousData: true });

  const bl = data?.baseline;

  // ── Reproducción día a día del cuadrante (motion chart) ──
  const [playerOn, setPlayerOn] = useState(false);
  const [cursorIdx, setCursorIdx] = useState<number | null>(null);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [velIdx, setVelIdx] = useState(1);
  const VELS = [1100, 600, 250];
  const [zoomWin, setZoomWin] = useState<{ x: [number, number]; y: [number, number] } | null>(null);

  type Evolucion = { dias: number[]; entidades: { id: string; serie: [number, number, number, number, number, number][] }[] };
  const { data: evo } = useSWR<Evolucion>(
    meta && playerOn ? `/rpc/fn_dx_gol_gxc_poblacion_evolucion?p_tipo=${tipo}&p_dias=${dias}` : null,
    fetcher, { revalidateOnFocus: false, keepPreviousData: true });

  const cuadranteFinal = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of data?.entidades ?? []) m.set(e.id, e.cuadrante);
    return m;
  }, [data]);

  useEffect(() => {
    if (!reproduciendo || !evo) return;
    const idInt = setInterval(() => {
      setCursorIdx((i) => {
        const next = (i ?? 0) + 1;
        if (next >= evo.dias.length) { setReproduciendo(false); return evo.dias.length - 1; }
        return next;
      });
    }, VELS[velIdx]);
    return () => clearInterval(idInt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reproduciendo, velIdx, evo?.dias.length]);

  useEffect(() => { setCursorIdx(null); setReproduciendo(false); setPlayerOn(false); setZoomWin(null); },
    [dias, tipo]);

  // Frame del día: acumulado hasta cursor; la burbuja nace al pasar el piso de 5 viajes
  const framePuntos = useMemo<Punto[] | null>(() => {
    if (cursorIdx == null || !evo) return null;
    const fecha = new Date(evo.dias[cursorIdx] * 1000).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
    const pts: Punto[] = [];
    for (const ent of evo.entidades) {
      const [v, e, c, mc, ma, mr] = ent.serie[Math.min(cursorIdx, ent.serie.length - 1)] ?? [0, 0, 0, 0, 0, 0];
      if (v < 5) continue;
      pts.push([
        Math.round((e / v) * 100), Math.round((c / v) * 100), v, ent.id,
        cuadranteFinal.get(ent.id) ?? "sano",
        `acumulado al ${fecha}: ${v} viajes · carga ${mc} · atraso ${ma} · retrabajo ${mr}`,
        "color = cuadrante al cierre del período",
      ]);
    }
    return pts;
  }, [cursorIdx, evo, cuadranteFinal]);

  const onZoomCuadrante = (ev: unknown) => {
    const e = ev as { batch?: { dataZoomIndex?: number; start: number; end: number }[]; start?: number; end?: number; dataZoomIndex?: number };
    const items = e.batch ?? [e as { dataZoomIndex?: number; start: number; end: number }];
    setZoomWin((z) => {
      const next = { x: z?.x ?? [0, 100] as [number, number], y: z?.y ?? [0, 100] as [number, number] };
      for (const it of items) {
        if (typeof it.start !== "number" || typeof it.end !== "number") continue;
        if ((it.dataZoomIndex ?? 0) === 0) next.x = [it.start, it.end];
        else next.y = [it.start, it.end];
      }
      return next;
    });
  };

  const opcion = useMemo(
    () => (data ? opcionCuadrante(data, tema, framePuntos, zoomWin) : null),
    [data, tema, framePuntos, zoomWin]);

  const ranking = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const ents = (data?.entidades ?? []).filter((e) => e.rankeable);
    return (q.length >= 2 ? ents.filter((e) => e.id.toLowerCase().includes(q)) : ents).slice(0, 40);
  }, [data, busca]);

  // Ranking en REPRODUCCIÓN: el acumulado al día del cursor, mismo orden que
  // el ranking final (tasa desc). Reutiliza la forma EntidadGxc para que las
  // filas se rendericen idénticas.
  const rankingPlay = useMemo<EntidadGxc[] | null>(() => {
    if (cursorIdx == null || !evo) return null;
    const q = busca.trim().toLowerCase();
    const filas: EntidadGxc[] = [];
    for (const ent of evo.entidades) {
      const [v, e, c, mc, ma, mr] = ent.serie[Math.min(cursorIdx, ent.serie.length - 1)] ?? [0, 0, 0, 0, 0, 0];
      if (v < 5) continue;
      if (q.length >= 2 && !ent.id.toLowerCase().includes(q)) continue;
      filas.push({
        id: ent.id, viajes: v, v_exp: e, v_cons: c, v_exp_cons: 0,
        c_atraso: ma, c_retrabajo: mr, c_carga: mc, peso: 0,
        tasa_cons: c / v, tasa_exp: e / v,
        tasa_cons_con_exp: null, tasa_cons_sin_exp: null,
        monitoreo_comprometido: false, rankeable: true,
        nivel: null, cuadrante: cuadranteFinal.get(ent.id) ?? "sano",
        tasa_cons_prev: null, viajes_prev: null,
      });
    }
    filas.sort((a, b) => Number(b.tasa_cons) - Number(a.tasa_cons));
    return filas.slice(0, 40);
  }, [cursorIdx, evo, busca, cuadranteFinal]);
  const sinMuestra = (data?.n ?? 0) - (data?.n_rankeables ?? 0);

  // Las operaciones (nodos) no participan del modelo por viaje
  if (!meta) {
    return (
      <div className="gemelo-scope h-full w-full overflow-y-auto"><div className="p-6 max-w-[720px] mx-auto space-y-3">
        <h2 className="text-[17px] font-semibold">GxC · {tipo}</h2>
        <div className="card px-5 py-4 text-[13px]" style={{ color: "var(--muted)" }}>
          Esta población no participa del modelo de consecuencia por viaje. Las operaciones
          (nodos) se analizan por colas y recurrencia en{" "}
          <Link href={`/${lang}/gemelo/proceso`} className="hover:underline" style={{ color: "var(--blue-700)" }}>
            Gemelo digital · Proceso</Link>.
        </div>
        <Link href={`/${lang}/gxc`} className="text-[13px] hover:underline" style={{ color: "var(--muted)" }}>← GxC</Link>
      </div></div>
    );
  }

  return (
    <div className="gemelo-scope h-full w-full overflow-y-auto"><div className="p-4 space-y-4 max-w-[1440px] mx-auto">
      <div className="h-[calc(100vh-64px-40px-48px)] grid grid-rows-[auto_1fr] gap-2.5 overflow-hidden">
        <div className="flex items-center gap-3 flex-wrap flex-none">
          <Link href={`/${lang}/gxc?${qs}`} className="text-[13px] hover:underline" style={{ color: "var(--muted)" }}>
            ← GxC
          </Link>
          <h2 className="text-[17px] font-semibold">{meta.label}</h2>
          <span className="text-[12px]" style={{ color: "var(--muted)" }}>
            {data ? `${data.n_rankeables} con ranking · ${sinMuestra} bajo el piso de ${bl?.piso_viajes ?? 5} viajes` : "…"}
            {bl && <> — línea base: consecuencia {pct(bl.tasa_consecuencia)} · señal {pct(bl.tasa_exposicion)}
              · contraste {pct(bl.contraste?.con_exposicion)} con / {pct(bl.contraste?.sin_exposicion)} sin</>}
          </span>
          <span className="flex-1" />
          <PeriodoChips dias={dias} onChange={setDias} />
        </div>

        <div className="grid md:grid-cols-[1.55fr_1fr] gap-2.5 min-h-0">
          {/* Cuadrante operacional */}
          <Widget title="Cuadrante operacional"
                  meta="burbujas = viajes del período · clic abre el perfil"
                  actions={
                    <div className="flex flex-wrap gap-2 text-[10.5px]" style={{ color: "var(--muted)" }}>
                      {["urgente", "punto_ciego", "ruido", "monitoreo_roto", "sano"].map((c) => (
                        <span key={c} className="inline-flex items-center gap-1" title={CUADRANTE_META[c].explica}>
                          <span className="w-2 h-2 rounded-full"
                                style={{ background: colorCuadrante(c, tema.dark), boxShadow: "0 0 0 1px var(--border)" }} />
                          {CUADRANTE_META[c].label}
                        </span>
                      ))}
                    </div>
                  }>
            <div className="h-full min-h-0 flex flex-col">
              <div className="flex items-center gap-2 flex-wrap text-[12px] flex-none pb-1">
                <button className="btn-primary" style={{ paddingTop: 3, paddingBottom: 3 }}
                  onClick={() => {
                    if (reproduciendo) { setReproduciendo(false); return; }
                    setPlayerOn(true);
                    if (cursorIdx == null || (evo && cursorIdx >= evo.dias.length - 1)) setCursorIdx(0);
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
                {evo && (
                  <input type="range" className="flex-1 min-w-[140px]"
                    min={0} max={evo.dias.length - 1} step={1}
                    value={cursorIdx ?? evo.dias.length - 1}
                    onChange={(e) => { setReproduciendo(false); setPlayerOn(true); setCursorIdx(Number(e.target.value)); }} />
                )}
                <span className="font-semibold w-[58px]" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {cursorIdx != null && evo
                    ? new Date(evo.dias[cursorIdx] * 1000).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })
                    : "hoy"}
                </span>
                {cursorIdx != null && (
                  <button className="text-[11px] hover:underline" style={{ color: "var(--blue-700)" }}
                    onClick={() => { setReproduciendo(false); setCursorIdx(null); }}>
                    ver cierre
                  </button>
                )}
                <span className="text-[10.5px]" style={{ color: "var(--muted)" }}>
                  rueda = zoom · arrastrar = mover · doble clic = restablecer · las burbujas nacen al pasar el piso de 5 viajes
                </span>
              </div>
              <div className="flex-1 min-h-0">
                {opcion
                  ? <EChart option={opcion} height="100%"
                      onEvents={{
                        click: (q) => {
                          const d = (q as { data?: { value?: Punto } }).data?.value;
                          if (d?.[3]) router.push(`/${lang}/gxc/${tipo}/${encodeURIComponent(d[3])}?${qs}`);
                        },
                        datazoom: onZoomCuadrante,
                        dblclick: () => setZoomWin(null),
                      }} />
                  : <div className="h-full flex items-center text-[12px]" style={{ color: "var(--muted)" }}>Calculando cuadrante…</div>}
              </div>
              <div className="flex-none pt-1 text-[11px]" style={{ color: "var(--muted)" }}>
                «Ruido» y «Punto ciego» hablan de las REGLAS de síntomas, no de la operación:
                ajustarlas vive en Configuración (autoservicio del portal, fase PT4).
              </div>
            </div>
          </Widget>

          {/* Ranking secundario */}
          <Widget title={rankingPlay ? "Ranking al día del cursor" : "Ranking por tasa de consecuencia"}
                  meta={`urgentes primero · busca entre ${data?.n ?? "…"}`}
                  actions={
                    <input value={busca} onChange={(e) => setBusca(e.target.value)}
                      placeholder={`Buscar ${meta.singular}…`}
                      className="rounded-lg border px-2 py-1 text-[12px] w-[150px]"
                      style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--foreground)" }} />
                  }>
            <div className="h-full overflow-y-auto space-y-1 pr-1">
              {(rankingPlay ?? ranking).map((e: EntidadGxc) => {
                const d = deltaTasa(e.tasa_cons, e.tasa_cons_prev);
                const totMix = Math.max(1, e.c_atraso + e.c_carga + e.c_retrabajo);
                return (
                  <Link key={e.id} href={`/${lang}/gxc/${tipo}/${encodeURIComponent(e.id)}?${qs}`}
                        className="flex items-center gap-2 text-[12px] hover:underline rounded-lg px-2 py-1.5"
                        style={{ background: "var(--ghost-hover)" }}>
                    <span title={CUADRANTE_META[e.cuadrante]?.explica}
                          className="w-2.5 h-2.5 rounded-full flex-none"
                          style={{ background: colorCuadrante(e.cuadrante, tema.dark), boxShadow: "0 0 0 1px var(--border)" }} />
                    <span className="font-medium truncate w-[38%] flex-none">{e.id}</span>
                    <span className="flex-none text-[11px] w-[46px] text-right font-semibold"
                          style={{ fontVariantNumeric: "tabular-nums" }}>{pct(e.tasa_cons)}</span>
                    <span className="flex-1 flex h-2 rounded-full overflow-hidden" style={{ background: "var(--surface)" }}>
                      <span style={{ width: `${(100 * e.c_carga) / totMix}%`, background: MIX_META.carga.color }} />
                      <span style={{ width: `${(100 * e.c_atraso) / totMix}%`, background: MIX_META.atraso.color }} />
                      <span style={{ width: `${(100 * e.c_retrabajo) / totMix}%`, background: MIX_META.retrabajo.color }} />
                    </span>
                    <span className="flex-none text-[11px] w-[52px] text-right"
                          style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{e.viajes} vj</span>
                    {d != null && Math.abs(d) >= 0.05 && (
                      <span className="flex-none font-semibold text-[11px]"
                            style={{ color: d > 0 ? "var(--rose-600)" : "var(--green-500)" }}>
                        {d > 0 ? "▲" : "▼"}{Math.abs(Math.round(d * 100))}
                      </span>
                    )}
                    {e.monitoreo_comprometido && (
                      <span className="flex-none text-[10px] font-semibold" title={CUADRANTE_META.monitoreo_roto.explica}
                            style={{ color: CUADRANTE_META.monitoreo_roto.color }}>GPS</span>
                    )}
                  </Link>
                );
              })}
              {data && !ranking.length && (
                <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                  {busca ? `Sin resultados para «${busca}»` : "Sin entidades rankeables en el período"}
                </div>
              )}
            </div>
          </Widget>
        </div>
      </div>
    </div></div>
  );
}
