"use client";

import { useMemo, useState } from "react";
import { FAMILIES, SYMPTOMS, META, PRODDATA, type Symptom, type ProdEntry } from "./torre-data";

// ============================================================
// Torre de Control — explorador nativo de síntomas.
// Reemplaza el enlace a /torre.html. Look & feel Design System:
// tarjetas blancas + borde 1px + radio 12px, azul primario, íconos SVG.
// Datos reales (junio 2026) para los 12 síntomas en PRODDATA (por technicalName).
// ============================================================

// Colores de familia — dentro de la paleta DS (azul/verde/ámbar/rosa/gris).
const FAMILY_DOT = [
  "bg-blue-600",
  "bg-green-500",
  "bg-amber-500",
  "bg-blue-400",
  "bg-rose-500",
  "bg-gray-500",
];

const fmtN = (n: number) => n.toLocaleString("es-CL");
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

// Íconos del modelo Ver→Entender→Actuar→Resolver→Mejorar (Flowbite outline).
const STEP_ICON: Record<string, React.ReactNode> = {
  see: <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z M12 15a3 3 0 100-6 3 3 0 000 6Z" />,
  understand: <path d="M12 3a7 7 0 00-4 12.7V18a1 1 0 001 1h6a1 1 0 001-1v-2.3A7 7 0 0012 3Z M9 22h6" />,
  act: <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8Z" />,
  solve: <path d="M9 12l2 2 4-4 M21 12a9 9 0 11-18 0 9 9 0 0118 0Z" />,
  improve: <path d="M3 17l6-6 4 4 8-8 M21 7v5h-5" />,
};

const STEP_META = [
  { key: "see", label: "Ver", tint: "text-blue-600 bg-blue-50" },
  { key: "understand", label: "Entender", tint: "text-blue-600 bg-blue-50" },
  { key: "act", label: "Actuar", tint: "text-green-600 bg-green-50" },
  { key: "solve", label: "Resolver", tint: "text-amber-600 bg-amber-50" },
  { key: "improve", label: "Mejorar", tint: "text-rose-600 bg-rose-50" },
] as const;

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-600">
      {children}
    </span>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-2xl font-extrabold tabular-nums tracking-tight text-gray-950">{value}</p>
      <p className="mt-1 text-xs font-medium text-gray-500">{label}</p>
      {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}

// Mini barras verticales (sin librería) para la serie diaria.
function DailyChart({ daily }: { daily: ProdEntry["daily"] }) {
  const max = Math.max(...daily.map((d) => d.total), 1);
  return (
    <div className="flex h-32 items-end gap-[3px]">
      {daily.map((d) => {
        const h = Math.max(4, Math.round((d.total / max) * 100));
        const h4 = d.total > 0 ? Math.round((d.icu4 / d.total) * 100) : 0;
        return (
          <div
            key={d.dia}
            className="flex flex-1 flex-col justify-end self-stretch"
            title={`${d.dia}: ${fmtN(d.total)} · negro ${fmtN(d.icu4)}`}
          >
            <div className="w-full overflow-hidden rounded-t bg-blue-500/80" style={{ height: `${h}%` }}>
              <div className="w-full bg-rose-500" style={{ height: `${h4}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Ranking horizontal (rutas / transportistas / conductores).
function DimBars({ title, rows }: { title: string; rows: ProdEntry["route"] }) {
  const max = Math.max(...rows.map((r) => r.total), 1);
  if (!rows.length) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{title}</p>
      <div className="space-y-1.5">
        {rows.slice(0, 5).map((r) => (
          <div key={r.dim} className="flex items-center gap-2 text-sm">
            <span className="w-40 shrink-0 truncate text-gray-700" title={r.dim}>{r.dim}</span>
            <div className="h-4 flex-1 overflow-hidden rounded bg-gray-100">
              <div className="h-full rounded bg-blue-500/80" style={{ width: `${Math.max(6, pct(r.total, max))}%` }} />
            </div>
            <span className="w-12 shrink-0 text-right tabular-nums text-gray-500">{fmtN(r.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailModal({ s, onClose }: { s: Symptom; onClose: () => void }) {
  const data: ProdEntry | undefined = PRODDATA[s.technicalName];
  const k = data?.kpis;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-950/50 p-4 sm:p-8" onClick={onClose}>
      <div
        className="my-4 w-full max-w-3xl rounded-xl border border-gray-200 bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-6">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${FAMILY_DOT[s.family]}`} />
              <span className="text-xs font-medium text-gray-500">{FAMILIES[s.family]}</span>
              {data && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-700">
                  Datos reales
                </span>
              )}
            </div>
            <h3 className="text-2xl font-bold tracking-tight text-gray-950">{s.name}</h3>
            <p className="mt-0.5 font-mono text-xs text-gray-400">{s.technicalName}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="space-y-8 p-6">
          {/* Riesgo */}
          <p className="rounded-lg border-l-4 border-rose-500 bg-rose-50 px-4 py-3 text-sm text-gray-700">
            <span className="font-semibold text-rose-700">Riesgo · </span>{s.risk}
          </p>

          {/* Modelo 5 pasos */}
          <div className="space-y-3">
            {STEP_META.map((st) => (
              <div key={st.key} className="flex gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${st.tint}`}>
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                    {STEP_ICON[st.key]}
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-bold text-gray-950">{st.label}</p>
                  <p className="text-sm leading-relaxed text-gray-600">{s[st.key as keyof Symptom] as string}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Entidades + evidencia */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">Entidades que cruza</p>
              <div className="flex flex-wrap gap-1.5">{s.entities.map((e) => <Chip key={e}>{e}</Chip>)}</div>
            </div>
            {s.evidence && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">Evidencia</p>
                <div className="flex flex-wrap gap-1.5">{s.evidence.map((e) => <Chip key={e}>{e}</Chip>)}</div>
              </div>
            )}
          </div>

          {/* Datos reales */}
          {data && k && (
            <div className="space-y-5 rounded-xl border border-gray-200 bg-gray-50/60 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-950">Operación real · {META.month}</p>
                <span className="text-[11px] text-gray-400">{META.total_trips.toLocaleString("es-CL")} viajes</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Síntomas detectados" value={fmtN(k.total)} />
                <Stat label="Gestionables" value={fmtN(k.gestionables)} sub={`${pct(k.gestionables, k.total)}% del total`} />
                <Stat label="Con tratamiento" value={`${pct(k.con_tratamiento, k.gestionables)}%`} sub="de los gestionables" />
                <Stat label="Se invalidan" value={`${pct(k.invalidados, k.con_tratamiento)}%`} sub="cerrar ≠ resolver" />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Conductores" value={fmtN(k.conductores)} />
                <Stat label="Transportistas" value={fmtN(k.transportistas)} />
                <Stat label="Código negro" value={fmtN(k.blackcode)} sub="severidad máxima" />
                <Stat label="SLA gestión p50" value={k.sla_p50_min != null ? `${k.sla_p50_min}m` : "—"} sub={k.sla_p90_min != null ? `p90 ${k.sla_p90_min}m` : undefined} />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Detección diaria</p>
                  <span className="flex items-center gap-3 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-500/80" />total</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-rose-500" />código negro</span>
                  </span>
                </div>
                <DailyChart daily={data.daily} />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <DimBars title="Top rutas" rows={data.route} />
                <DimBars title="Top transportistas" rows={data.carrier} />
              </div>
            </div>
          )}

          {!data && (
            <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500">
              Este síntoma está desplegado en la plataforma; el dashboard con datos reales se activa al conectar tu operación.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TorreDeControl() {
  const [fam, setFam] = useState<number | "all">("all");
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState<Symptom | null>(null);

  const counts = useMemo(() => {
    const c = FAMILIES.map((_, i) => SYMPTOMS.filter((s) => s.family === i).length);
    return c;
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SYMPTOMS.filter((s) => (fam === "all" || s.family === fam) &&
      (!q || s.name.toLowerCase().includes(q) || s.technicalName.toLowerCase().includes(q)));
  }, [fam, query]);

  const withData = SYMPTOMS.filter((s) => PRODDATA[s.technicalName]).length;

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
      {/* Encabezado */}
      <div className="max-w-3xl">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-blue-600">Torre de control</p>
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-950 sm:text-5xl">
          {SYMPTOMS.length} síntomas, una misma inteligencia
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-gray-600">
          Cada síntoma se ve, se entiende, se actúa, se resuelve y se mejora. Explora el catálogo real de detección:
          {" "}<span className="font-semibold text-gray-950">{withData} tienen datos de una operación real</span> ({META.month}).
        </p>
        <p className="mt-2 font-mono text-xs text-gray-400">{META.source}</p>
      </div>

      {/* Controles */}
      <div className="mt-10 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFam("all")}
          className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
            fam === "all" ? "border-gray-950 bg-gray-950 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
          }`}
        >
          Todas <span className="opacity-60">{SYMPTOMS.length}</span>
        </button>
        {FAMILIES.map((f, i) => (
          <button
            key={f}
            onClick={() => setFam(i)}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              fam === i ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${FAMILY_DOT[i]}`} />
            {f} <span className="opacity-60">{counts[i]}</span>
          </button>
        ))}
      </div>

      <div className="mt-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar síntoma…"
          className="w-full max-w-sm rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
        />
      </div>

      {/* Grid de síntomas */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((s) => {
          const data = PRODDATA[s.technicalName];
          return (
            <button
              key={s.id}
              onClick={() => setSel(s)}
              className="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 text-left transition-all hover:border-blue-300 hover:shadow-md"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                  <span className={`h-2 w-2 rounded-full ${FAMILY_DOT[s.family]}`} />
                  {FAMILIES[s.family]}
                </span>
                {data && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-700">
                    Real
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold leading-snug text-gray-950">{s.name}</h3>
              <p className="mt-0.5 font-mono text-[11px] text-gray-400">{s.technicalName}</p>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-gray-600 line-clamp-2">{s.see}</p>
              {s.kpiChip && (
                <span className="mt-4 inline-block self-start rounded-md bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-600">
                  {s.kpiChip}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {shown.length === 0 && (
        <p className="mt-10 text-center text-gray-500">Sin síntomas para ese filtro.</p>
      )}

      {sel && <DetailModal s={sel} onClose={() => setSel(null)} />}
    </section>
  );
}
