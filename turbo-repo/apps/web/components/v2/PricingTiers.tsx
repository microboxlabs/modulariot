"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import PricingCalculator from "./PricingCalculator";
import { LiveNumber } from "./Counter";
import { PILARES, REF_FLOTA, markupPilar } from "./pricing-boxes";
import { SYMPTOMS, FAMILIES } from "./torre-data";
import { getTorre } from "./module-i18n";
import { Section, type Tone } from "./sections/shared";

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

// Tooltip del cuadrante: controlado a mano (no flowbite) para que se
// cierre apenas el mouse sale del ícono, sin "zona segura" hacia el propio
// tooltip — solo el ícono dispara el hover, el panel es pointer-events-none.
const QUAD_TIP_CLASSNAME =
  "pointer-events-none fixed z-50 w-80 whitespace-nowrap rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-700 shadow-xl dark:border-gray-700 dark:bg-gray-900 dark:text-white";

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

export default function PricingTiers({ lang = "es", base, kicker, title, tone = "white" }: { lang?: Lang; base: string; kicker?: string; title?: string; tone?: Tone }) {
  const t = useTranslations("pricing.tiers");
  // Síntomas y familias del idioma activo (nombres traducidos para el render).
  const { SYMPTOMS: SYM, FAMILIES: FAMS } = getTorre(lang);
  const [view, setView] = useState<"nivel" | "medida">("nivel");
  const [open, setOpen] = useState<Record<number, boolean>>({});
  // Síntomas deseleccionados (por id). Vacío = todos elegidos.
  const [off, setOff] = useState<Set<string>>(() => new Set());
  const [activos, setActivos] = useState<number>(500);
  const [editingActivos, setEditingActivos] = useState(false);
  const clampAssets = (n: number) => Math.max(1, Math.min(100000, Math.round(n) || 0));
  // Tooltip del cuadrante (síntoma × nivel).
  const [tip, setTip] = useState<null | { title: string; level: string; price: string; x: number; y: number }>(null);

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

  // Datos de las 3 columnas para el tooltip del cuadrante.
  const cols = CAP_ORDER.map((k, i) => ({ name: t(`caps.${k}.name`), price: `${fmtUSD(capPrices[i])}${t("perUnit")}`, soon: i > MAX_SEL }));

  return (
    <Section tone={tone} contentClassName="py-12 px-4 sm:px-6">
      {title && (
        <div className="mb-8 ">
          {kicker && <p className="text-sm font-semibold uppercase tracking-widest text-accent">{kicker}</p>}
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.02em] text-ink-1 sm:text-5xl">{title}</h1>
        </div>
      )}
      {/* Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border border-hairline bg-surface p-1">
          {(["nivel", "medida"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`rounded-md px-5 py-2 text-sm font-semibold transition-colors ${view === v ? "bg-ink-1 text-page" : "text-ink-2 hover:text-ink-1"}`}>
              {v === "nivel" ? t("toggleNivel") : t("toggleMedida")}
            </button>
          ))}
        </div>
      </div>

      {view === "medida" ? (
        <div className="mt-2"><PricingCalculator base={base} /></div>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-205 table-fixed border-separate border-spacing-x-3 border-spacing-y-0">
              <colgroup>
                <col style={{ width: "34%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "22%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-page" />
                  <th colSpan={3} className="pb-4 text-left font-normal">
                    <div className="flex flex-col gap-1 rounded-xl border border-hairline bg-surface-2 p-4">
                      <div className="grid grid-cols-[1fr_auto] items-end gap-x-3 gap-y-0.5">
                        <label htmlFor="pt-activos" className="text-sm font-semibold leading-tight text-ink-1">
                          {t("assets")}
                        </label>
                        <div className="text-right leading-tight">
                          {editingActivos ? (
                            <input
                              id="pt-activos"
                              type="number"
                              min={1}
                              autoFocus
                              value={activos}
                              onChange={(e) => setActivos(clampAssets(+e.target.value))}
                              onBlur={() => setEditingActivos(false)}
                              onKeyDown={(e) => e.key === "Enter" && setEditingActivos(false)}
                              className="w-20 leading-tight bg-transparent text-right text-lg font-semibold text-ink-1 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingActivos(true)}
                              className="cursor-text leading-tight text-lg font-semibold text-ink-1"
                            >
                              <LiveNumber value={activos} format={(n) => Math.round(n).toLocaleString("es-CL")} duration={0.4} />
                            </button>
                          )}
                        </div>
                        <p className="whitespace-nowrap text-xs leading-tight text-ink-3">{t("assetsDesc")}</p>
                        <p className="text-right text-xs leading-tight text-ink-3">{t("unitAssets")}</p>
                      </div>
                      <div className="flex flex-col">
                        <input type="range" min={1} max={5000} step={1} value={Math.min(Math.max(activos, 1), 5000)}
                          onChange={(e) => setActivos(+e.target.value)} className="w-full accent-blue-600" />
                        <div className="flex justify-between text-xs font-light text-ink-3">
                          <span>1</span>
                          <span>5.000</span>
                        </div>
                      </div>
                    </div>
                  </th>
                </tr>
                <tr>
                  <th className="sticky left-0 z-10 bg-page px-4 py-3 text-left align-bottom">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-3">{t("colSintomas")}</span>
                  </th>
                  {CAP_ORDER.map((key, ci) => {
                    const soon = ci > MAX_SEL; // Automatización aún no disponible
                    return (
                      <th key={key}
                        className={`rounded-t-xl border-x border-t border-hairline bg-surface px-4 py-4 text-left align-top ${soon ? "opacity-45" : ""}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">{CAP_ICON[key]}</svg>
                          </span>
                          <span className="text-base font-semibold text-ink-1">{t(`caps.${key}.name`)}</span>
                        </div>
                        <p className="mt-2 text-xs font-normal leading-relaxed text-ink-3">{t(`caps.${key}.desc`)}</p>
                        {soon ? (
                          <span className="mt-3 inline-block rounded-full bg-surface-3 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t("soon")}</span>
                        ) : (
                          <div className="mt-3 flex items-baseline gap-1">
                            <span className="text-xl font-semibold tracking-[-0.02em] text-ink-1">
                              <LiveNumber value={capPrices[ci]} format={fmtUSD} />
                            </span>
                            <span className="text-[11px] font-normal text-ink-3">{t("perUnitHeader")}</span>
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
                    <FamilyRows key={fam} fi={fi} fam={fam} items={byFamily[fi]} isOpen={isOpen}
                      famAll={fs.all} famNone={fs.none} isOn={isOn} cols={cols} perUnit={t("perUnit")} soonLabel={t("soon")} onTip={setTip}
                      onToggleOpen={() => setOpen((o) => ({ ...o, [fi]: !o[fi] }))}
                      onToggleFam={() => toggleFam(fi)} onToggleSym={toggleSym} />
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="sticky left-0 bg-page px-4 py-4 align-bottom">
                    <div className="flex flex-col gap-2 text-xs leading-snug text-ink-3">
                      <p>
                        {t("baseNoteLabel")} <span className="font-semibold text-accent">{t("baseNotePrice", { price: fmtUSD(BASE) })}</span>
                      </p>
                      <p className="border-t border-hairline pt-2">{t("msgNote")}</p>
                    </div>
                  </td>
                  {CAP_ORDER.map((key, ci) => {
                    const soon = ci > MAX_SEL;
                    return (
                      <td key={key} className={`rounded-b-xl border-x border-b border-hairline bg-surface px-4 py-4 align-top ${soon ? "opacity-45" : ""}`}>
                        {soon ? (
                          <p className="text-xs text-ink-3">{t("soon")}</p>
                        ) : (
                          <div>
                            <p className="text-[11px] text-ink-3">
                              <LiveNumber value={activos} format={(n) => `${Math.round(n).toLocaleString("es-CL")} ${t("unitAssets")}`} duration={0.3} />
                            </p>
                            <p className="text-2xl font-semibold tracking-[-0.02em] tabular-nums text-accent">
                              <LiveNumber value={capPrices[ci] * activos} format={fmtTotal} />
                              <span className="text-xs font-medium text-ink-3">{t("totalMo")}</span>
                            </p>
                            <a href={`${base}/contacto?intent=cotizar`}
                              className="mt-3 block rounded-lg border border-ink-1 bg-ink-1 px-4 py-2 text-center text-xs font-medium text-page transition-colors hover:bg-ink-2 hover:border-ink-2">
                              {t("cta")} {t(`caps.${key}.name`)}
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

          {/* Observabilidad de datos — línea base fija; contexto adicional, no bloquea la decisión de compra */}
          <div className="mx-auto mt-8 max-w-3xl rounded-xl border border-hairline bg-surface-2 p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z M12 15a3 3 0 100-6 3 3 0 000 6Z" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-ink-1">{t("obsTitle")}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">{t("obsDesc")}</p>
                <a href={`${base}/proveedores-gps`} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:text-accent-strong">
                  {t("obsLink")}
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h15m0 0l-6-6m6 6l-6 6" /></svg>
                </a>
              </div>
            </div>
          </div>

          {/* Tooltip del cuadrante */}
          {tip && (
            <div
              className={QUAD_TIP_CLASSNAME}
              style={{
                left: Math.min(tip.x + 16, (typeof window !== "undefined" ? window.innerWidth : 1200) - 336),
                top: tip.y + 16,
              }}
            >
              <p className="text-sm font-semibold">{tip.title}</p>
              <div className="mt-1.5 flex items-center justify-between gap-3">
                <span className="rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">{tip.level}</span>
                <span className="text-sm font-semibold text-accent">{tip.price}</span>
              </div>
            </div>
          )}
        </>
      )}
    </Section>
  );
}

type Col = { name: string; price: string; soon: boolean };
type TipData = { title: string; level: string; price: string; x: number; y: number };

// Ícono de la capacidad en la celda (ojo/campana/robot): coloreado si el
// síntoma está incluido, apagado si no. Las 3 capacidades son acumulativas,
// así que un síntoma "on" se ve igual en las 3 columnas — no hay selección.
function QuadIcon({ ci, on }: { ci: number; on: boolean }) {
  if (!on) return <span className="text-hairline">—</span>;
  return (
    <svg className="mx-auto h-[18px] w-[18px] text-accent"
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {CAP_ICON[CAP_ORDER[ci]]}
    </svg>
  );
}

// Fila de familia (colapsable, selección en bloque) + síntomas individuales.
function FamilyRows({ fi, fam, items, isOpen, famAll, famNone, isOn, cols, perUnit, soonLabel, onTip, onToggleOpen, onToggleFam, onToggleSym }: {
  fi: number; fam: string; items: typeof SYMPTOMS; isOpen: boolean;
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
  // Solo el ícono dispara el hover; el tooltip no tiene handlers propios, así
  // que salir hacia él (en vez de hacia el ícono) lo cierra igual.
  const tipHandlers = (title: string, ci: number, isFamily: boolean) => ({
    onMouseEnter: (e: React.MouseEvent) => onTip({ title, level: cols[ci].name, price: aporte(ci, isFamily), x: e.clientX, y: e.clientY }),
    onMouseMove: (e: React.MouseEvent) => onTip({ title, level: cols[ci].name, price: aporte(ci, isFamily), x: e.clientX, y: e.clientY }),
    onMouseLeave: () => onTip(null),
  });
  return (
    <>
      <tr className={famNone ? "opacity-50" : ""}>
        <td className="sticky left-0 z-10 border-t border-hairline bg-page px-4 py-2.5">
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
          <td key={ci} {...tipHandlers(fam, ci, true)}
            className={`cursor-help border-x border-t border-hairline bg-surface px-3 py-2.5 ${ci > MAX_SEL ? "opacity-45" : ""}`}>
            <QuadIcon ci={ci} on={!famNone} />
          </td>
        ))}
      </tr>
      {isOpen && items.map((s) => {
        const on = isOn(s.id);
        return (
          <tr key={s.id} className={on ? "" : "opacity-50"}>
            <td className="sticky left-0 z-10 border-t border-hairline bg-page py-2 pl-8 pr-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={on} onChange={() => onToggleSym(s.id)} aria-label={s.name}
                  className="h-3.5 w-3.5 shrink-0 accent-blue-600" />
                <span className="text-sm text-ink-2">{s.name}</span>
              </label>
            </td>
            {[0, 1, 2].map((ci) => (
              <td key={ci} {...tipHandlers(s.name, ci, false)}
                className={`cursor-help border-x border-t border-hairline bg-surface px-3 py-2 ${ci > MAX_SEL ? "opacity-45" : ""}`}>
                <QuadIcon ci={ci} on={on} />
              </td>
            ))}
          </tr>
        );
      })}
    </>
  );
}
