"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { LiveNumber } from "./Counter";
import { PILARES, FAMILIES, REF_FLOTA, markupPilar, type Pilar } from "./pricing-boxes";

const fmtUSD = (n: number, d = 2) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtN = (n: number) => n.toLocaleString("es-CL");

const key = (pid: string, idx: number) => `${pid}:${idx}`;
const clampFlota = (n: number) => Math.max(1, Math.min(100000, Math.round(n) || 0));

// Íconos DS (Flowbite outline) — sin glifos unicode.
const IconCheck = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.5 8.5l3 3 6-7" />
  </svg>
);
const IconMinus = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true">
    <path d="M3.5 8h9" />
  </svg>
);
const IconChevron = ({ open }: { open: boolean }) => (
  <svg className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 6l4 4 4-4" />
  </svg>
);

// Selección por defecto: todo salvo video; la base (req) siempre va.
function defaultSel(): Record<string, boolean> {
  const o: Record<string, boolean> = {};
  PILARES.forEach((p) => p.items.forEach((_, idx) => (o[key(p.id, idx)] = p.id !== "video")));
  return o;
}

export default function PricingCalculator({ base = "" }: { base?: string }) {
  const t = useTranslations("pricing.calculator");
  const [sel, setSel] = useState<Record<string, boolean>>(defaultSel);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ sintomas: true });
  const [fam, setFam] = useState<number | "all">("all");
  const [flota, setFlota] = useState(500);
  const [editingFlota, setEditingFlota] = useState(false);

  const match = (familia: number) => fam === "all" || familia === fam;

  // La base siempre incluida.
  const selEff = useMemo(() => {
    const s = { ...sel };
    PILARES.forEach((p) => {
      if (p.req) p.items.forEach((_, idx) => (s[key(p.id, idx)] = true));
    });
    return s;
  }, [sel]);

  const calc = useMemo(() => {
    let ingSel = 0,
      nItems = 0,
      nSel = 0,
      ingAll = 0;
    PILARES.forEach((p) => {
      const mk = markupPilar(p.id);
      p.items.forEach((it, idx) => {
        const on = selEff[key(p.id, idx)];
        const ing = it.costoMes * mk;
        if (on) ingAll += ing;
        if (p.req || match(it.familia)) {
          nItems++;
          if (on) {
            ingSel += ing;
            nSel++;
          }
        }
      });
    });
    const precioVeh = ingSel / REF_FLOTA;
    const precioVehAll = ingAll / REF_FLOTA;
    return {
      precioVeh,
      precioVehAll,
      nItems,
      nSel,
      mensual: precioVeh * flota,
      anual: precioVeh * flota * 12,
      mensualAll: precioVehAll * flota,
      filtered: fam !== "all",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selEff, fam, flota]);

  const famCount = useMemo(() => {
    const c: Record<number, number> = {};
    PILARES.forEach((p) => p.items.forEach((it) => (c[it.familia] = (c[it.familia] || 0) + 1)));
    return c;
  }, []);
  const totalCajas = PILARES.reduce((a, p) => a + p.items.length, 0);

  const visibles = PILARES.filter((p) => p.req || p.items.some((it) => match(it.familia)));

  const toggleItem = (pid: string, idx: number, req: boolean) => {
    if (req) return;
    setSel((s) => ({ ...s, [key(pid, idx)]: !s[key(pid, idx)] }));
  };
  const toggleAll = (p: Pilar) => {
    if (p.req) return;
    const vidx = p.items.map((_, idx) => idx).filter((idx) => match(p.items[idx].familia));
    const all = vidx.every((idx) => selEff[key(p.id, idx)]);
    setSel((s) => {
      const n = { ...s };
      vidx.forEach((idx) => (n[key(p.id, idx)] = !all));
      return n;
    });
  };
  const pickFam = (f: number | "all") => {
    setFam(f);
    if (f !== "all") {
      const p = PILARES.find((pp) => pp.items.some((it) => it.familia === f));
      if (p) setExpanded((e) => ({ ...e, [p.id]: true }));
    }
  };

  const famLabel = fam === "all" ? t("allFamilies") : FAMILIES[fam];

  return (
    <section id="precios" className="mx-auto max-w-7xl px-4 mt-6 scroll-mt-16">
      {/* Chips de familia */}
      <label className="block text-sm font-semibold text-ink-2">
        {t("filterLabel")}
      </label>
      <div className="mx-auto mt-2 flex max-w-7xl flex-wrap gap-2">
        <button
          onClick={() => pickFam("all")}
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
            fam === "all" ? "border-ink-1 bg-ink-1 text-page" : "border-hairline bg-surface text-ink-2 hover:border-hairline-strong"
          }`}
        >
          {t("allChip")} <span className={fam === "all" ? "text-page/60" : "text-ink-3"}>{totalCajas}</span>
        </button>
        {FAMILIES.map((fn, fi) =>
          famCount[fi] ? (
            <button
              key={fi}
              onClick={() => pickFam(fi)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                fam === fi ? "border-ink-1 bg-ink-1 text-page" : "border-hairline bg-surface text-ink-2 hover:border-hairline-strong"
              }`}
            >
              {fn} <span className={fam === fi ? "text-page/60" : "text-ink-3"}>{famCount[fi]}</span>
            </button>
          ) : null,
        )}
      </div>

      <div className="mx-auto mt-8 grid max-w-7xl gap-4 lg:grid-cols-5">
        {/* Pilares + cajas */}
        <div className="space-y-4 lg:col-span-3">
          {visibles.map((p) => {
            const locked = p.req;
            const mk = markupPilar(p.id);
            const vitems = locked
              ? p.items.map((it, idx) => ({ it, idx }))
              : p.items.map((it, idx) => ({ it, idx })).filter((o) => match(o.it.familia));
            const selCount = vitems.filter((o) => selEff[key(p.id, o.idx)]).length;
            const allSel = selCount === vitems.length;
            const noneSel = selCount === 0;
            const pilarCosto = p.items.reduce(
              (a, it, idx) => a + ((locked || match(it.familia)) && selEff[key(p.id, idx)] ? it.costoMes : 0),
              0,
            );
            const pv = (pilarCosto * mk) / REF_FLOTA;
            const exp = !!expanded[p.id];
            return (
              <div key={p.id} className={`overflow-hidden rounded-xl border ${noneSel ? "border-hairline" : "border-accent"} bg-surface`}>
                <div className="flex items-center gap-4 p-4">
                  <button
                    onClick={() => toggleAll(p)}
                    disabled={locked}
                    aria-label="Seleccionar todas del pilar"
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-white ${
                      locked
                        ? "cursor-default border-ink-4 bg-ink-4"
                        : allSel
                          ? "border-accent bg-accent"
                          : noneSel
                            ? "border-hairline-strong bg-surface"
                            : "border-accent/60 bg-accent/60"
                    }`}
                  >
                    {locked || allSel ? <IconCheck className="h-4 w-4" /> : noneSel ? null : <IconMinus className="h-4 w-4" />}
                  </button>
                  <button onClick={() => setExpanded((e) => ({ ...e, [p.id]: !exp }))} className="flex-1 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink-1">{p.nombre}</span>
                      {locked && (
                        <span className="rounded-full bg-ink-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-page">
                          {t("baseIncluded")}
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, [p.id]: !exp }))}
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-hairline bg-surface-2 px-2.5 py-1.5 text-xs font-semibold text-ink-2 hover:border-hairline-strong"
                  >
                    {selCount}/{vitems.length} <IconChevron open={exp} />
                  </button>
                </div>
                <button
                  onClick={() => setExpanded((e) => ({ ...e, [p.id]: !exp }))}
                  className="flex w-full items-center justify-between gap-3 border-t border-hairline px-4 py-2 text-left"
                >
                  <p className="text-xs text-ink-3">{p.desc}</p>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="text-base font-semibold tracking-[-0.02em] text-accent">
                      <LiveNumber value={pv} format={fmtUSD} duration={0.4} />
                    </span>
                    <span className="text-[11px] text-ink-3">{t("perAssetMonth")}</span>
                  </div>
                </button>
                <AnimatePresence initial={false}>
                {exp && (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                  <div className="max-h-80 overflow-auto border-t border-hairline bg-surface-2/60">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-wide text-ink-3">
                          <th className="w-8 px-3 py-2"></th>
                          <th className="px-3 py-2 text-left font-semibold">{t("boxLabel")}</th>
                          <th className="px-3 py-2 text-right font-semibold">{t("volMonth")}</th>
                          <th className="px-3 py-2 text-right font-semibold">{t("pricePerAsset")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vitems.map(({ it, idx }) => {
                          const on = selEff[key(p.id, idx)];
                          const ipv = (it.costoMes * mk) / REF_FLOTA;
                          return (
                            <tr
                              key={idx}
                              onClick={() => toggleItem(p.id, idx, locked)}
                              className={`border-t border-hairline ${locked ? "cursor-default" : "cursor-pointer hover:bg-surface"} ${on ? "" : "opacity-40"}`}
                            >
                              <td className="px-3 py-2">
                                <span
                                  className={`flex h-[18px] w-[18px] items-center justify-center rounded border-2 text-white ${
                                    !on ? "border-hairline-strong bg-surface" : locked ? "border-ink-4 bg-ink-4" : "border-accent bg-accent"
                                  }`}
                                >
                                  {on ? <IconCheck className="h-3 w-3" /> : null}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <span className="text-ink-2">{it.label}</span>
                                {it.tecnico && <span className="block font-mono text-[11px] text-ink-3">{it.tecnico}</span>}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-ink-3">
                                {it.volMes == null ? "—" : fmtN(it.volMes)}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold tabular-nums text-accent">{fmtUSD(ipv)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  </motion.div>
                )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Resumen */}
        <div className="lg:col-span-2">
        <div className="sticky top-24 flex flex-col gap-4">
          {/* Tamaño de flota — tarjeta separada, arriba del resumen de precios */}
          <div className="flex flex-col gap-1 border rounded-xl border-gray-200 dark:border-hairline dark:bg-surface p-4">
            <div className="grid grid-cols-[1fr_auto] items-end gap-x-3 gap-y-0.5">
              <label htmlFor="flota" className="text-sm font-semibold leading-tight text-ink-1">
                {t("fleetTitle")}
              </label>
              <div className="text-right leading-tight">
                {editingFlota ? (
                  <input
                    id="flota"
                    type="number"
                    min={1}
                    autoFocus
                    value={flota}
                    onChange={(e) => setFlota(clampFlota(+e.target.value))}
                    onBlur={() => setEditingFlota(false)}
                    onKeyDown={(e) => e.key === "Enter" && setEditingFlota(false)}
                    className="w-20 leading-tight bg-transparent text-right text-lg font-semibold text-ink-1 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingFlota(true)}
                    className="cursor-text leading-tight text-lg font-semibold text-ink-1"
                  >
                    <LiveNumber value={flota} format={(n) => fmtN(Math.round(n))} duration={0.4} />
                  </button>
                )}
              </div>
              <p className="whitespace-nowrap text-xs leading-tight text-ink-3">{t("fleetDesc")}</p>
              <p className="text-right text-xs leading-tight text-ink-3">{t("fleetUnit")}</p>
            </div>
            <div className="flex flex-col">
              <input type="range" min={1} max={5000} step={1} value={Math.min(Math.max(flota, 1), 5000)}
                onChange={(e) => setFlota(+e.target.value)} className="w-full accent-blue-600" />
              <div className="flex justify-between text-xs font-light text-ink-3">
                <span>1</span>
                <span>5.000</span>
              </div>
            </div>

          </div>
          <div className="rounded-xl border border-hairline bg-surface-2 p-4 text-ink-1">
            <p className="text-sm font-semibold text-accent">{famLabel}</p>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-4xl font-semibold tracking-[-0.02em] text-accent">
                <LiveNumber value={calc.precioVeh} format={fmtUSD} duration={0.4} />
              </span>
              <span className="text-base text-ink-3">{t("perAssetMonth")}</span>
            </div>

            <div className="mt-3 pt-2 border-t border-hairline text-sm">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-ink-3">{t("selectedBoxes")}</span>
                  <span className="font-semibold">
                    <LiveNumber value={calc.nSel} format={(n) => String(Math.round(n))} duration={0.3} /> {t("of")}{" "}
                    <LiveNumber value={calc.nItems} format={(n) => String(Math.round(n))} duration={0.3} />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">{t("fleetOfClient")}</span>
                  <span className="font-semibold">
                    <LiveNumber value={flota} format={(n) => `${fmtN(Math.round(n))} ${t("fleetUnit")}`} duration={0.4} />
                  </span>
                </div>
              </div>
              <div className="mt-2 space-y-1 border-t border-hairline pt-2">
                <div className="flex justify-between">
                  <span className="text-ink-3">{t("totalMonthly")}</span>
                  <span className="font-semibold text-accent">
                    <LiveNumber value={calc.mensual} format={(n) => fmtUSD(n, 0)} duration={0.4} />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">{t("totalAnnual")}</span>
                  <span className="font-semibold text-accent">
                    <LiveNumber value={calc.anual} format={(n) => fmtUSD(n, 0)} duration={0.4} />
                  </span>
                </div>
              </div>
              {calc.filtered && (
                <div className="flex justify-between border-t border-hairline pt-3">
                  <span className="text-ink-3">{t("fullPlan")}</span>
                  <span className="font-semibold">
                    <LiveNumber value={calc.precioVehAll} format={fmtUSD} duration={0.4} />{t("perAssetSuffix")} ·{" "}
                    <LiveNumber value={calc.mensualAll} format={(n) => fmtUSD(n, 0)} duration={0.4} />{t("perMonthSuffix")}
                  </span>
                </div>
              )}
            </div>

            <a
              href={`${base}/contacto?intent=cotizar`}
              className="mt-4 block rounded-lg bg-ink-1 px-6 py-3 text-center font-medium text-page transition-colors hover:bg-ink-2"
            >
              {t("scheduleCta")}
            </a>
            <p className="mt-2 text-xs font-light leading-relaxed text-ink-3">
              {t("disclaimer")}
            </p>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}
