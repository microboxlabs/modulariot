"use client";

import "@/features/gemelo-common/gemelo.css";

// Gemelo de la CARGA (C1) — la foto del cumplimiento: la expedición nace con
// un compromiso de entrega y su reloj corre sin importar las replanificaciones.
// KPIs de cumplimiento 30d, distribución del lead time (cumple vs no) y
// embudo de estados vivos con compromiso vencido.
import { useState } from "react";
import useSWR from "swr";
import { golFetcher as fetcher } from "@/features/gemelo-common/fetcher";

type Palancas = {
  segmentos: { segmento: string; p50_cumple: number | null; p50_no_cumple: number | null; delta_h: number }[];
  replanificacion: {
    n_cumple: number; n_no_cumple: number;
    asoc_cumple: number | null; asoc_no_cumple: number | null;
    desasoc_cumple: number | null; desasoc_no_cumple: number | null;
  };
};

type Overview = {
  kpis: {
    cerradas_30d: number; con_compromiso: number; cumplen: number;
    lead_p50_h: number | null; lead_p90_h: number | null; atraso_p50_h: number | null;
  };
  histograma: { etiqueta: string; cumple: number; no_cumple: number }[];
  vivas: { estado: string; n: number; edad_p50_h: number | null; edad_p90_h: number | null; compromiso_vencido: number }[];
};

const ESTADO_DESC: Record<string, string> = {
  PEND: "Pendiente", GRUP: "Agrupada", WAGE: "En gestión", RECO: "Recolección",
  INCO: "Incompleta", EFEC: "Efectiva", ANUL: "Anulada", CERR: "Cerrada",
};

const fmtH = (h: number | null | undefined) => {
  if (h == null) return "—";
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} d`;
};

type WiCarga = { margen_h: number; espera_h: number; prep_h: number; transito_h: number };

const PALANCAS = [
  { key: "prep_h", label: "Preparación y replanificación" },
  { key: "transito_h", label: "Tránsito" },
  { key: "espera_h", label: "Espera de consolidación" },
] as const;

export function Carga() {
  const [fRuta, setFRuta] = useState("");
  const [wiPalanca, setWiPalanca] = useState<(typeof PALANCAS)[number]["key"]>("prep_h");
  const [wiPct, setWiPct] = useState(25);

  const { data: filtros } = useSWR<{ rutas: string[] | null }>(
    "/rpc/fn_dx_gol_carga_filtros", fetcher);

  const [fo, fd] = fRuta ? fRuta.split("|") : [null, null];
  const qs = new URLSearchParams();
  if (fo) qs.set("p_origen", fo);
  if (fd) qs.set("p_destino", fd);
  const sufijo = qs.toString() ? `?${qs.toString()}` : "";

  const { data: ov } = useSWR<Overview>(
    `/rpc/fn_dx_gol_carga_overview${sufijo}`, fetcher, { refreshInterval: 120_000 });

  const { data: pal } = useSWR<Palancas>(
    `/rpc/fn_dx_gol_carga_palancas${sufijo}`, fetcher, { refreshInterval: 300_000 });

  const { data: wiBase } = useSWR<WiCarga[]>(
    `/rpc/fn_dx_gol_carga_whatif_base${sufijo}`, fetcher, { refreshInterval: 300_000 });

  // Contrafactual: reducir la palanca −pct% adelanta la llegada en
  // pct×segmento; una carga "recupera" su compromiso si su margen
  // negativo se vuelve >= 0. Ranking fijo a −25% + lente interactivo.
  const recuperadas = (key: (typeof PALANCAS)[number]["key"], pct: number) =>
    (wiBase ?? []).filter((c) => c.margen_h < 0 && c.margen_h + (pct / 100) * c[key] >= 0).length;

  const wi = (() => {
    if (!wiBase?.length) return null;
    const total = wiBase.length;
    const cumplenHoy = wiBase.filter((c) => c.margen_h >= 0).length;
    const rec = recuperadas(wiPalanca, wiPct);
    return {
      total, cumplenHoy, rec,
      pctHoy: Math.round((100 * cumplenHoy) / total),
      pctNuevo: Math.round((100 * (cumplenHoy + rec)) / total),
      ranking: PALANCAS.map((p) => ({ ...p, rec25: recuperadas(p.key, 25) }))
        .sort((a, b) => b.rec25 - a.rec25),
    };
  })();

  const k = ov?.kpis;
  const pctCumple = k && k.con_compromiso > 0 ? Math.round((100 * k.cumplen) / k.con_compromiso) : null;
  const maxBucket = Math.max(1, ...(ov?.histograma ?? []).map((b) => b.cumple + b.no_cumple));
  const totalVivas = (ov?.vivas ?? []).reduce((a, v) => a + v.n, 0);
  const vencidasVivas = (ov?.vivas ?? []).reduce((a, v) => a + v.compromiso_vencido, 0);

  const sel = {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "6px 10px", fontSize: 13, color: "var(--foreground)",
  } as const;

  return (
    <div className="gemelo-scope h-full w-full overflow-y-auto"><div className="p-4 space-y-4 max-w-[1440px] mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-[18px] font-semibold">Gemelo de la carga</h2>
        <span className="text-[13px]" style={{ color: "var(--muted)" }}>
          El compromiso es de la expedición — su reloj corre aunque la replanifiquen
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <select value={fRuta} onChange={(e) => setFRuta(e.target.value)} style={sel}>
          <option value="">Ruta (todas)</option>
          {(filtros?.rutas ?? []).map((r) => (
            <option key={r} value={r}>{r.replace("|", " → ")}</option>
          ))}
        </select>
      </div>

      {/* KPIs de cumplimiento */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Cumplimiento del compromiso · 30d
          </div>
          <div className="text-[28px] font-semibold" style={{
            color: pctCumple == null ? undefined : pctCumple >= 80 ? "var(--green-500)" : pctCumple >= 50 ? "var(--amber-600)" : "var(--rose-600)",
          }}>
            {pctCumple != null ? `${pctCumple}%` : "—"}
          </div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            {k ? `${k.cumplen.toLocaleString()} de ${k.con_compromiso.toLocaleString()} con compromiso` : "…"}
          </div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Lead time (creación → llegada)
          </div>
          <div className="text-[28px] font-semibold">{fmtH(k?.lead_p50_h)}</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>p50 · p90 {fmtH(k?.lead_p90_h)}</div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Atraso típico al incumplir
          </div>
          <div className="text-[28px] font-semibold" style={{ color: "var(--rose-600)" }}>{fmtH(k?.atraso_p50_h)}</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>mediana sobre el compromiso</div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Vivas con compromiso vencido
          </div>
          <div className="text-[28px] font-semibold" style={{ color: vencidasVivas ? "var(--rose-600)" : "var(--green-500)" }}>
            {vencidasVivas.toLocaleString()}
          </div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>de {totalVivas.toLocaleString()} en flujo</div>
        </div>
      </div>

      {/* Distribución del lead time, cumple vs no cumple */}
      <section className="card px-5 py-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-semibold text-[14px]">Distribución del lead time · cerradas 30d</span>
          <span className="text-[12px]" style={{ color: "var(--muted)" }}>
            <span style={{ color: "var(--green-500)" }}>■</span> cumple compromiso ·{" "}
            <span style={{ color: "var(--rose-600)" }}>■</span> no cumple
          </span>
        </div>
        <div className="flex items-end gap-3 h-[140px]">
          {(ov?.histograma ?? []).map((b) => {
            const tot = b.cumple + b.no_cumple;
            return (
              <div key={b.etiqueta} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <div className="text-[11px] font-semibold">{tot.toLocaleString()}</div>
                <div className="w-full max-w-[72px] flex flex-col justify-end rounded-t overflow-hidden"
                     style={{ height: `${(100 * tot) / maxBucket}%`, minHeight: 3 }}>
                  <div style={{ height: `${tot ? (100 * b.no_cumple) / tot : 0}%`, background: "var(--rose-600)" }} />
                  <div style={{ height: `${tot ? (100 * b.cumple) / tot : 0}%`, background: "var(--green-500)" }} />
                </div>
                <div className="text-[11px]" style={{ color: "var(--muted)" }}>{b.etiqueta}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* C2 · Palancas: dónde diverge el lead time entre cumple y no cumple */}
      <section className="card px-5 py-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-semibold text-[14px]">Palancas · dónde se pierde el compromiso</span>
          <span className="text-[12px]" style={{ color: "var(--muted)" }}>
            p50 por segmento: {pal ? `${pal.replanificacion.n_cumple.toLocaleString()} que cumplen vs ${pal.replanificacion.n_no_cumple.toLocaleString()} que no` : "…"}
          </span>
        </div>
        {(() => {
          const segs = pal?.segmentos ?? [];
          const maxH = Math.max(1, ...segs.map((s) => Math.max(s.p50_cumple ?? 0, s.p50_no_cumple ?? 0)));
          const maxDelta = Math.max(1, ...segs.map((s) => s.delta_h));
          return segs.map((s) => (
            <div key={s.segmento} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <span className="text-[13px]">{s.segmento}</span>
                <span className="text-[12px] font-semibold" style={{
                  color: s.delta_h === maxDelta ? "var(--rose-600)" : s.delta_h > 0 ? "var(--amber-600)" : "var(--muted)",
                }}>
                  {s.delta_h === maxDelta && s.delta_h > 0 ? "◆ LA PALANCA · " : ""}Δ {fmtH(s.delta_h)}
                </span>
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <div className="h-3 rounded-r" style={{ width: `${(100 * (s.p50_cumple ?? 0)) / maxH}%`, minWidth: 2, background: "var(--green-500)" }} />
                  <span className="text-[11px]" style={{ color: "var(--muted)" }}>{fmtH(s.p50_cumple)} cumple</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 rounded-r" style={{ width: `${(100 * (s.p50_no_cumple ?? 0)) / maxH}%`, minWidth: 2, background: "var(--rose-600)" }} />
                  <span className="text-[11px]" style={{ color: "var(--muted)" }}>{fmtH(s.p50_no_cumple)} no cumple</span>
                </div>
              </div>
            </div>
          ));
        })()}
        {pal && (
          <div className="text-[12px] pt-1 border-t" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
            Intensidad de replanificación: las que cumplen promedian{" "}
            <span className="font-semibold">{pal.replanificacion.asoc_cumple}</span> asociaciones a viaje
            ({pal.replanificacion.desasoc_cumple} desasociadas) — las que no,{" "}
            <span className="font-semibold" style={{ color: "var(--rose-600)" }}>{pal.replanificacion.asoc_no_cumple}</span>
            {" "}({pal.replanificacion.desasoc_no_cumple} desasociadas)
          </div>
        )}
      </section>

      {/* C3 · What-if de palancas: contrafactual sobre las cargas reales */}
      <section className="card px-5 py-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-semibold text-[14px]">What-if · cuánto cumplimiento compra cada palanca</span>
          <span className="text-[12px]" style={{ color: "var(--muted)" }}>
            contrafactual sobre las {wi ? wi.total.toLocaleString() : "…"} cargas cerradas con compromiso
          </span>
        </div>

        {wi && (
          <div className="grid md:grid-cols-2 gap-4">
            {/* Ranking fijo a −25% */}
            <div className="space-y-2">
              <div className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
                Ranking: compromisos recuperados con −25% en cada palanca
              </div>
              {wi.ranking.map((p, i) => {
                const max = Math.max(1, wi.ranking[0].rec25);
                return (
                  <div key={p.key} className="flex items-center gap-2">
                    <div className="h-4 rounded-r" style={{
                      width: `${(90 * p.rec25) / max}%`, minWidth: 3,
                      background: i === 0 ? "var(--blue-600)" : "var(--gray-300)",
                    }} />
                    <span className="text-[12px] whitespace-nowrap">
                      <span className="font-semibold">{p.rec25.toLocaleString()}</span> · {p.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Lente interactivo */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap text-[13px]">
                <select value={wiPalanca} onChange={(e) => setWiPalanca(e.target.value as typeof wiPalanca)} style={sel}>
                  {PALANCAS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
                <input type="range" min={0} max={100} step={5} value={wiPct}
                       onChange={(e) => setWiPct(Number(e.target.value))} style={{ width: 120 }} />
                <span className="font-semibold" style={{ color: "var(--green-500)" }}>−{wiPct}%</span>
              </div>
              <div className="text-[13px]">
                Cumplimiento:{" "}
                <span className="font-semibold" style={{ color: "var(--rose-600)" }}>{wi.pctHoy}%</span>
                {" → "}
                <span className="text-[20px] font-semibold" style={{ color: wi.pctNuevo > wi.pctHoy ? "var(--green-500)" : "var(--muted)" }}>
                  {wi.pctNuevo}%
                </span>
                <span style={{ color: "var(--muted)" }}>
                  {" "}· {wi.rec.toLocaleString()} compromisos recuperados
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="text-[11px]" style={{ color: "var(--muted)" }}>
          Simulación — supuestos: reducir la palanca −X% adelanta la llegada real de cada carga en X% de ese
          segmento, sin tocar los demás; una carga recupera su compromiso si el atraso queda cubierto por el ahorro
        </div>
      </section>

      {/* Embudo de estados vivos */}
      <section className="card overflow-x-auto">
        <div className="px-5 py-3 border-b font-semibold text-[14px]" style={{ borderColor: "var(--border)" }}>
          Cargas en flujo por estado
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              <th className="px-5 py-2">Estado</th>
              <th className="px-3 py-2">Cargas</th>
              <th className="px-3 py-2">Edad p50</th>
              <th className="px-3 py-2">Edad p90</th>
              <th className="px-3 py-2">Compromiso vencido</th>
            </tr>
          </thead>
          <tbody>
            {(ov?.vivas ?? []).map((v) => (
              <tr key={v.estado} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-5 py-2 font-medium">
                  {v.estado}
                  <span className="ml-2 text-[11px]" style={{ color: "var(--muted)" }}>
                    {ESTADO_DESC[v.estado] ?? ""}
                  </span>
                </td>
                <td className="px-3 py-2">{v.n.toLocaleString()}</td>
                <td className="px-3 py-2">{fmtH(v.edad_p50_h)}</td>
                <td className="px-3 py-2">{fmtH(v.edad_p90_h)}</td>
                <td className="px-3 py-2 font-semibold" style={{ color: v.compromiso_vencido ? "var(--rose-600)" : "var(--green-500)" }}>
                  {v.compromiso_vencido.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-2 text-[11px]" style={{ color: "var(--muted)" }}>
          Población: expediciones activas fuera de estados terminales (EFEC/ANUL/CERR) · fechas con sanity ≤ hoy
        </div>
      </section>
    </div></div>
  );
}
