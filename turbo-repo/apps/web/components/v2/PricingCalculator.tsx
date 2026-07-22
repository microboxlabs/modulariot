"use client";

import { useMemo, useState } from "react";
import { PILARES, FAMILIES, REF_FLOTA, markupPilar, type Pilar } from "./pricing-boxes";

const fmtUSD = (n: number, d = 2) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtN = (n: number) => n.toLocaleString("es-CL");

const key = (pid: string, idx: number) => `${pid}:${idx}`;

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
  const [sel, setSel] = useState<Record<string, boolean>>(defaultSel);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ sintomas: true });
  const [fam, setFam] = useState<number | "all">("all");
  const [flota, setFlota] = useState(500);

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

  const famLabel = fam === "all" ? "Todas las familias" : FAMILIES[fam];

  return (
    <section id="precios" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24 scroll-mt-16">
      <div className="mx-auto max-w-3xl text-center">
        <p className="mb-3 text-sm font-semibold tracking-widest text-accent uppercase">Arma tu plan</p>
        <h2 className="text-3xl font-semibold tracking-[-0.02em] text-ink-1 sm:text-4xl">Precio por caja de procesamiento</h2>
        <p className="mt-5 text-lg text-ink-2">
          Filtra por familia operacional y elige las cajas que necesitas. La base de ingesta GPS siempre va; el
          precio nace del costo real de infraestructura.
        </p>
      </div>

      {/* Chips de familia */}
      <div className="mx-auto mt-10 flex max-w-5xl flex-wrap gap-2">
        <button
          onClick={() => pickFam("all")}
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
            fam === "all" ? "border-ink-1 bg-ink-1 text-page" : "border-hairline bg-surface text-ink-2 hover:border-hairline-strong"
          }`}
        >
          Todas <span className={fam === "all" ? "text-page/60" : "text-ink-3"}>{totalCajas}</span>
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

      <div className="mx-auto mt-8 grid max-w-5xl gap-8 lg:grid-cols-5">
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
                <div className="flex items-center gap-3 p-4">
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
                          Base · incluido
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-ink-3">{p.desc}</p>
                  </button>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-semibold tracking-[-0.02em] text-ink-1">{fmtUSD(pv)}</p>
                    <p className="text-[11px] text-ink-3">/activo · mes</p>
                  </div>
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, [p.id]: !exp }))}
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-hairline bg-surface-2 px-2.5 py-1.5 text-xs font-semibold text-ink-2 hover:border-hairline-strong"
                  >
                    {selCount}/{vitems.length} <IconChevron open={exp} />
                  </button>
                </div>
                {exp && (
                  <div className="max-h-80 overflow-auto border-t border-hairline bg-surface-2/60">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-wide text-ink-3">
                          <th className="w-8 px-3 py-2"></th>
                          <th className="px-3 py-2 text-left font-semibold">Caja interna</th>
                          <th className="px-3 py-2 text-right font-semibold">Vol/mes</th>
                          <th className="px-3 py-2 text-right font-semibold">$/activo</th>
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
                )}
              </div>
            );
          })}
        </div>

        {/* Resumen */}
        <div className="lg:col-span-2">
          <div className="sticky top-24 rounded-xl border border-ink-1 bg-ink-1 p-7 text-page dark:border-hairline dark:bg-surface">
            <p className="text-sm text-page/60 dark:text-ink-3">
              Precio por activo · <span className="font-semibold text-blue-300">{famLabel}</span>
            </p>
            <p className="mt-1 text-5xl font-semibold tracking-[-0.02em] text-blue-300">{fmtUSD(calc.precioVeh)}</p>
            <p className="text-sm text-page/60 dark:text-ink-3">USD / activo · mes</p>

            <div className="mt-6 space-y-2 border-t border-white/15 pt-5 dark:border-hairline text-sm">
              <div className="flex justify-between">
                <span className="text-page/60 dark:text-ink-3">Cajas seleccionadas</span>
                <span className="font-semibold">
                  {calc.nSel} de {calc.nItems}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-page/60 dark:text-ink-3">Flota del cliente</span>
                <span className="font-semibold">{fmtN(flota)} activos</span>
              </div>
              <div className="flex justify-between">
                <span className="text-page/60 dark:text-ink-3">Total mensual</span>
                <span className="font-semibold">{fmtUSD(calc.mensual, 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-page/60 dark:text-ink-3">Total anual</span>
                <span className="font-semibold">{fmtUSD(calc.anual, 0)}</span>
              </div>
              {calc.filtered && (
                <div className="flex justify-between border-t border-white/15 pt-3 dark:border-hairline">
                  <span className="text-page/60 dark:text-ink-3">Plan completo · todas</span>
                  <span className="font-semibold">
                    {fmtUSD(calc.precioVehAll)}/activo · {fmtUSD(calc.mensualAll, 0)}/mes
                  </span>
                </div>
              )}
            </div>

            <label htmlFor="flota" className="mt-6 block text-xs font-semibold uppercase tracking-wide text-page/60 dark:text-ink-3">
              Tamaño de flota del cliente
            </label>
            <input
              id="flota"
              type="range"
              min={100}
              max={5000}
              step={50}
              value={flota}
              onChange={(e) => setFlota(Number(e.target.value))}
              className="mt-3 w-full accent-blue-600"
            />
            <div className="mt-1 flex items-baseline justify-between text-xs text-page/60 dark:text-ink-3">
              <span>100</span>
              <span className="text-lg font-semibold text-page dark:text-ink-1">{fmtN(flota)} activos</span>
              <span>5.000</span>
            </div>

            <a
              href={`${base}/contacto?intent=cotizar`}
              className="mt-6 block rounded-lg bg-white px-6 py-3 text-center font-medium text-gray-950 transition-colors hover:bg-gray-100"
            >
              Agendar diagnóstico gratuito
            </a>
            <p className="mt-4 text-center text-xs leading-relaxed text-page/60 dark:text-ink-3">
              Precios referenciales en USD, basados en costos reales de infraestructura. La propuesta final se
              entrega tras el diagnóstico gratuito.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
