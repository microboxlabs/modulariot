"use client";

import { useMemo, useState } from "react";
import { GPS_DATA, type GpsProvider } from "./torre-modules-data";

// ============================================================
// Proveedores GPS — ¿qué tan precisa es la señal de cada proveedor?
// Port nativo (DS) de /torre.html#gps-providers. Métrica comercial:
// pulsos/min por dispositivo EN MOVIMIENTO. 12 = precisión ModularIoT,
// 20 = estándar minería. Datos reales de la última hora.
// ============================================================

const fmt = (n: number) => n.toLocaleString("es-CL");
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const STD_MBL = GPS_DATA.meta.std_mbl || 12;
const STD_MIN = GPS_DATA.meta.std_mineria || 20;

// Estado por pulsos/min → [label, textClass, bgClass, barColor].
function estadoPpm(v: number): [string, string, string, string] {
  if (v >= STD_MIN) return ["Estándar minería", "text-green-800", "bg-green-100", "#065f46"];
  if (v >= STD_MBL) return ["Precisión ModularIoT", "text-green-700", "bg-green-100", "#0f766e"];
  if (v >= 6) return ["Bajo estándar", "text-amber-700", "bg-amber-100", "#b45309"];
  return ["Muy bajo", "text-rose-700", "bg-rose-100", "#b91c1c"];
}
const demora = (v: number) => (v >= 0 ? `${v}s` : "—");

export default function GpsProviders() {
  const t = GPS_DATA.totals;
  const provs = useMemo(() => [...GPS_DATA.providers].sort((a, b) => b.signals - a.signals), []);
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
    p.ppm >= STD_MIN ? `Cumple el estándar de minería (${STD_MIN}/min) y el de precisión ModularIoT (${STD_MBL}/min).`
    : p.ppm >= STD_MBL ? `Cumple el estándar de precisión ModularIoT (${STD_MBL}/min); aún no el de minería (${STD_MIN}/min).`
    : `No alcanza el estándar de precisión ModularIoT (${STD_MBL}/min) — su posición es menos precisa.`;

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
      <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Observabilidad de datos</p>
      <h1 className="mt-4 max-w-4xl text-4xl font-extrabold tracking-tight text-gray-950 sm:text-5xl">
        ¿Qué tan precisa es la señal de cada proveedor GPS?
      </h1>
      <p className="mt-6 max-w-3xl text-lg leading-relaxed text-gray-600">
        La precisión depende de la <b>frecuencia de la señal en movimiento</b>. <b>12 pulsos por minuto</b> garantizan el estándar de precisión
        de ModularIoT; <b>20</b> es el que exige la minería. En una operación real, casi ningún proveedor los alcanza.
      </p>
      <p className="mt-2 font-mono text-xs text-gray-400">{GPS_DATA.meta.source} · {GPS_DATA.meta.window}</p>
      <p className="mt-1 text-xs text-gray-400">Datos reales de proveedores GPS en operación — medidos, no simulados.</p>

      {/* Resumen de flota */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [t.ppm_fleet.toFixed(2), "pulsos/min promedio", null],
          [`${cumplenMBL} de ${t.proveedores}`, `cumple precisión (${STD_MBL}/min)`, "text-green-700"],
          [`${cumplenMin} de ${t.proveedores}`, `cumple minería (${STD_MIN}/min)`, cumplenMin ? "text-green-700" : "text-rose-600"],
          [fmt(t.assets), "dispositivos en movimiento", null],
        ].map(([v, l, cls]) => (
          <div key={l as string} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className={`text-2xl font-extrabold tabular-nums tracking-tight ${cls || "text-gray-950"}`}>{v}</p>
            <p className="mt-1 text-xs font-medium text-gray-500">{l}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        {/* Detalle del proveedor seleccionado */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-bold text-gray-950">{p.name}</h3>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${sp[1]} ${sp[2]}`}>{sp[0]}</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">#{rankPos} de {provs.length} por precisión · {fmt(p.assets)} dispositivos · {pct(p.signals, t.signals)}% de la señal</p>

            <div className="mt-5">
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-extrabold tabular-nums tracking-tight text-gray-950">{(p.ppm || 0).toFixed(1)}</span>
                <span className="text-sm text-gray-500">pulsos/min</span>
              </div>
              {/* Gauge */}
              <div className="relative mt-3 h-6 overflow-hidden rounded-lg bg-gray-100">
                <div className="absolute inset-y-0 left-0 rounded-lg" style={{ width: `${px(p.ppm || 0)}%`, background: sp[3], opacity: 0.9 }} />
                <div className="absolute inset-y-[-2px] w-0.5 bg-green-700" style={{ left: `${px(STD_MBL)}%` }} />
                <div className="absolute inset-y-[-2px] w-0.5 bg-green-900" style={{ left: `${px(STD_MIN)}%` }} />
              </div>
              <div className="relative mt-1 h-4 text-[10px] text-gray-400">
                <span className="absolute -translate-x-1/2" style={{ left: `${px(STD_MBL)}%` }}>12 · Precisión</span>
                <span className="absolute -translate-x-1/2" style={{ left: `${px(STD_MIN)}%` }}>20 · Minería</span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-lg font-extrabold tabular-nums text-gray-950">{demora(p.prov_latency_s)}</p>
                <p className="text-[11px] text-gray-500">latencia del proveedor</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-lg font-extrabold tabular-nums text-gray-950">{fmt(p.signals)}</p>
                <p className="text-[11px] text-gray-500">señales en movimiento</p>
              </div>
            </div>

            <p className="mt-5 rounded-lg border-l-4 border-blue-600 bg-blue-50/60 px-4 py-3 text-sm leading-relaxed text-gray-700">
              {cumpleTxt}
            </p>
          </div>
        </div>

        {/* Ranking */}
        <div className="lg:col-span-3">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-2.5 text-left font-semibold">Proveedor</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Disp.</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Pulsos/min</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Latencia</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Estado</th>
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
                      className={`cursor-pointer border-t border-gray-100 transition-colors ${on ? "bg-blue-50" : "hover:bg-gray-50"}`}
                    >
                      <td className="max-w-[180px] truncate px-4 py-2.5 font-semibold text-gray-800" title={pp.name}>{pp.name}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{fmt(pp.assets)}</td>
                      <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${e[1]}`}>{(pp.ppm || 0).toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{demora(pp.prov_latency_s)}</td>
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
          <p className="mt-3 text-xs text-gray-400">Toca un proveedor para ver su detalle. Métrica: señales por minuto y dispositivo, solo con velocidad &gt; 0.</p>
        </div>
      </div>
    </section>
  );
}
