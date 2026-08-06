"use client";

import { useMemo, useState } from "react";
import { type Symptom, type ProdEntry } from "./torre-data";
import { getTorre } from "./module-i18n";

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
  see: (
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z M12 15a3 3 0 100-6 3 3 0 000 6Z" />
  ),
  understand: (
    <path d="M12 3a7 7 0 00-4 12.7V18a1 1 0 001 1h6a1 1 0 001-1v-2.3A7 7 0 0012 3Z M9 22h6" />
  ),
  act: <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8Z" />,
  solve: <path d="M9 12l2 2 4-4 M21 12a9 9 0 11-18 0 9 9 0 0118 0Z" />,
  improve: <path d="M3 17l6-6 4 4 8-8 M21 7v5h-5" />,
};

const STEP_META = [
  { key: "see", tint: "text-accent bg-accent-soft" },
  { key: "understand", tint: "text-accent bg-accent-soft" },
  { key: "act", tint: "text-green-600 bg-green-50" },
  { key: "solve", tint: "text-amber-600 bg-amber-50" },
  { key: "improve", tint: "text-rose-600 bg-rose-50" },
] as const;

// Diccionario trilingüe de strings de UI (los datos ya vienen traducidos por getTorre).
const UI = {
  es: {
    // Pasos Ver→Entender→Actuar→Resolver→Mejorar
    see: "Ver",
    understand: "Entender",
    act: "Actuar",
    solve: "Resolver",
    improve: "Mejorar",
    // Encabezado
    towerEyebrow: "Torre de control",
    headlineSuffix: "síntomas, una misma inteligencia",
    lede: "Cada síntoma se ve, se entiende, se actúa, se resuelve y se mejora. Explora el catálogo real de detección:",
    haveRealData: "tienen datos de una operación real",
    // Controles
    allFilter: "Todas",
    searchPlaceholder: "Buscar síntoma…",
    realBadge: "Real",
    noResults: "Sin síntomas para ese filtro.",
    // Modal de detalle
    realDataBadge: "Datos reales",
    close: "Cerrar",
    riskLabel: "Riesgo · ",
    crossedEntities: "Entidades que cruza",
    evidence: "Evidencia",
    realOperation: "Operación real · ",
    trips: "viajes",
    symptomsDetected: "Síntomas detectados",
    manageable: "Gestionables",
    ofTotal: "del total",
    withTreatment: "Con tratamiento",
    ofManageable: "de los gestionables",
    invalidated: "Se invalidan",
    closeNotResolve: "cerrar ≠ resolver",
    drivers: "Conductores",
    carriers: "Transportistas",
    blackCode: "Código negro",
    maxSeverity: "severidad máxima",
    slaP50: "SLA gestión p50",
    glossary:
      "Gestionable: requiere acción · Con tratamiento: alguien lo gestionó · Se invalida: al revisarlo no correspondía (ruido) · Código negro: severidad máxima · SLA p50: la mitad se gestionó dentro de ese tiempo",
    rankNote:
      "Valores absolutos: un transportista con más viajes acumula más síntomas.",
    dailyDetection: "Detección diaria",
    legendTotal: "total",
    legendBlackCode: "código negro",
    topRoutes: "Top rutas",
    topCarriers: "Top transportistas",
    notConnected:
      "Este síntoma está desplegado en la plataforma; el dashboard con datos reales se activa al conectar tu operación.",
  },
  en: {
    see: "See",
    understand: "Understand",
    act: "Act",
    solve: "Resolve",
    improve: "Improve",
    towerEyebrow: "Control tower",
    headlineSuffix: "symptoms, one shared intelligence",
    lede: "Every symptom is seen, understood, acted on, resolved and improved. Explore the real detection catalog:",
    haveRealData: "have data from a real operation",
    allFilter: "All",
    searchPlaceholder: "Search symptom…",
    realBadge: "Real",
    noResults: "No symptoms for that filter.",
    realDataBadge: "Real data",
    close: "Close",
    riskLabel: "Risk · ",
    crossedEntities: "Entities it crosses",
    evidence: "Evidence",
    realOperation: "Real operation · ",
    trips: "trips",
    symptomsDetected: "Symptoms detected",
    manageable: "Manageable",
    ofTotal: "of total",
    withTreatment: "With treatment",
    ofManageable: "of manageable",
    invalidated: "Invalidated",
    closeNotResolve: "close ≠ resolve",
    drivers: "Drivers",
    carriers: "Carriers",
    blackCode: "Black code",
    maxSeverity: "max severity",
    slaP50: "Handling SLA p50",
    glossary:
      "Manageable: requires action · With treatment: someone handled it · Invalidated: on review it didn't apply (noise) · Black code: maximum severity · SLA p50: half were handled within that time",
    rankNote:
      "Absolute values: a carrier with more trips accumulates more symptoms.",
    dailyDetection: "Daily detection",
    legendTotal: "total",
    legendBlackCode: "black code",
    topRoutes: "Top routes",
    topCarriers: "Top carriers",
    notConnected:
      "This symptom is deployed on the platform; the dashboard with real data activates when you connect your operation.",
  },
  pt: {
    see: "Ver",
    understand: "Entender",
    act: "Atuar",
    solve: "Resolver",
    improve: "Melhorar",
    towerEyebrow: "Torre de controle",
    headlineSuffix: "sintomas, uma mesma inteligência",
    lede: "Cada sintoma se vê, se entende, se atua, se resolve e se melhora. Explore o catálogo real de detecção:",
    haveRealData: "têm dados de uma operação real",
    allFilter: "Todas",
    searchPlaceholder: "Buscar sintoma…",
    realBadge: "Real",
    noResults: "Nenhum sintoma para esse filtro.",
    realDataBadge: "Dados reais",
    close: "Fechar",
    riskLabel: "Risco · ",
    crossedEntities: "Entidades que cruza",
    evidence: "Evidência",
    realOperation: "Operação real · ",
    trips: "viagens",
    symptomsDetected: "Sintomas detectados",
    manageable: "Gerenciáveis",
    ofTotal: "do total",
    withTreatment: "Com tratamento",
    ofManageable: "dos gerenciáveis",
    invalidated: "São invalidados",
    closeNotResolve: "fechar ≠ resolver",
    drivers: "Motoristas",
    carriers: "Transportadoras",
    blackCode: "Código preto",
    maxSeverity: "severidade máxima",
    slaP50: "SLA de gestão p50",
    glossary:
      "Gerenciável: exige ação · Com tratamento: alguém o geriu · Invalidado: na revisão não procedia (ruído) · Código preto: severidade máxima · SLA p50: metade foi gerida dentro desse tempo",
    rankNote:
      "Valores absolutos: uma transportadora com mais viagens acumula mais sintomas.",
    dailyDetection: "Detecção diária",
    legendTotal: "total",
    legendBlackCode: "código preto",
    topRoutes: "Top rotas",
    topCarriers: "Top transportadoras",
    notConnected:
      "Este sintoma está implantado na plataforma; o painel com dados reais é ativado ao conectar sua operação.",
  },
} as const;

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-hairline bg-surface-2 text-ink-2 inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium">
      {children}
    </span>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="border-hairline bg-surface rounded-lg border p-4">
      <p className="text-ink-1 text-2xl font-semibold tracking-[-0.02em] tabular-nums">
        {value}
      </p>
      <p className="text-ink-3 mt-1 text-xs font-medium">{label}</p>
      {sub && <p className="text-ink-3 text-[11px]">{sub}</p>}
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
            <div
              className="w-full overflow-hidden rounded-t bg-blue-500/80"
              style={{ height: `${h}%` }}
            >
              <div
                className="w-full bg-rose-500"
                style={{ height: `${h4}%` }}
              />
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
      <p className="text-ink-3 mb-2 text-xs font-semibold tracking-wide uppercase">
        {title}
      </p>
      <div className="space-y-1.5">
        {rows.slice(0, 5).map((r) => (
          <div key={r.dim} className="flex items-center gap-2 text-sm">
            <span className="text-ink-2 w-40 shrink-0 truncate" title={r.dim}>
              {r.dim}
            </span>
            <div className="bg-surface-3 h-4 flex-1 overflow-hidden rounded">
              <div
                className="h-full rounded bg-blue-500/80"
                style={{ width: `${Math.max(6, pct(r.total, max))}%` }}
              />
            </div>
            <span className="text-ink-3 w-12 shrink-0 text-right tabular-nums">
              {fmtN(r.total)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailModal({ s, onClose, lang }: { s: Symptom; onClose: () => void; lang: string }) {
  const { FAMILIES, META, PRODDATA } = getTorre(lang);
  const t = UI[lang as "es" | "en" | "pt"] ?? UI.es;
  const data: ProdEntry | undefined = PRODDATA[s.technicalName];
  const k = data?.kpis;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-950/50 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="border-hairline bg-surface my-4 w-full max-w-3xl rounded-xl border shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-hairline flex items-start justify-between gap-4 border-b p-6">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${FAMILY_DOT[s.family]}`}
              />
              <span className="text-ink-3 text-xs font-medium">
                {FAMILIES[s.family]}
              </span>
              {data && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-green-700 uppercase">
                  {t.realDataBadge}
                </span>
              )}
            </div>
            <h3 className="text-ink-1 text-2xl font-semibold tracking-[-0.02em]">
              {s.name}
            </h3>
            <p className="text-ink-3 mt-0.5 font-mono text-xs">
              {s.technicalName}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t.close}
            className="border-hairline text-ink-3 hover:bg-surface-2 shrink-0 rounded-lg border p-1.5"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="space-y-8 p-6">
          {/* Riesgo */}
          <p className="text-ink-2 rounded-lg border-l-4 border-rose-500 bg-rose-50 px-4 py-3 text-sm">
            <span className="font-semibold text-rose-700">{t.riskLabel}</span>
            {s.risk}
          </p>

          {/* Modelo 5 pasos */}
          <div className="space-y-3">
            {STEP_META.map((st) => (
              <div key={st.key} className="flex gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${st.tint}`}
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {STEP_ICON[st.key]}
                  </svg>
                </span>
                <div>
                  <p className="text-ink-1 text-sm font-semibold">
                    {t[st.key]}
                  </p>
                  <p className="text-ink-2 text-sm leading-relaxed">
                    {s[st.key as keyof Symptom] as string}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Entidades + evidencia */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-ink-3 mb-2 text-xs font-semibold tracking-wide uppercase">
                {t.crossedEntities}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {s.entities.map((e) => (
                  <Chip key={e}>{e}</Chip>
                ))}
              </div>
            </div>
            {s.evidence && (
              <div>
                <p className="text-ink-3 mb-2 text-xs font-semibold tracking-wide uppercase">
                  {t.evidence}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {s.evidence.map((e) => (
                    <Chip key={e}>{e}</Chip>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Datos reales */}
          {data && k && (
            <div className="border-hairline bg-surface-2/60 space-y-5 rounded-xl border p-5">
              <div className="flex items-center justify-between">
                <p className="text-ink-1 text-sm font-semibold">
                  {t.realOperation}
                  {META.month}
                </p>
                <span className="text-ink-3 text-[11px]">
                  {META.total_trips.toLocaleString("es-CL")} {t.trips}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label={t.symptomsDetected} value={fmtN(k.total)} />
                <Stat
                  label={t.manageable}
                  value={fmtN(k.gestionables)}
                  sub={`${pct(k.gestionables, k.total)}% ${t.ofTotal}`}
                />
                <Stat
                  label={t.withTreatment}
                  value={`${pct(k.con_tratamiento, k.gestionables)}%`}
                  sub={t.ofManageable}
                />
                <Stat
                  label={t.invalidated}
                  value={`${pct(k.invalidados, k.con_tratamiento)}%`}
                  sub={t.closeNotResolve}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label={t.drivers} value={fmtN(k.conductores)} />
                <Stat label={t.carriers} value={fmtN(k.transportistas)} />
                <Stat
                  label={t.blackCode}
                  value={fmtN(k.blackcode)}
                  sub={t.maxSeverity}
                />
                <Stat
                  label={t.slaP50}
                  value={k.sla_p50_min != null ? `${k.sla_p50_min} min` : "—"}
                  sub={
                    k.sla_p90_min != null
                      ? `p90 ${k.sla_p90_min} min`
                      : undefined
                  }
                />
              </div>

              <div>
                <p className="bg-surface-2 text-ink-3 mb-3 rounded-lg px-3 py-2 text-[11px] leading-relaxed">
                  {t.glossary}
                </p>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-ink-3 text-xs font-semibold tracking-wide uppercase">
                    {t.dailyDetection}
                  </p>
                  <span className="text-ink-3 flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-sm bg-blue-500/80" />
                      {t.legendTotal}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-sm bg-rose-500" />
                      {t.legendBlackCode}
                    </span>
                  </span>
                </div>
                <DailyChart daily={data.daily} />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <DimBars title={t.topRoutes} rows={data.route} />
                <DimBars title={t.topCarriers} rows={data.carrier} />
                <p className="text-ink-3 col-span-full text-[11px]">
                  {t.rankNote}
                </p>
              </div>
            </div>
          )}

          {!data && (
            <p className="border-hairline-strong bg-surface-2 text-ink-3 rounded-lg border border-dashed px-4 py-3 text-sm">
              {t.notConnected}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TorreDeControl({ lang }: { lang: string }) {
  const { FAMILIES, SYMPTOMS, META, PRODDATA } = getTorre(lang);
  const t = UI[lang as "es" | "en" | "pt"] ?? UI.es;

  const [fam, setFam] = useState<number | "all">("all");
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState<Symptom | null>(null);

  const counts = useMemo(() => {
    const c = FAMILIES.map(
      (_, i) => SYMPTOMS.filter((s) => s.family === i).length,
    );
    return c;
  }, [FAMILIES, SYMPTOMS]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SYMPTOMS.filter(
      (s) =>
        (fam === "all" || s.family === fam) &&
        (!q ||
          s.name.toLowerCase().includes(q) ||
          s.technicalName.toLowerCase().includes(q)),
    );
  }, [SYMPTOMS, fam, query]);

  const withData = SYMPTOMS.filter((s) => PRODDATA[s.technicalName]).length;

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
      {/* Encabezado */}
      <div className="max-w-3xl">
        <p className="text-accent mb-4 text-sm font-semibold tracking-widest uppercase">
          {t.towerEyebrow}
        </p>
        <h1 className="text-ink-1 text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
          {SYMPTOMS.length} {t.headlineSuffix}
        </h1>
        <p className="text-ink-2 mt-6 text-lg leading-relaxed">
          {t.lede}{" "}
          <span className="text-ink-1 font-semibold">
            {withData} {t.haveRealData}
          </span>{" "}
          ({META.month}).
        </p>
        <p className="text-ink-3 mt-2 font-mono text-xs">{META.source}</p>
      </div>

      {/* Controles */}
      <div className="mt-10 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFam("all")}
          className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
            fam === "all"
              ? "border-ink-1 bg-ink-1 text-page"
              : "border-hairline bg-surface text-ink-2 hover:border-hairline-strong"
          }`}
        >
          {t.allFilter} <span className="opacity-60">{SYMPTOMS.length}</span>
        </button>
        {FAMILIES.map((f, i) => (
          <button
            key={f}
            onClick={() => setFam(i)}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              fam === i
                ? "border-accent bg-accent-soft text-accent"
                : "border-hairline bg-surface text-ink-2 hover:border-hairline-strong"
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
          placeholder={t.searchPlaceholder}
          className="border-hairline-strong bg-surface text-ink-1 placeholder:text-ink-4 focus:border-accent focus:ring-accent/20 w-full max-w-sm rounded-lg border px-3.5 py-2 text-sm focus:ring-2 focus:outline-none"
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
              className="group border-hairline bg-surface hover:border-accent flex flex-col rounded-xl border p-5 text-left transition-all hover:shadow-md"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-ink-3 flex items-center gap-1.5 text-xs font-medium">
                  <span
                    className={`h-2 w-2 rounded-full ${FAMILY_DOT[s.family]}`}
                  />
                  {FAMILIES[s.family]}
                </span>
                {data && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-green-700 uppercase">
                    {t.realBadge}
                  </span>
                )}
              </div>
              <h3 className="text-ink-1 text-base leading-snug font-semibold">
                {s.name}
              </h3>
              <p className="text-ink-3 mt-0.5 font-mono text-[11px]">
                {s.technicalName}
              </p>
              <p className="text-ink-2 mt-3 line-clamp-2 flex-1 text-sm leading-relaxed">
                {s.see}
              </p>
              {s.kpiChip && (
                <span className="bg-surface-3 text-ink-2 mt-4 inline-block self-start rounded-md px-2 py-1 text-[11px] font-semibold">
                  {s.kpiChip}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {shown.length === 0 && (
        <p className="text-ink-3 mt-10 text-center">{t.noResults}</p>
      )}

      {sel && <DetailModal s={sel} onClose={() => setSel(null)} lang={lang} />}
    </section>
  );
}
