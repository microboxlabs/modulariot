"use client";

import { useMemo, useState } from "react";
import PricingCalculator from "./PricingCalculator";
import { PILARES, REF_FLOTA, markupPilar } from "./pricing-boxes";
import { SYMPTOMS, FAMILIES } from "./torre-data";

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
const P_INTEG = perActivo("integraciones");
const P_VID = perActivo("video");
const BASE = P_BASE;
const N_TOTAL = SYMPTOMS.length;

const CAP_ORDER: CapKey[] = ["ver", "notificar", "autonomia"];
// Precios de las 3 capacidades según cuántos síntomas (nSel) estén elegidos.
function capPricesFor(nSel: number): number[] {
  const ver = P_BASE + P_SINT * (nSel / N_TOTAL);
  const notificar = ver + P_INTEG;
  const autonomia = notificar + P_VID;
  return [ver, notificar, autonomia];
}

const T: Record<Lang, {
  toggleNivel: string; toggleMedida: string;
  colSintomas: string; cta: string; from: string; perUnit: string;
  baseNote: (p: string) => string; selHint: string;
  assets: string; totalMo: string;
  caps: Record<CapKey, { name: string; tagline: string; desc: string }>;
}> = {
  es: {
    toggleNivel: "Por capacidad", toggleMedida: "A medida",
    colSintomas: "Síntomas a gestionar", cta: "Cotizar", from: "Desde", perUnit: "/activo · mes",
    baseNote: (p) => `Base de ingesta GPS incluida en todas las capacidades · desde ${p}/activo·mes`,
    selHint: "Elige hasta dónde quieres gestionar cada síntoma",
    assets: "Activos a monitorear", totalMo: "/mes",
    caps: {
      ver: { name: "Ver", tagline: "Detecta y clasifica", desc: "Detecta y clasifica cada síntoma en tiempo real, con severidad y responsable. La Torre de Control muestra qué pasa sobre tu operación real." },
      notificar: { name: "Notificar", tagline: "Escala con plan y dueño", desc: "Escala cada síntoma al canal donde vive la operación —correo, WhatsApp, Teams, Webex, SMS— con su plan y su dueño. Todo queda registrado." },
      autonomia: { name: "Autonomía", tagline: "Automatiza y reduce", desc: "Automatiza la gestión con workflows y video: la operación reduce sus desviaciones sola y mide la mejora mes a mes." },
    },
  },
  en: {
    toggleNivel: "By capability", toggleMedida: "Custom",
    colSintomas: "Symptoms to manage", cta: "Get a quote", from: "From", perUnit: "/asset · mo",
    baseNote: (p) => `GPS ingestion base included in every capability · from ${p}/asset·mo`,
    selHint: "Choose how far to manage each symptom",
    assets: "Assets to monitor", totalMo: "/mo",
    caps: {
      ver: { name: "See", tagline: "Detect and classify", desc: "Detects and classifies every symptom in real time, with severity and owner. The Control Tower shows what happens on your real operation." },
      notificar: { name: "Notify", tagline: "Escalate with owner and plan", desc: "Escalates every symptom to the channel where the operation lives —email, WhatsApp, Teams, Webex, SMS— with its plan and owner. Everything is logged." },
      autonomia: { name: "Autonomy", tagline: "Automate and reduce", desc: "Automates handling with workflows and video: the operation reduces its deviations on its own and measures the improvement month over month." },
    },
  },
  pt: {
    toggleNivel: "Por capacidade", toggleMedida: "Sob medida",
    colSintomas: "Sintomas a gerir", cta: "Cotar", from: "A partir de", perUnit: "/ativo · mês",
    baseNote: (p) => `Base de ingestão GPS incluída em todas as capacidades · a partir de ${p}/ativo·mês`,
    selHint: "Escolha até onde gerir cada sintoma",
    assets: "Ativos a monitorar", totalMo: "/mês",
    caps: {
      ver: { name: "Ver", tagline: "Detecta e classifica", desc: "Detecta e classifica cada sintoma em tempo real, com severidade e responsável. A Torre de Controle mostra o que acontece na sua operação real." },
      notificar: { name: "Notificar", tagline: "Escalona com plano e responsável", desc: "Escalona cada sintoma ao canal onde vive a operação —e-mail, WhatsApp, Teams, Webex, SMS— com seu plano e responsável. Tudo fica registrado." },
      autonomia: { name: "Autonomia", tagline: "Automatiza e reduz", desc: "Automatiza a gestão com workflows e vídeo: a operação reduz seus desvios sozinha e mede a melhoria mês a mês." },
    },
  },
};

const CAP_ICON: Record<CapKey, React.ReactNode> = {
  ver: <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z M12 15a3 3 0 100-6 3 3 0 000 6Z" />,
  notificar: <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 01-3.4 0" />,
  autonomia: <path d="M12 8V4H8 M4 8h16v12H4z M2 14h2 M20 14h2 M9 13v2 M15 13v2" />,
};

function Check({ on }: { on: boolean }) {
  return (
    <svg className={`mx-auto h-4 w-4 ${on ? "text-blue-600" : "text-gray-200"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}
function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export default function PricingTiers({ lang = "es", base }: { lang?: Lang; base: string }) {
  const t = T[lang] || T.es;
  const [view, setView] = useState<"nivel" | "medida">("nivel");
  const [sel, setSel] = useState<number>(1); // capacidad elegida (0=ver,1=notificar,2=autonomia)
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [famOn, setFamOn] = useState<boolean[]>(() => FAMILIES.map(() => true));
  const [activos, setActivos] = useState<number>(500);
  const clampAssets = (n: number) => Math.max(1, Math.min(100000, Math.round(n) || 0));

  const byFamily = useMemo(
    () => FAMILIES.map((_, fi) => SYMPTOMS.filter((s) => s.family === fi)),
    [],
  );
  const toggleFam = (fi: number) => setFamOn((s) => s.map((v, i) => (i === fi ? !v : v)));

  // Síntomas elegidos (suma de las familias activas) → precios dinámicos.
  const nSel = useMemo(
    () => FAMILIES.reduce((a, _, fi) => a + (famOn[fi] ? byFamily[fi].length : 0), 0),
    [famOn, byFamily],
  );
  const capPrices = useMemo(() => capPricesFor(nSel), [nSel]);
  const selPrice = capPrices[sel];

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      {/* Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
          {(["nivel", "medida"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`rounded-md px-5 py-2 text-sm font-semibold transition-colors ${view === v ? "bg-gray-950 text-white" : "text-gray-600 hover:text-gray-950"}`}>
              {v === "nivel" ? t.toggleNivel : t.toggleMedida}
            </button>
          ))}
        </div>
      </div>

      {view === "medida" ? (
        <div className="mt-2"><PricingCalculator base={base} /></div>
      ) : (
        <>
          <p className="mt-8 text-center text-sm text-gray-500">{t.selHint}</p>

          {/* Activos a monitorear */}
          <div className="mx-auto mt-6 flex max-w-xl flex-col items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:flex-row sm:gap-5">
            <label htmlFor="pt-activos" className="shrink-0 text-sm font-semibold text-gray-800">{t.assets}</label>
            <input id="pt-activos" type="number" min={1} value={activos}
              onChange={(e) => setActivos(clampAssets(+e.target.value))}
              className="w-28 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20" />
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
                  <th className="sticky left-0 z-10 bg-white px-4 py-3 text-left align-bottom">
                    <span className="text-xs font-bold uppercase tracking-wide text-gray-400">{t.colSintomas}</span>
                  </th>
                  {CAP_ORDER.map((key, ci) => {
                    const active = ci === sel;
                    return (
                      <th key={key}
                        onClick={() => setSel(ci)}
                        className={`cursor-pointer px-4 py-4 text-left align-top transition-colors ${active ? "bg-blue-50" : "hover:bg-gray-50"} ${ci === sel ? "rounded-t-xl border-x-2 border-t-2 border-blue-600" : "border-x border-t border-transparent"}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600"}`}>
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">{CAP_ICON[key]}</svg>
                          </span>
                          <span className="text-base font-bold text-gray-950">{t.caps[key].name}</span>
                        </div>
                        <p className="mt-2 text-xs font-normal leading-relaxed text-gray-500">{t.caps[key].desc}</p>
                        <div className="mt-3 flex items-baseline gap-1">
                          <span className="text-xl font-extrabold text-gray-950">{fmtUSD(capPrices[ci])}</span>
                          <span className="text-[11px] font-normal text-gray-500">{t.perUnit}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {FAMILIES.map((fam, fi) => {
                  const isOpen = !!open[fi];
                  const rowOn = famOn[fi];
                  return (
                    <FamilyRows key={fam} fi={fi} fam={fam} items={byFamily[fi]} isOpen={isOpen} rowOn={rowOn} sel={sel}
                      onToggleOpen={() => setOpen((o) => ({ ...o, [fi]: !o[fi] }))} onToggleFam={() => toggleFam(fi)} />
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="sticky left-0 bg-white px-4 py-4 text-sm text-gray-500">
                    {t.baseNote(fmtUSD(BASE))}
                  </td>
                  {CAP_ORDER.map((key, ci) => {
                    const active = ci === sel;
                    return (
                      <td key={key} className={`px-4 py-4 align-top ${active ? "rounded-b-xl border-x-2 border-b-2 border-blue-600 bg-blue-50" : ""}`}>
                        {active && (
                          <div>
                            <p className="text-[11px] text-gray-400">{activos.toLocaleString("es-CL")} activos</p>
                            <p className="text-2xl font-extrabold tabular-nums text-blue-700">{fmtTotal(selPrice * activos)}<span className="text-xs font-medium text-gray-500">{t.totalMo}</span></p>
                            <a href={`${base}/contacto?intent=cotizar`}
                              className="mt-3 block rounded-lg bg-blue-600 px-4 py-2 text-center text-xs font-semibold text-white transition-colors hover:bg-blue-700">
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
        </>
      )}
    </section>
  );
}

// Fila de familia (colapsable) + sus síntomas.
function FamilyRows({ fi, fam, items, isOpen, rowOn, sel, onToggleOpen, onToggleFam }: {
  fi: number; fam: string; items: typeof SYMPTOMS; isOpen: boolean; rowOn: boolean; sel: number;
  onToggleOpen: () => void; onToggleFam: () => void;
}) {
  const cell = (ci: number) => (
    <td key={ci} className={`border-t border-gray-100 px-3 py-2.5 ${ci === sel ? "border-x-2 border-blue-600 bg-blue-50/60" : ""}`}>
      <Check on={rowOn && ci <= sel} />
    </td>
  );
  return (
    <>
      <tr className={rowOn ? "" : "opacity-50"}>
        <td className="sticky left-0 z-10 border-t border-gray-100 bg-white px-4 py-2.5">
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={rowOn} onChange={onToggleFam} aria-label={fam}
              className="h-4 w-4 shrink-0 accent-blue-600" />
            <button onClick={onToggleOpen} className="flex items-start gap-1.5 text-left">
              <span className="mt-0.5"><Chevron open={isOpen} /></span>
              <span className="text-sm font-semibold text-gray-950">
                {fam} <span className="font-normal text-gray-400">· {items.length}</span>
              </span>
            </button>
          </div>
        </td>
        {[0, 1, 2].map(cell)}
      </tr>
      {isOpen && items.map((s) => (
        <tr key={s.id} className={rowOn ? "" : "opacity-50"}>
          <td className="sticky left-0 z-10 border-t border-gray-100 bg-white py-2 pl-12 pr-4">
            <span className="text-sm text-gray-600">{s.name}</span>
          </td>
          {[0, 1, 2].map((ci) => (
            <td key={ci} className={`border-t border-gray-100 px-3 py-2 ${ci === sel ? "border-x-2 border-blue-600 bg-blue-50/60" : ""}`}>
              <Check on={rowOn && ci <= sel} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
