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
import { EChart, Widget, useTemaChart, tipCard } from "@/features/gemelo-common/ds-widgets";
import {
  TIPO_META, CUADRANTE_META, MIX_META, TIPO_MIX,
  type PoblacionGxc, type EntidadGxc, pct, deltaTasa,
} from "../model";
import { usePeriodo, PeriodoChips } from "./periodo";
import { useGxcFiltros, GxcFiltrosBar } from "./filtros";
import { useCarrierMode } from "@/features/auth/hooks/use-carrier-mode";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

type Tema = ReturnType<typeof useTemaChart>;

const colorCuadrante = (c: string, dark: boolean) =>
  c === "punto_ciego" && dark ? "#F3F4F6" : (CUADRANTE_META[c]?.color ?? "#9CA3AF");

// dato: [x%, y%, viajes, id, cuadrante, mixTxt, deltaTxt]
type Punto = [number, number, number, string, string, string, string];

function opcionCuadrante(
  p: PoblacionGxc, tema: Tema,
  frame: { rank: Punto[]; sub: Punto[] } | null,
  zoom: { x: [number, number]; y: [number, number] } | null
): EChartsOption | null {
  const bl = p.baseline;
  if (!bl) return null;
  const claves = TIPO_MIX[p.tipo] ?? [];
  const filas = p.entidades.filter((e) => e.rankeable && e.tasa_exp != null && e.tasa_cons != null);
  const puntos: Punto[] = frame?.rank ?? filas.map((e) => {
    const mix = claves
      .filter((k) => (e.mix?.[k] ?? 0) > 0)
      .map((k) => `${MIX_META[k]?.label.split(" ")[0].toLowerCase() ?? k} ${e.mix[k]}`)
      .join(" · ") || "sin consecuencias";
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

  // Bajo el piso: visibles pero sin clasificar (huecas, grises). Una flota
  // chica no puede quedar en blanco — se ve lo que hay, con su advertencia.
  const sinMuestra: Punto[] = frame ? frame.sub : p.entidades
    .filter((e) => !e.rankeable && e.tasa_exp != null && e.tasa_cons != null && e.viajes > 0)
    .map((e) => [
      Math.round(Number(e.tasa_exp) * 100), Math.round(Number(e.tasa_cons) * 100),
      e.viajes, e.id, "muestra_insuficiente",
      `${e.viajes} viaje${e.viajes === 1 ? "" : "s"} — bajo el piso de ${bl.piso_viajes}: la tasa aún no es confiable`,
      "sin clasificar",
    ]);

  return {
    tooltip: {
      backgroundColor: tema.tooltipBg, textStyle: { color: tema.textoFuerte, fontSize: 11 },
      formatter: (q: unknown) => {
        const d = (q as { data: { value: Punto } }).data.value;
        const m = CUADRANTE_META[d[4]];
        const tono = d[4] === "urgente" ? "rojo" : d[4] === "punto_ciego" ? "negro"
          : d[4] === "ruido" ? "ambar" : d[4] === "monitoreo_roto" ? "violeta"
          : d[4] === "muestra_insuficiente" ? "gris" : "verde";
        return tipCard({
          titulo: String(d[3]),
          badge: { texto: m?.label ?? String(d[4]), tono },
          filas: [
            ["Viajes", `${d[2]}`],
            ["Señal", `${d[0]}% de viajes con síntomas ICU≥2`],
            ["Consecuencia", `${d[1]}% de viajes`],
            ["Mix", String(d[5])],
            ["Comparación", String(d[6])],
          ],
          pie: "clic para abrir el perfil",
        });
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
      data: puntos.map((d) => ({ id: String(d[3]), name: String(d[3]), value: d })),
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
        animation: false, // marco fijo: sin re-animación en cada tick del reproductor
        lineStyle: { color: tema.texto, type: "dashed", width: 1, opacity: 0.6 },
        label: { color: tema.texto, fontSize: 9, position: "insideEndTop" },
        data: [
          { xAxis: umbralX, label: { formatter: `señal alta ≥${umbralX}% (base ×1.25)` } },
          { yAxis: umbralY, label: { formatter: `consecuencia alta ≥${umbralY}% (base ×1.25)` } },
        ],
      },
    }, {
      type: "scatter" as const,
      animationDurationUpdate: 450,
      animationEasingUpdate: "linear" as const,
      data: sinMuestra.map((d) => ({ id: String(d[3]), name: String(d[3]), value: d })),
      symbolSize: (d: { value?: Punto } | Punto) => {
        const v = (Array.isArray(d) ? d : d.value) as Punto;
        return 6 + Math.min(10, Math.sqrt(Number(v[2])) * 2);
      },
      itemStyle: {
        color: "transparent",
        borderColor: tema.dark ? "#6B7280" : "#9CA3AF", borderWidth: 1.5,
      },
      z: 1,
    }] as unknown as EChartsOption["series"],
  };
}

export function PerfilTipo({ lang, dict }: { lang: string; dict: I18nRecord }) {
  const params = useParams<{ tipo: string }>();
  const tipo = params.tipo;
  const router = useRouter();
  const tema = useTemaChart();
  const { dias, setDias, qs } = usePeriodo();
  const { carrierMode } = useCarrierMode();
  const gx = useGxcFiltros(carrierMode);
  const q = gx.q(dias);
  const meta = TIPO_META[tipo];
  const [busca, setBusca] = useState("");

  const { data } = useSWR<PoblacionGxc>(
    meta ? `/rpc/fn_dx_gol_gxc_poblacion?p_tipo=${tipo}&${q}` : null,
    fetcher, { refreshInterval: 300_000, keepPreviousData: true });

  const bl = data?.baseline;

  // ── Reproducción día a día del cuadrante (motion chart) ──
  const [playerOn, setPlayerOn] = useState(false);
  const [cursorIdx, setCursorIdx] = useState<number | null>(null);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [velIdx, setVelIdx] = useState(1);
  const VELS = [1100, 600, 250];
  const [zoomWin, setZoomWin] = useState<{ x: [number, number]; y: [number, number] } | null>(null);

  // serie por día: [viajes, con señal, con consecuencia, ...mix en el orden de mix_claves]
  type Evolucion = { dias: number[]; mix_claves?: string[]; entidades: { id: string; serie: number[][] }[] };
  const { data: evo } = useSWR<Evolucion>(
    meta && playerOn ? `/rpc/fn_dx_gol_gxc_poblacion_evolucion?p_tipo=${tipo}&${q}` : null,
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
    [dias, tipo, q]);

  // Frame del día: acumulado hasta cursor; la burbuja nace al pasar el piso de 5 viajes
  const frame = useMemo<{ rank: Punto[]; sub: Punto[] } | null>(() => {
    if (cursorIdx == null || !evo) return null;
    const claves = evo.mix_claves ?? TIPO_MIX[tipo] ?? [];
    const fecha = new Date(evo.dias[cursorIdx] * 1000).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
    const rank: Punto[] = []; const sub: Punto[] = [];
    for (const ent of evo.entidades) {
      const fila = ent.serie[Math.min(cursorIdx, ent.serie.length - 1)] ?? [];
      const [v = 0, e = 0, c = 0] = fila;
      if (v <= 0) continue;
      const mixTxt = claves
        .map((k, i) => ({ k, n: fila[3 + i] ?? 0 }))
        .filter((x) => x.n > 0)
        .map((x) => `${MIX_META[x.k]?.label.split(" ")[0].toLowerCase() ?? x.k} ${x.n}`)
        .join(" · ") || "sin consecuencias";
      const punto: Punto = [
        Math.round((e / v) * 100), Math.round((c / v) * 100), v, ent.id,
        v >= 5 ? (cuadranteFinal.get(ent.id) ?? "sano") : "muestra_insuficiente",
        `acumulado al ${fecha}: ${v} viajes · ${mixTxt}`,
        v >= 5 ? "color = cuadrante al cierre del período" : "bajo el piso de 5 — sin clasificar",
      ];
      (v >= 5 ? rank : sub).push(punto);
    }
    return { rank, sub };
  }, [cursorIdx, evo, cuadranteFinal, tipo]);

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
    () => (data ? opcionCuadrante(data, tema, frame, zoomWin) : null),
    [data, tema, frame, zoomWin]);

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
    const claves = evo.mix_claves ?? TIPO_MIX[tipo] ?? [];
    const filas: EntidadGxc[] = [];
    for (const ent of evo.entidades) {
      const fila = ent.serie[Math.min(cursorIdx, ent.serie.length - 1)] ?? [];
      const [v = 0, e = 0, c = 0] = fila;
      if (v <= 0) continue;
      if (q.length >= 2 && !ent.id.toLowerCase().includes(q)) continue;
      const mix: Record<string, number> = {};
      claves.forEach((k, i) => { mix[k] = fila[3 + i] ?? 0; });
      filas.push({
        id: ent.id, viajes: v, v_exp: e, v_cons: c, v_exp_cons: 0,
        mix, peso: 0,
        tasa_cons: c / v, tasa_exp: e / v,
        tasa_cons_con_exp: null, tasa_cons_sin_exp: null,
        monitoreo_comprometido: false, rankeable: v >= 5,
        nivel: null,
        cuadrante: v >= 5 ? (cuadranteFinal.get(ent.id) ?? "sano") : "muestra_insuficiente",
        tasa_cons_prev: null, viajes_prev: null,
      });
    }
    // clasificables por tasa; bajo el piso al final, por volumen
    filas.sort((a, b) => Number(b.rankeable) - Number(a.rankeable)
      || (a.rankeable ? Number(b.tasa_cons) - Number(a.tasa_cons) : b.viajes - a.viajes));
    return filas.slice(0, 60);
  }, [cursorIdx, evo, busca, cuadranteFinal, tipo]);
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
      <div className="h-[calc(100vh-64px-40px-48px)] grid grid-rows-[auto_auto_1fr] gap-2.5 overflow-hidden">
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

        {/* Misma interacción de filtros que Despachos */}
        <div className="flex items-center gap-2 flex-wrap flex-none">
          <GxcFiltrosBar dict={dict} carrierMode={carrierMode} />
          {gx.conRango && (
            <span className="text-[11px]" style={{ color: "var(--muted)" }}>
              el rango de fechas manda sobre los chips de período
            </span>
          )}
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
                if (!e.rankeable) {
                  return (
                    <Link key={e.id} href={`/${lang}/gxc/${tipo}/${encodeURIComponent(e.id)}?${qs}`}
                          className="flex items-center gap-2 text-[12px] hover:underline rounded-lg px-2 py-1"
                          style={{ background: "var(--ghost-hover)", opacity: 0.65 }}>
                      <span className="w-2.5 h-2.5 rounded-full flex-none border"
                            style={{ borderColor: "var(--muted)", background: "transparent" }} />
                      <span className="truncate flex-1">{e.id}</span>
                      <span className="flex-none text-[11px]" style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                        {e.viajes} vj · bajo el piso
                      </span>
                    </Link>
                  );
                }
                const d = deltaTasa(e.tasa_cons, e.tasa_cons_prev);
                const claves = TIPO_MIX[tipo] ?? [];
                const totMix = Math.max(1, claves.reduce((a, k) => a + (e.mix?.[k] ?? 0), 0));
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
                      {claves.map((k) => (
                        <span key={k} title={MIX_META[k]?.label}
                              style={{ width: `${(100 * (e.mix?.[k] ?? 0)) / totMix}%`, background: MIX_META[k]?.color }} />
                      ))}
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
              {!rankingPlay && (() => {
                const q = busca.trim().toLowerCase();
                const sub = (data?.entidades ?? [])
                  .filter((e) => !e.rankeable && e.viajes > 0)
                  .filter((e) => q.length < 2 || e.id.toLowerCase().includes(q))
                  .sort((a, b) => b.viajes - a.viajes).slice(0, 30);
                if (!sub.length) return null;
                return (
                  <>
                    <div className="text-[10.5px] uppercase tracking-wide pt-2 pb-0.5" style={{ color: "var(--muted)" }}>
                      Bajo el piso de {bl?.piso_viajes ?? 5} viajes — sin clasificar
                    </div>
                    {sub.map((e) => (
                      <Link key={e.id} href={`/${lang}/gxc/${tipo}/${encodeURIComponent(e.id)}?${qs}`}
                            className="flex items-center gap-2 text-[12px] hover:underline rounded-lg px-2 py-1"
                            style={{ background: "var(--ghost-hover)", opacity: 0.65 }}>
                        <span className="w-2.5 h-2.5 rounded-full flex-none border"
                              style={{ borderColor: "var(--muted)", background: "transparent" }} />
                        <span className="truncate flex-1">{e.id}</span>
                        <span className="flex-none text-[11px]" style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                          {e.viajes} vj{e.v_cons ? ` · ${e.v_cons} con consecuencia` : ""}
                        </span>
                      </Link>
                    ))}
                  </>
                );
              })()}
              {data && !ranking.length && (data?.entidades ?? []).every((e) => e.rankeable || !e.viajes) && (
                <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                  {busca ? `Sin resultados para «${busca}»` : "Sin entidades en el período"}
                </div>
              )}
            </div>
          </Widget>
        </div>
      </div>
    </div></div>
  );
}
