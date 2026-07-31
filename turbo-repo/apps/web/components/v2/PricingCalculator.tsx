"use client";

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { LiveNumber } from "./Counter";
import {
  PILARES,
  FAMILIES,
  REF_FLOTA,
  markupPilar,
  type Pilar,
} from "./pricing-boxes";
import { clampAssets } from "./pricing-utils";

const fmtUSD = (n: number, d = 2) =>
  "$" +
  n.toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
const fmtN = (n: number) => n.toLocaleString("es-CL");

const key = (pid: string, idx: number) => `${pid}:${idx}`;

// Íconos DS (Flowbite outline) — sin glifos unicode.
const IconCheck = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3.5 8.5l3 3 6-7" />
  </svg>
);
const IconMinus = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M3.5 8h9" />
  </svg>
);
const IconChevron = ({ open }: { open: boolean }) => (
  <svg
    className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 6l4 4 4-4" />
  </svg>
);

type PilarCardLabels = {
  baseIncluded: string;
  perAssetMonth: string;
  boxLabel: string;
  volMonth: string;
  pricePerAsset: string;
};

function PilarCard({
  pilar,
  expanded,
  labels,
  match,
  selEff,
  onToggleAll,
  onToggleItem,
  onToggleExpanded,
}: {
  pilar: Pilar;
  expanded: boolean;
  labels: PilarCardLabels;
  match: (familia: number) => boolean;
  selEff: Record<string, boolean>;
  onToggleAll: (pilar: Pilar) => void;
  onToggleItem: (pid: string, idx: number, req: boolean) => void;
  onToggleExpanded: (id: string) => void;
}) {
  const locked = pilar.req;
  const mk = markupPilar(pilar.id);
  const vitems = locked
    ? pilar.items.map((it, idx) => ({ it, idx }))
    : pilar.items
        .map((it, idx) => ({ it, idx }))
        .filter((o) => match(o.it.familia));
  const selCount = vitems.filter((o) => selEff[key(pilar.id, o.idx)]).length;
  const allSel = selCount === vitems.length;
  const noneSel = selCount === 0;
  const pilarCosto = pilar.items.reduce(
    (a, it, idx) =>
      a +
      ((locked || match(it.familia)) && selEff[key(pilar.id, idx)]
        ? it.costoMes
        : 0),
    0,
  );
  const pv = (pilarCosto * mk) / REF_FLOTA;

  return (
    <div
      className={`overflow-hidden rounded-xl border ${noneSel ? "border-hairline" : "border-accent"} bg-surface`}
    >
      <div className="flex items-center gap-4 p-4">
        <button
          onClick={() => onToggleAll(pilar)}
          disabled={locked}
          aria-label="Seleccionar todas del pilar"
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-white ${
            locked
              ? "border-ink-4 bg-ink-4 cursor-default"
              : allSel
                ? "border-accent bg-accent"
                : noneSel
                  ? "border-hairline-strong bg-surface"
                  : "border-accent/60 bg-accent/60"
          }`}
        >
          {locked || allSel ? (
            <IconCheck className="h-4 w-4" />
          ) : noneSel ? null : (
            <IconMinus className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={() => onToggleExpanded(pilar.id)}
          className="flex-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ink-1 font-semibold">{pilar.nombre}</span>
            {locked && (
              <span className="bg-ink-1 text-page rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                {labels.baseIncluded}
              </span>
            )}
          </div>
        </button>
        <button
          onClick={() => onToggleExpanded(pilar.id)}
          className="border-hairline bg-surface-2 text-ink-2 hover:border-hairline-strong flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
        >
          {selCount}/{vitems.length} <IconChevron open={expanded} />
        </button>
      </div>
      <button
        onClick={() => onToggleExpanded(pilar.id)}
        className="border-hairline flex w-full items-center justify-between gap-3 border-t px-4 py-2 text-left"
      >
        <p className="text-ink-3 text-xs">{pilar.desc}</p>
        <div className="flex shrink-0 items-center gap-1">
          <span className="text-accent text-base font-semibold tracking-[-0.02em]">
            <LiveNumber value={pv} format={fmtUSD} duration={0.4} />
          </span>
          <span className="text-ink-3 text-[11px]">{labels.perAssetMonth}</span>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-hairline bg-surface-2/60 max-h-80 overflow-auto border-t">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-ink-3 text-[11px] tracking-wide uppercase">
                    <th className="w-8 px-3 py-2"></th>
                    <th className="px-3 py-2 text-left font-semibold">
                      {labels.boxLabel}
                    </th>
                    <th className="px-3 py-2 text-right font-semibold">
                      {labels.volMonth}
                    </th>
                    <th className="px-3 py-2 text-right font-semibold">
                      {labels.pricePerAsset}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vitems.map(({ it, idx }) => {
                    const on = selEff[key(pilar.id, idx)];
                    const ipv = (it.costoMes * mk) / REF_FLOTA;
                    return (
                      <tr
                        key={idx}
                        onClick={() => onToggleItem(pilar.id, idx, locked)}
                        className={`border-hairline border-t ${locked ? "cursor-default" : "hover:bg-surface cursor-pointer"} ${on ? "" : "opacity-40"}`}
                      >
                        <td className="px-3 py-2">
                          <span
                            className={`flex h-[18px] w-[18px] items-center justify-center rounded border-2 text-white ${
                              !on
                                ? "border-hairline-strong bg-surface"
                                : locked
                                  ? "border-ink-4 bg-ink-4"
                                  : "border-accent bg-accent"
                            }`}
                          >
                            {on ? <IconCheck className="h-3 w-3" /> : null}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-ink-2">{it.label}</span>
                          {it.tecnico && (
                            <span className="text-ink-3 block font-mono text-[11px]">
                              {it.tecnico}
                            </span>
                          )}
                        </td>
                        <td className="text-ink-3 px-3 py-2 text-right tabular-nums">
                          {it.volMes == null ? "—" : fmtN(it.volMes)}
                        </td>
                        <td className="text-accent px-3 py-2 text-right font-semibold tabular-nums">
                          {fmtUSD(ipv)}
                        </td>
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
}

// Selección por defecto: todo salvo video; la base (req) siempre va.
function defaultSel(): Record<string, boolean> {
  const o: Record<string, boolean> = {};
  PILARES.forEach((p) =>
    p.items.forEach((_, idx) => (o[key(p.id, idx)] = p.id !== "video")),
  );
  return o;
}

export default function PricingCalculator({ base = "" }: { base?: string }) {
  const t = useTranslations("pricing.calculator");
  const [sel, setSel] = useState<Record<string, boolean>>(defaultSel);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    sintomas: true,
  });
  const [fam, setFam] = useState<number | "all">("all");
  const [flota, setFlota] = useState(500);
  const [editingFlota, setEditingFlota] = useState(false);

  const match = useCallback(
    (familia: number) => fam === "all" || familia === fam,
    [fam],
  );

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
  }, [selEff, match, fam, flota]);

  const famCount = useMemo(() => {
    const c: Record<number, number> = {};
    PILARES.forEach((p) =>
      p.items.forEach((it) => (c[it.familia] = (c[it.familia] || 0) + 1)),
    );
    return c;
  }, []);
  const totalCajas = PILARES.reduce((a, p) => a + p.items.length, 0);

  const visibles = PILARES.filter(
    (p) => p.req || p.items.some((it) => match(it.familia)),
  );

  const toggleItem = useCallback((pid: string, idx: number, req: boolean) => {
    if (req) return;
    setSel((s) => ({ ...s, [key(pid, idx)]: !s[key(pid, idx)] }));
  }, []);
  const toggleAll = useCallback(
    (p: Pilar) => {
      if (p.req) return;
      const vidx = p.items
        .map((_, idx) => idx)
        .filter((idx) => match(p.items[idx].familia));
      const all = vidx.every((idx) => selEff[key(p.id, idx)]);
      setSel((s) => {
        const n = { ...s };
        vidx.forEach((idx) => (n[key(p.id, idx)] = !all));
        return n;
      });
    },
    [match, selEff],
  );
  const togglePilar = useCallback((id: string) => {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  }, []);
  const pickFam = (f: number | "all") => {
    setFam(f);
    if (f !== "all") {
      const p = PILARES.find((pp) => pp.items.some((it) => it.familia === f));
      if (p) setExpanded((e) => ({ ...e, [p.id]: true }));
    }
  };

  const famLabel = fam === "all" ? t("allFamilies") : FAMILIES[fam];

  return (
    <section id="precios" className="mx-auto mt-6 max-w-7xl scroll-mt-16 px-4">
      {/* Chips de familia */}
      <label className="text-ink-2 block text-sm font-semibold">
        {t("filterLabel")}
      </label>
      <div className="mx-auto mt-2 flex max-w-7xl flex-wrap gap-2">
        <button
          onClick={() => pickFam("all")}
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
            fam === "all"
              ? "border-ink-1 bg-ink-1 text-page"
              : "border-hairline bg-surface text-ink-2 hover:border-hairline-strong"
          }`}
        >
          {t("allChip")}{" "}
          <span className={fam === "all" ? "text-page/60" : "text-ink-3"}>
            {totalCajas}
          </span>
        </button>
        {FAMILIES.map((fn, fi) =>
          famCount[fi] ? (
            <button
              key={fi}
              onClick={() => pickFam(fi)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                fam === fi
                  ? "border-ink-1 bg-ink-1 text-page"
                  : "border-hairline bg-surface text-ink-2 hover:border-hairline-strong"
              }`}
            >
              {fn}{" "}
              <span className={fam === fi ? "text-page/60" : "text-ink-3"}>
                {famCount[fi]}
              </span>
            </button>
          ) : null,
        )}
      </div>

      <div className="mx-auto mt-8 grid max-w-7xl gap-4 lg:grid-cols-5">
        {/* Pilares + cajas */}
        <div className="space-y-4 lg:col-span-3">
          {visibles.map((p) => (
            <PilarCard
              key={p.id}
              pilar={p}
              expanded={!!expanded[p.id]}
              labels={{
                baseIncluded: t("baseIncluded"),
                perAssetMonth: t("perAssetMonth"),
                boxLabel: t("boxLabel"),
                volMonth: t("volMonth"),
                pricePerAsset: t("pricePerAsset"),
              }}
              match={match}
              selEff={selEff}
              onToggleAll={toggleAll}
              onToggleItem={toggleItem}
              onToggleExpanded={togglePilar}
            />
          ))}
        </div>

        {/* Resumen */}
        <div className="lg:col-span-2">
          <div className="sticky top-24 flex flex-col gap-4">
            {/* Tamaño de flota — tarjeta separada, arriba del resumen de precios */}
            <div className="border-hairline bg-surface-2 flex flex-col gap-1 rounded-xl border p-4">
              <div className="grid grid-cols-[1fr_auto] items-end gap-x-3 gap-y-0.5">
                <label
                  htmlFor="flota"
                  className="text-ink-1 text-sm leading-tight font-semibold"
                >
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
                      onChange={(e) => setFlota(clampAssets(+e.target.value))}
                      onBlur={() => setEditingFlota(false)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && setEditingFlota(false)
                      }
                      className="text-ink-1 w-20 [appearance:textfield] bg-transparent text-right text-lg leading-tight font-semibold outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingFlota(true)}
                      className="text-ink-1 cursor-text text-lg leading-tight font-semibold"
                    >
                      <LiveNumber
                        value={flota}
                        format={(n) => fmtN(Math.round(n))}
                        duration={0.4}
                      />
                    </button>
                  )}
                </div>
                <p className="text-ink-3 text-xs leading-tight whitespace-nowrap">
                  {t("fleetDesc")}
                </p>
                <p className="text-ink-3 text-right text-xs leading-tight">
                  {t("fleetUnit")}
                </p>
              </div>
              <div className="flex flex-col">
                <input
                  type="range"
                  min={1}
                  max={5000}
                  step={1}
                  value={Math.min(Math.max(flota, 1), 5000)}
                  onChange={(e) => setFlota(+e.target.value)}
                  className="w-full accent-blue-600"
                />
                <div className="text-ink-3 flex justify-between text-xs font-light">
                  <span>1</span>
                  <span>5.000</span>
                </div>
              </div>
            </div>
            <div className="border-hairline bg-surface-2 text-ink-1 rounded-xl border p-4">
              <p className="text-accent text-sm font-semibold">{famLabel}</p>
              <div className="mt-1 flex items-end gap-2">
                <span className="text-accent text-4xl font-semibold tracking-[-0.02em]">
                  <LiveNumber
                    value={calc.precioVeh}
                    format={fmtUSD}
                    duration={0.4}
                  />
                </span>
                <span className="text-ink-3 text-base">
                  {t("perAssetMonth")}
                </span>
              </div>

              <div className="border-hairline mt-3 border-t pt-2 text-sm">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-ink-3">{t("selectedBoxes")}</span>
                    <span className="font-semibold">
                      <LiveNumber
                        value={calc.nSel}
                        format={(n) => String(Math.round(n))}
                        duration={0.3}
                      />{" "}
                      {t("of")}{" "}
                      <LiveNumber
                        value={calc.nItems}
                        format={(n) => String(Math.round(n))}
                        duration={0.3}
                      />
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-3">{t("fleetOfClient")}</span>
                    <span className="font-semibold">
                      <LiveNumber
                        value={flota}
                        format={(n) =>
                          `${fmtN(Math.round(n))} ${t("fleetUnit")}`
                        }
                        duration={0.4}
                      />
                    </span>
                  </div>
                </div>
                <div className="border-hairline mt-2 space-y-1 border-t pt-2">
                  <div className="flex justify-between">
                    <span className="text-ink-3">{t("totalMonthly")}</span>
                    <span className="text-accent font-semibold">
                      <LiveNumber
                        value={calc.mensual}
                        format={(n) => fmtUSD(n, 0)}
                        duration={0.4}
                      />
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-3">{t("totalAnnual")}</span>
                    <span className="text-accent font-semibold">
                      <LiveNumber
                        value={calc.anual}
                        format={(n) => fmtUSD(n, 0)}
                        duration={0.4}
                      />
                    </span>
                  </div>
                </div>
                {calc.filtered && (
                  <div className="border-hairline flex justify-between border-t pt-3">
                    <span className="text-ink-3">{t("fullPlan")}</span>
                    <span className="font-semibold">
                      <LiveNumber
                        value={calc.precioVehAll}
                        format={fmtUSD}
                        duration={0.4}
                      />
                      {t("perAssetSuffix")} ·{" "}
                      <LiveNumber
                        value={calc.mensualAll}
                        format={(n) => fmtUSD(n, 0)}
                        duration={0.4}
                      />
                      {t("perMonthSuffix")}
                    </span>
                  </div>
                )}
              </div>

              <a
                href={`${base}/contacto?intent=cotizar`}
                className="bg-ink-1 text-page hover:bg-ink-2 mt-4 block rounded-lg px-6 py-3 text-center font-medium transition-colors"
              >
                {t("scheduleCta")}
              </a>
              <p className="text-ink-3 mt-2 text-xs leading-relaxed font-light">
                {t("disclaimer")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
