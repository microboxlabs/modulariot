"use client";

import { useMemo, useState } from "react";
import PricingCalculator from "./PricingCalculator";
import { PILARES, REF_FLOTA, markupPilar } from "./pricing-boxes";
import { SYMPTOMS, FAMILIES } from "./torre-data";
import { getTorre } from "./module-i18n";

// ============================================================
// Precios en matriz: síntomas (filas, por familia) × capacidades
// (columnas: Ver → Notificar → Autonomía, acumulativas).
// Eliges hasta qué columna gestionar; los ✓ se llenan de izquierda a
// derecha y el precio nace del costo real de infraestructura por activo.
// Toggle "Por capacidad" (matriz) / "A medida" (calculadora por caja).
// ============================================================

type Lang = "es" | "en" | "pt";
type CapKey = "ver" | "notificar" | "autonomia";

const fmtUSD = (n: number) => "$" + n.toFixed(2);
const fmtTotal = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

const pilarTotal = (id: string) => {
  const p = PILARES.find((x) => x.id === id);
  return p ? p.items.reduce((a, it) => a + it.costoMes, 0) : 0;
};

// Precio/activo por caja. La detección (síntomas) se prorratea por síntoma
// elegido; notificar (integraciones) y autonomía (video) suman su infra fija.
const perActivo = (id: string) => (pilarTotal(id) * markupPilar(id)) / REF_FLOTA;
const P_BASE = perActivo("ingesta");
const P_SINT = perActivo("sintomas");
const P_VID = perActivo("video");
// La caja "Integraciones" se reparte: envío (API Gateway + Auth) → Gestión;
// el resto (flujos, MCP, bóveda de evidencia) → Automatización.
const INTEG_ITEMS = PILARES.find((p) => p.id === "integraciones")?.items ?? [];
const MK_INTEG = markupPilar("integraciones");
const sumInteg = (pred: (l: string) => boolean) =>
  (INTEG_ITEMS.filter((it) => pred(it.label)).reduce((a, it) => a + it.costoMes, 0) * MK_INTEG) / REF_FLOTA;
const ES_ENVIO = (l: string) => /API Gateway|Autenticac/i.test(l);
const P_ENVIO = sumInteg(ES_ENVIO); // Gestión: canales de envío
const P_INTEG_AUTO = sumInteg((l) => !ES_ENVIO(l)); // Automatización: flujos, MCP, bóveda
const BASE = P_BASE;
const N_TOTAL = SYMPTOMS.length;
const P_SINT_PER = P_SINT / N_TOTAL; // aporte de detección por síntoma
// Aporte al precio por columna: [detección (por síntoma), gestión (envío), automatización]
const APORTE = [P_SINT_PER, P_ENVIO, P_INTEG_AUTO + P_VID];
// Observabilidad de datos = línea base (fija arriba), no se lista como familia seleccionable.
const OBS_FI = FAMILIES.findIndex((f) => /observabilidad/i.test(f));
const SHOWN_FAMS = FAMILIES.map((_, i) => i).filter((i) => i !== OBS_FI);
const MAX_SEL = 1; // Automatización (2) aún no disponible.

const CAP_ORDER: CapKey[] = ["ver", "notificar", "autonomia"];
// Precios de las 3 capacidades según cuántos síntomas (nSel) estén elegidos.
function capPricesFor(nSel: number): number[] {
  const ver = P_BASE + P_SINT * (nSel / N_TOTAL);
  const notificar = ver + P_ENVIO; // Gestión: + canales de envío (Gateway + Auth)
  const autonomia = notificar + P_INTEG_AUTO + P_VID; // Automatización: + flujos, MCP, bóveda, video
  return [ver, notificar, autonomia];
}

const T: Record<Lang, {
  toggleNivel: string; toggleMedida: string;
  colSintomas: string; cta: string; from: string; perUnit: string;
  baseNote: (p: string) => string; selHint: string;
  assets: string; totalMo: string;
  soon: string; msgNote: string;
  obsTitle: string; obsDesc: string; obsLink: string;
  caps: Record<CapKey, { name: string; tagline: string; desc: string }>;
}> = {
  es: {
    toggleNivel: "Por capacidad", toggleMedida: "A medida",
    colSintomas: "Síntomas a gestionar", cta: "Cotizar", from: "Desde", perUnit: "/activo · mes",
    baseNote: (p) => `Base de ingesta GPS incluida en todas las capacidades · desde ${p}/activo·mes`,
    selHint: "Elige hasta dónde quieres gestionar cada síntoma",
    assets: "Activos a monitorear", totalMo: "/mes",
    soon: "Próximamente", msgNote: "Los envíos de WhatsApp y SMS se cobran por separado (por mensaje).",
    obsTitle: "Observabilidad de datos · incluida en la base",
    obsDesc: "Mide la confiabilidad de la señal GPS, sistemas y sensores en tiempo real. Es la base sobre la que se apoya todo lo demás.",
    obsLink: "Mídela sola para evaluar tus proveedores GPS",
    caps: {
      ver: { name: "Detección", tagline: "Detecta y clasifica", desc: "Detecta y clasifica cada síntoma en tiempo real, con severidad y responsable. La Torre de Control muestra qué pasa sobre tu operación real." },
      notificar: { name: "Gestión", tagline: "Escala con plan y dueño", desc: "Escala cada síntoma al canal donde vive la operación —correo, WhatsApp, Teams, Webex, SMS— con su plan y su dueño. Todo queda registrado." },
      autonomia: { name: "Automatización", tagline: "Automatiza y reduce", desc: "Automatiza la gestión con workflows y video: la operación reduce sus desviaciones sola y mide la mejora mes a mes." },
    },
  },
  en: {
    toggleNivel: "By capability", toggleMedida: "Custom",
    colSintomas: "Symptoms to manage", cta: "Get a quote", from: "From", perUnit: "/asset · mo",
    baseNote: (p) => `GPS ingestion base included in every capability · from ${p}/asset·mo`,
    selHint: "Choose how far to manage each symptom",
    assets: "Assets to monitor", totalMo: "/mo",
    soon: "Coming soon", msgNote: "WhatsApp and SMS deliveries are billed separately (per message).",
    obsTitle: "Data observability · included in the base",
    obsDesc: "Measures the reliability of GPS signal, systems and sensors in real time. It's the base everything else stands on.",
    obsLink: "Measure it on its own to evaluate your GPS providers",
    caps: {
      ver: { name: "Detection", tagline: "Detect and classify", desc: "Detects and classifies every symptom in real time, with severity and owner. The Control Tower shows what happens on your real operation." },
      notificar: { name: "Management", tagline: "Escalate with owner and plan", desc: "Escalates every symptom to the channel where the operation lives —email, WhatsApp, Teams, Webex, SMS— with its plan and owner. Everything is logged." },
      autonomia: { name: "Automation", tagline: "Automate and reduce", desc: "Automates handling with workflows and video: the operation reduces its deviations on its own and measures the improvement month over month." },
    },
  },
  pt: {
    toggleNivel: "Por capacidade", toggleMedida: "Sob medida",
    colSintomas: "Sintomas a gerir", cta: "Cotar", from: "A partir de", perUnit: "/ativo · mês",
    baseNote: (p) => `Base de ingestão GPS incluída em todas as capacidades · a partir de ${p}/ativo·mês`,
    selHint: "Escolha até onde gerir cada sintoma",
    assets: "Ativos a monitorar", totalMo: "/mês",
    soon: "Em breve", msgNote: "Os envios de WhatsApp e SMS são cobrados à parte (por mensagem).",
    obsTitle: "Observabilidade de dados · incluída na base",
    obsDesc: "Mede a confiabilidade do sinal GPS, sistemas e sensores em tempo real. É a base sobre a qual tudo o mais se apoia.",
    obsLink: "Meça-a sozinha para avaliar seus provedores GPS",
    caps: {
      ver: { name: "Detecção", tagline: "Detecta e classifica", desc: "Detecta e classifica cada sintoma em tempo real, com severidade e responsável. A Torre de Controle mostra o que acontece na sua operação real." },
      notificar: { name: "Gestão", tagline: "Escalona com plano e responsável", desc: "Escalona cada sintoma ao canal onde vive a operação —e-mail, WhatsApp, Teams, Webex, SMS— com seu plano e responsável. Tudo fica registrado." },
      autonomia: { name: "Automação", tagline: "Automatiza e reduz", desc: "Automatiza a gestão com workflows e vídeo: a operação reduz seus desvios sozinha e mede a melhoria mês a mês." },
    },
  },
};

const CAP_ICON: Record<CapKey, React.ReactNode> = {
  ver: <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z M12 15a3 3 0 100-6 3 3 0 000 6Z" />,
  notificar: <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 01-3.4 0" />,
  autonomia: <path d="M12 8V4H8 M4 8h16v12H4z M2 14h2 M20 14h2 M9 13v2 M15 13v2" />,
};
function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={`h-4 w-4 shrink-0 text-ink-3 transition-transform ${open ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export default function PricingTiers({ lang = "es", base }: { lang?: Lang; base: string }) {
  const t = T[lang] || T.es;
  // Síntomas y familias del idioma activo (nombres traducidos para el render).
  const { SYMPTOMS: SYM, FAMILIES: FAMS } = getTorre(lang);
  const [view, setView] = useState<"nivel" | "medida">("nivel");
  const [sel, setSel] = useState<number>(1); // capacidad elegida (0=ver,1=notificar,2=autonomia)
  const [open, setOpen] = useState<Record<number, boolean>>({});
  // Síntomas deseleccionados (por id). Vacío = todos elegidos.
  const [off, setOff] = useState<Set<string>>(() => new Set());
  const [activos, setActivos] = useState<number>(500);
  const clampAssets = (n: number) => Math.max(1, Math.min(100000, Math.round(n) || 0));
  // Tooltip del cuadrante (síntoma × nivel).
  const [tip, setTip] = useState<null | { title: string; level: string; desc: string; price: string; x: number; y: number }>(null);

  const byFamily = useMemo(
    () => FAMS.map((_, fi) => SYM.filter((s) => s.family === fi)),
    [SYM, FAMS],
  );
  const isOn = (id: string) => !off.has(id);
  const famState = (fi: number) => {
    const items = byFamily[fi];
    const on = items.filter((s) => isOn(s.id)).length;
    return { all: on === items.length, none: on === 0, some: on > 0 && on < items.length };
  };
  const toggleSym = (id: string) =>
    setOff((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleFam = (fi: number) =>
    setOff((s) => {
      const n = new Set(s);
      const items = byFamily[fi];
      const allOn = items.every((it) => !n.has(it.id));
      items.forEach((it) => (allOn ? n.add(it.id) : n.delete(it.id)));
      return n;
    });

  // Síntomas elegidos → precios dinámicos (la detección escala).
  const nSel = SYM.length - off.size;
  const capPrices = useMemo(() => capPricesFor(nSel), [nSel]);
  const selPrice = capPrices[sel];

  // Datos de las 3 columnas para el tooltip del cuadrante.
  const cols = CAP_ORDER.map((k, i) => ({ name: t.caps[k].name, desc: t.caps[k].desc, price: `${fmtUSD(capPrices[i])}${t.perUnit}`, soon: i > MAX_SEL }));

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      {/* Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border border-hairline bg-surface p-1">
          {(["nivel", "medida"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`rounded-md px-5 py-2 text-sm font-semibold transition-colors ${view === v ? "bg-ink-1 text-page" : "text-ink-2 hover:text-ink-1"}`}>
              {v === "nivel" ? t.toggleNivel : t.toggleMedida}
            </button>
          ))}
        </div>
      </div>

      {view === "medida" ? (
        <div className="mt-2"><PricingCalculator base={base} /></div>
      ) : (
        <>
          {/* Observabilidad de datos — línea base fija */}
          <div className="mx-auto mt-8 max-w-3xl rounded-xl border border-hairline bg-surface-2 p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z M12 15a3 3 0 100-6 3 3 0 000 6Z" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-ink-1">{t.obsTitle}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">{t.obsDesc}</p>
                <a href={`${base}/proveedores-gps`} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:text-accent-strong">
                  {t.obsLink}
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h15m0 0l-6-6m6 6l-6 6" /></svg>
                </a>
              </div>
            </div>
          </div>

          <p className="mt-8 text-center text-sm text-ink-3">{t.selHint}</p>

          {/* Activos a monitorear */}
          <div className="mx-auto mt-6 flex max-w-xl flex-col items-center gap-3 rounded-xl border border-hairline bg-surface-2 p-4 sm:flex-row sm:gap-5">
            <label htmlFor="pt-activos" className="shrink-0 text-sm font-semibold text-ink-2">{t.assets}</label>
            <input id="pt-activos" type="number" min={1} value={activos}
              onChange={(e) => setActivos(clampAssets(+e.target.value))}
              className="w-28 rounded-lg border border-hairline-strong bg-surface px-3 py-2 text-sm font-semibold text-ink-1 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20" />
            <input type="range" min={100} max={5000} step={50} value={Math.min(Math.max(activos, 100), 5000)}
              onChange={(e) => setActivos(+e.target.value)} className="w-full flex-1 accent-blue-600" />
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[760px] table-fixed border-separate border-spacing-0">
              <colgroup>
                <col style={{ width: "34%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "22%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-surface px-4 py-3 text-left align-bottom">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-3">{t.colSintomas}</span>
                  </th>
                  {CAP_ORDER.map((key, ci) => {
                    const active = ci === sel;
                    const soon = ci > MAX_SEL; // Automatización aún no disponible
                    return (
                      <th key={key}
                        onClick={() => { if (!soon) setSel(ci); }}
                        className={`px-4 py-4 text-left align-top transition-colors ${soon ? "opacity-45" : "cursor-pointer"} ${active ? "bg-accent-soft" : soon ? "" : "hover:bg-surface-2"} ${ci === sel ? "rounded-t-xl border-x-2 border-t-2 border-accent" : "border-x border-t border-transparent"}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? "bg-accent text-white" : "bg-accent-soft text-accent"}`}>
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">{CAP_ICON[key]}</svg>
                          </span>
                          <span className="text-base font-semibold text-ink-1">{t.caps[key].name}</span>
                        </div>
                        <p className="mt-2 text-xs font-normal leading-relaxed text-ink-3">{t.caps[key].desc}</p>
                        {soon ? (
                          <span className="mt-3 inline-block rounded-full bg-surface-3 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t.soon}</span>
                        ) : (
                          <div className="mt-3 flex items-baseline gap-1">
                            <span className="text-xl font-semibold tracking-[-0.02em] text-ink-1">{fmtUSD(capPrices[ci])}</span>
                            <span className="text-[11px] font-normal text-ink-3">{t.perUnit}</span>
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {SHOWN_FAMS.map((fi) => {
                  const fam = FAMS[fi];
                  const isOpen = !!open[fi];
                  const fs = famState(fi);
                  return (
                    <FamilyRows key={fam} fi={fi} fam={fam} items={byFamily[fi]} isOpen={isOpen} sel={sel}
                      famAll={fs.all} famNone={fs.none} isOn={isOn} cols={cols} perUnit={t.perUnit} soonLabel={t.soon} onTip={setTip}
                      onToggleOpen={() => setOpen((o) => ({ ...o, [fi]: !o[fi] }))}
                      onToggleFam={() => toggleFam(fi)} onToggleSym={toggleSym} />
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="sticky left-0 bg-surface px-4 py-4 text-sm text-ink-3">
                    {t.baseNote(fmtUSD(BASE))}
                  </td>
                  {CAP_ORDER.map((key, ci) => {
                    const active = ci === sel;
                    return (
                      <td key={key} className={`px-4 py-4 align-top ${active ? "rounded-b-xl border-x-2 border-b-2 border-accent bg-accent-soft" : ""}`}>
                        {active && (
                          <div>
                            <p className="text-[11px] text-ink-3">{activos.toLocaleString("es-CL")} activos</p>
                            <p className="text-2xl font-semibold tracking-[-0.02em] tabular-nums text-accent">{fmtTotal(selPrice * activos)}<span className="text-xs font-medium text-ink-3">{t.totalMo}</span></p>
                            <a href={`${base}/contacto?intent=cotizar`}
                              className="mt-3 block rounded-lg border border-ink-1 bg-ink-1 px-4 py-2 text-center text-xs font-medium text-page transition-colors hover:bg-ink-2 hover:border-ink-2">
                              {t.cta} {t.caps[key].name}
                            </a>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="mt-4 text-center text-xs text-ink-3">{t.msgNote}</p>

          {/* Tooltip del cuadrante */}
          {tip && (
            <div
              className="pointer-events-none fixed z-50 w-72 rounded-xl border border-hairline bg-surface p-4 shadow-xl"
              style={{
                left: Math.min(tip.x + 16, (typeof window !== "undefined" ? window.innerWidth : 1200) - 304),
                top: tip.y + 16,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">{tip.level}</span>
                <span className="text-sm font-semibold text-accent">{tip.price}{tip.price.startsWith("+") && <span className="text-[11px] font-normal text-ink-3"> al total</span>}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-ink-1">{tip.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">{tip.desc}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

type Col = { name: string; desc: string; price: string; soon: boolean };
type TipData = { title: string; level: string; desc: string; price: string; x: number; y: number };

// Ícono de la capacidad en la celda (ojo/campana/robot), coloreado hasta el nivel.
function QuadIcon({ ci, on, sel }: { ci: number; on: boolean; sel: number }) {
  if (!on) return <span className="text-hairline">—</span>;
  const reached = ci <= sel;
  return (
    <svg className={`mx-auto h-[18px] w-[18px] ${reached ? "text-accent" : "text-hairline-strong"}`}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {CAP_ICON[CAP_ORDER[ci]]}
    </svg>
  );
}

// Fila de familia (colapsable, selección en bloque) + síntomas individuales.
function FamilyRows({ fi, fam, items, isOpen, sel, famAll, famNone, isOn, cols, perUnit, soonLabel, onTip, onToggleOpen, onToggleFam, onToggleSym }: {
  fi: number; fam: string; items: typeof SYMPTOMS; isOpen: boolean; sel: number;
  famAll: boolean; famNone: boolean; isOn: (id: string) => boolean;
  cols: Col[]; perUnit: string; soonLabel: string; onTip: (t: TipData | null) => void;
  onToggleOpen: () => void; onToggleFam: () => void; onToggleSym: (id: string) => void;
}) {
  const selCount = items.filter((s) => isOn(s.id)).length;
  // Aporte de este cuadrante al precio/activo. Detección: por síntoma (o suma de la familia).
  const aporte = (ci: number, isFamily: boolean) =>
    cols[ci].soon
      ? soonLabel
      : `+$${(ci === 0 ? (isFamily ? P_SINT_PER * Math.max(1, selCount) : P_SINT_PER) : APORTE[ci]).toFixed(2)}${perUnit}`;
  const tipHandlers = (title: string, ci: number, desc: string, isFamily: boolean) => ({
    onMouseEnter: (e: React.MouseEvent) => onTip({ title, level: cols[ci].name, desc, price: aporte(ci, isFamily), x: e.clientX, y: e.clientY }),
    onMouseMove: (e: React.MouseEvent) => onTip({ title, level: cols[ci].name, desc, price: aporte(ci, isFamily), x: e.clientX, y: e.clientY }),
    onMouseLeave: () => onTip(null),
  });
  return (
    <>
      <tr className={famNone ? "opacity-50" : ""}>
        <td className="sticky left-0 z-10 border-t border-hairline bg-surface px-4 py-2.5">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!famNone}
              ref={(el) => { if (el) el.indeterminate = !famAll && !famNone; }}
              onChange={onToggleFam}
              aria-label={fam}
              className="h-4 w-4 shrink-0 accent-blue-600"
            />
            <button onClick={onToggleOpen} className="flex items-start gap-1.5 text-left">
              <span className="mt-0.5"><Chevron open={isOpen} /></span>
              <span className="text-sm font-semibold text-ink-1">
                {fam} <span className="font-normal text-ink-3">· {selCount}/{items.length}</span>
              </span>
            </button>
          </div>
        </td>
        {[0, 1, 2].map((ci) => (
          <td key={ci} {...tipHandlers(fam, ci, cols[ci].desc, true)}
            className={`cursor-help border-t border-hairline px-3 py-2.5 ${ci === sel ? "border-x-2 border-accent bg-accent-soft/60" : ""}`}>
            <QuadIcon ci={ci} on={!famNone} sel={sel} />
          </td>
        ))}
      </tr>
      {isOpen && items.map((s) => {
        const on = isOn(s.id);
        const descs = [s.see, s.act, s.solve];
        return (
          <tr key={s.id} className={on ? "" : "opacity-50"}>
            <td className="sticky left-0 z-10 border-t border-hairline bg-surface py-2 pl-8 pr-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={on} onChange={() => onToggleSym(s.id)} aria-label={s.name}
                  className="h-3.5 w-3.5 shrink-0 accent-blue-600" />
                <span className="text-sm text-ink-2">{s.name}</span>
              </label>
            </td>
            {[0, 1, 2].map((ci) => (
              <td key={ci} {...tipHandlers(s.name, ci, descs[ci] || cols[ci].desc, false)}
                className={`cursor-help border-t border-hairline px-3 py-2 ${ci === sel ? "border-x-2 border-accent bg-accent-soft/60" : ""}`}>
                <QuadIcon ci={ci} on={on} sel={sel} />
              </td>
            ))}
          </tr>
        );
      })}
    </>
  );
}
