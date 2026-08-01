"use client";

import { useMemo, useState } from "react";
import { getModules } from "./module-i18n";
import { type GpsProvider } from "./torre-modules-data";
import { useLang } from "./useLang";

// ============================================================
// Proveedores GPS — ¿qué tan precisa es la señal de cada proveedor?
// Port nativo (DS) de /torre.html#gps-providers. Métrica comercial:
// pulsos/min por dispositivo EN MOVIMIENTO. 12 = precisión ModularIoT,
// 20 = estándar minería. Datos reales de la última hora.
// ============================================================

const fmt = (n: number) => n.toLocaleString("es-CL");
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const demora = (v: number) => (v >= 0 ? `${v}s` : "—");

// Diccionario trilingüe de strings de UI. Los datos (nombres de proveedor,
// números) llegan ya traducidos desde getModules(lang).
const UI = {
  es: {
    eyebrow: "Observabilidad de datos",
    h1: "¿Qué tan precisa es la señal de cada proveedor GPS?",
    introP1: "La precisión depende de la ",
    introB1: "frecuencia de la señal en movimiento",
    introP2: ". ",
    introB2: "12 pulsos por minuto",
    introP3: " garantizan el estándar de precisión de ModularIoT; ",
    introB3: "20",
    introP4: " es el que exige la minería. En una operación real, casi ningún proveedor los alcanza.",
    measured: "Datos reales de proveedores GPS en operación — medidos, no simulados.",
    statAvg: "pulsos/min promedio · en movimiento",
    statPrecision: (std: number) => `cumple precisión (${std}/min)`,
    statMining: (std: number) => `cumple minería (${std}/min)`,
    statDevices: "dispositivos en movimiento",
    nOfM: (n: number, total: number) => `${n} de ${total}`,
    stMineria: "Estándar minería",
    stPrecision: "Precisión ModularIoT",
    stBajo: "Bajo estándar",
    stMuyBajo: "Muy bajo",
    rankOf: (rank: number, total: number) => `#${rank} de ${total} por precisión`,
    devices: "dispositivos",
    shareOfSignal: (p: number) => `${p}% de la señal`,
    pulsesMin: "pulsos/min",
    gaugePrecision: "12 · Precisión",
    gaugeMining: "20 · Minería",
    providerLatency: "latencia del proveedor",
    signalsMoving: "señales en movimiento",
    cumpleMineria: (min: number, mbl: number) => `Cumple el estándar de minería (${min}/min) y el de precisión ModularIoT (${mbl}/min).`,
    cumplePrecision: (min: number, mbl: number) => `Cumple el estándar de precisión ModularIoT (${mbl}/min); aún no el de minería (${min}/min).`,
    noCumple: (mbl: number) => `No alcanza el estándar de precisión ModularIoT (${mbl}/min) — su posición es menos precisa.`,
    thProvider: "Proveedor",
    thDevices: "Disp.",
    thPulses: "Pulsos/min (en mov.)",
    thLatency: "Latencia",
    thStatus: "Estado",
    tapHint: "Toca un proveedor para ver su detalle. Métrica: señales por minuto y dispositivo, solo con velocidad > 0.",
  },
  en: {
    eyebrow: "Data observability",
    h1: "How accurate is each GPS provider's signal?",
    introP1: "Accuracy depends on the ",
    introB1: "signal frequency while moving",
    introP2: ". ",
    introB2: "12 pulses per minute",
    introP3: " guarantee ModularIoT's accuracy standard; ",
    introB3: "20",
    introP4: " is what mining demands. In a real operation, almost no provider reaches them.",
    measured: "Real data from GPS providers in operation — measured, not simulated.",
    statAvg: "average pulses/min · in motion",
    statPrecision: (std: number) => `meets accuracy (${std}/min)`,
    statMining: (std: number) => `meets mining (${std}/min)`,
    statDevices: "devices in motion",
    nOfM: (n: number, total: number) => `${n} of ${total}`,
    stMineria: "Mining standard",
    stPrecision: "ModularIoT accuracy",
    stBajo: "Below standard",
    stMuyBajo: "Very low",
    rankOf: (rank: number, total: number) => `#${rank} of ${total} by accuracy`,
    devices: "devices",
    shareOfSignal: (p: number) => `${p}% of the signal`,
    pulsesMin: "pulses/min",
    gaugePrecision: "12 · Accuracy",
    gaugeMining: "20 · Mining",
    providerLatency: "provider latency",
    signalsMoving: "signals in motion",
    cumpleMineria: (min: number, mbl: number) => `Meets the mining standard (${min}/min) and the ModularIoT accuracy standard (${mbl}/min).`,
    cumplePrecision: (min: number, mbl: number) => `Meets the ModularIoT accuracy standard (${mbl}/min); not yet the mining one (${min}/min).`,
    noCumple: (mbl: number) => `Does not reach the ModularIoT accuracy standard (${mbl}/min) — its position is less accurate.`,
    thProvider: "Provider",
    thDevices: "Dev.",
    thPulses: "Pulses/min (moving)",
    thLatency: "Latency",
    thStatus: "Status",
    tapHint: "Tap a provider to see its detail. Metric: signals per minute per device, only at speed > 0.",
  },
  pt: {
    eyebrow: "Observabilidade de dados",
    h1: "Quão preciso é o sinal de cada provedor de GPS?",
    introP1: "A precisão depende da ",
    introB1: "frequência do sinal em movimento",
    introP2: ". ",
    introB2: "12 pulsos por minuto",
    introP3: " garantem o padrão de precisão da ModularIoT; ",
    introB3: "20",
    introP4: " é o que a mineração exige. Em uma operação real, quase nenhum provedor os alcança.",
    measured: "Dados reais de provedores de GPS em operação — medidos, não simulados.",
    statAvg: "pulsos/min em média · em movimento",
    statPrecision: (std: number) => `atinge precisão (${std}/min)`,
    statMining: (std: number) => `atinge mineração (${std}/min)`,
    statDevices: "dispositivos em movimento",
    nOfM: (n: number, total: number) => `${n} de ${total}`,
    stMineria: "Padrão mineração",
    stPrecision: "Precisão ModularIoT",
    stBajo: "Abaixo do padrão",
    stMuyBajo: "Muito baixo",
    rankOf: (rank: number, total: number) => `#${rank} de ${total} por precisão`,
    devices: "dispositivos",
    shareOfSignal: (p: number) => `${p}% do sinal`,
    pulsesMin: "pulsos/min",
    gaugePrecision: "12 · Precisão",
    gaugeMining: "20 · Mineração",
    providerLatency: "latência do provedor",
    signalsMoving: "sinais em movimento",
    cumpleMineria: (min: number, mbl: number) => `Atinge o padrão de mineração (${min}/min) e o de precisão ModularIoT (${mbl}/min).`,
    cumplePrecision: (min: number, mbl: number) => `Atinge o padrão de precisão ModularIoT (${mbl}/min); ainda não o de mineração (${min}/min).`,
    noCumple: (mbl: number) => `Não atinge o padrão de precisão ModularIoT (${mbl}/min) — sua posição é menos precisa.`,
    thProvider: "Provedor",
    thDevices: "Disp.",
    thPulses: "Pulsos/min (em mov.)",
    thLatency: "Latência",
    thStatus: "Status",
    tapHint: "Toque em um provedor para ver o detalhe. Métrica: sinais por minuto por dispositivo, apenas com velocidade > 0.",
  },
} as const;

export default function GpsProviders() {
  const lang = useLang();
  const { GPS_DATA } = getModules(lang);
  const t = UI[(lang as "es" | "en" | "pt")] ?? UI.es;

  const STD_MBL = GPS_DATA.meta.std_mbl || 12;
  const STD_MIN = GPS_DATA.meta.std_mineria || 20;

  // Estado por pulsos/min → [label, textClass, bgClass, barColor].
  const estadoPpm = (v: number): [string, string, string, string] => {
    if (v >= STD_MIN) return [t.stMineria, "text-green-800", "bg-green-100", "#065f46"];
    if (v >= STD_MBL) return [t.stPrecision, "text-green-700", "bg-green-100", "#0f766e"];
    if (v >= 6) return [t.stBajo, "text-amber-700", "bg-amber-100", "#b45309"];
    return [t.stMuyBajo, "text-rose-700", "bg-rose-100", "#b91c1c"];
  };

  const tot = GPS_DATA.totals;
  const provs = useMemo(() => [...GPS_DATA.providers].sort((a, b) => b.signals - a.signals), [GPS_DATA]);
  const ppmSorted = useMemo(() => [...provs].sort((a, b) => b.ppm - a.ppm), [provs]);
  const [sel, setSel] = useState<string>(ppmSorted[0]?.name || provs[0]?.name);

  const p: GpsProvider = provs.find((x) => x.name === sel) || provs[0];
  const sp = estadoPpm(p.ppm || 0);
  const cumplenMBL = provs.filter((x) => x.ppm >= STD_MBL).length;
  const cumplenMin = provs.filter((x) => x.ppm >= STD_MIN).length;
  const rankPos = ppmSorted.findIndex((x) => x.name === p.name) + 1;

  const gMax = Math.max(24, Math.ceil((ppmSorted[0]?.ppm || 0) + 2));
  const px = (v: number) => Math.max(0, Math.min(100, (v / gMax) * 100));

  const cumpleTxt =
    p.ppm >= STD_MIN ? t.cumpleMineria(STD_MIN, STD_MBL)
    : p.ppm >= STD_MBL ? t.cumplePrecision(STD_MIN, STD_MBL)
    : t.noCumple(STD_MBL);

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
      <p className="text-sm font-semibold uppercase tracking-widest text-accent">{t.eyebrow}</p>
      <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.02em] text-ink-1 sm:text-5xl">
        {t.h1}
      </h1>
      <p className="mt-6 max-w-3xl text-lg leading-relaxed text-ink-2">
        {t.introP1}<b>{t.introB1}</b>{t.introP2}<b>{t.introB2}</b>{t.introP3}<b>{t.introB3}</b>{t.introP4}
      </p>
      <p className="mt-2 font-mono text-xs text-ink-3">{GPS_DATA.meta.source} · {GPS_DATA.meta.window}</p>
      <p className="mt-1 text-xs text-ink-3">{t.measured}</p>

      {/* Resumen de flota */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [tot.ppm_fleet.toFixed(2), t.statAvg, null],
          [t.nOfM(cumplenMBL, tot.proveedores), t.statPrecision(STD_MBL), "text-green-700"],
          [t.nOfM(cumplenMin, tot.proveedores), t.statMining(STD_MIN), cumplenMin ? "text-green-700" : "text-rose-600"],
          [fmt(tot.assets), t.statDevices, null],
        ].map(([v, l, cls]) => (
          <div key={l as string} className="rounded-xl border border-hairline bg-surface p-4">
            <p className={`text-2xl font-semibold tabular-nums tracking-[-0.02em] ${cls || "text-ink-1"}`}>{v}</p>
            <p className="mt-1 text-xs font-medium text-ink-3">{l}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        {/* Detalle del proveedor seleccionado */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-hairline bg-surface p-6">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-ink-1">{p.name}</h3>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${sp[1]} ${sp[2]}`}>{sp[0]}</span>
            </div>
            <p className="mt-1 text-xs text-ink-3">{t.rankOf(rankPos, provs.length)} · {fmt(p.assets)} {t.devices} · {t.shareOfSignal(pct(p.signals, tot.signals))}</p>

            <div className="mt-5">
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold tabular-nums tracking-[-0.02em] text-ink-1">{(p.ppm || 0).toFixed(1)}</span>
                <span className="text-sm text-ink-3">{t.pulsesMin}</span>
              </div>
              {/* Gauge */}
              <div className="relative mt-3 h-6 overflow-hidden rounded-lg bg-surface-3">
                <div className="absolute inset-y-0 left-0 rounded-lg" style={{ width: `${px(p.ppm || 0)}%`, background: sp[3], opacity: 0.9 }} />
                <div className="absolute inset-y-[-2px] w-0.5 bg-green-700" style={{ left: `${px(STD_MBL)}%` }} />
                <div className="absolute inset-y-[-2px] w-0.5 bg-green-900" style={{ left: `${px(STD_MIN)}%` }} />
              </div>
              <div className="relative mt-1 h-4 text-[10px] text-ink-3">
                <span className="absolute -translate-x-1/2" style={{ left: `${px(STD_MBL)}%` }}>{t.gaugePrecision}</span>
                <span className="absolute -translate-x-1/2" style={{ left: `${px(STD_MIN)}%` }}>{t.gaugeMining}</span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-hairline bg-surface-2 p-3">
                <p className="text-lg font-semibold tracking-[-0.02em] tabular-nums text-ink-1">{demora(p.prov_latency_s)}</p>
                <p className="text-[11px] text-ink-3">{t.providerLatency}</p>
              </div>
              <div className="rounded-lg border border-hairline bg-surface-2 p-3">
                <p className="text-lg font-semibold tracking-[-0.02em] tabular-nums text-ink-1">{fmt(p.signals)}</p>
                <p className="text-[11px] text-ink-3">{t.signalsMoving}</p>
              </div>
            </div>

            <p className="mt-5 rounded-lg border-l-4 border-accent bg-accent-soft/60 px-4 py-3 text-sm leading-relaxed text-ink-2">
              {cumpleTxt}
            </p>
          </div>
        </div>

        {/* Ranking */}
        <div className="lg:col-span-3">
          <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-[11px] uppercase tracking-wide text-ink-3">
                  <th className="px-4 py-2.5 text-left font-semibold">{t.thProvider}</th>
                  <th className="px-3 py-2.5 text-right font-semibold">{t.thDevices}</th>
                  <th className="px-3 py-2.5 text-right font-semibold">{t.thPulses}</th>
                  <th className="px-3 py-2.5 text-right font-semibold">{t.thLatency}</th>
                  <th className="px-4 py-2.5 text-left font-semibold">{t.thStatus}</th>
                </tr>
              </thead>
              <tbody>
                {ppmSorted.slice(0, 12).map((pp) => {
                  const e = estadoPpm(pp.ppm);
                  const on = pp.name === p.name;
                  return (
                    <tr
                      key={pp.name}
                      onClick={() => setSel(pp.name)}
                      className={`cursor-pointer border-t border-hairline transition-colors ${on ? "bg-accent-soft" : "hover:bg-surface-2"}`}
                    >
                      <td className="max-w-[180px] truncate px-4 py-2.5 font-semibold text-ink-2" title={pp.name}>{pp.name}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-3">{fmt(pp.assets)}</td>
                      <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${e[1]}`}>{(pp.ppm || 0).toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-3">{demora(pp.prov_latency_s)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${e[1]} ${e[2]}`}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: e[3] }} />{e[0]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-ink-3">{t.tapHint}</p>
        </div>
      </div>
    </section>
  );
}
