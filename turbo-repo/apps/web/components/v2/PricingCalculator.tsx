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
        <p className="mb-3 text-sm font-semibold tracking-widest text-blue-600 uppercase">Arma tu plan</p>
        <h2 className="text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">Precio por caja de procesamiento</h2>
        <p className="mt-5 text-lg text-gray-600">
          Filtra por familia operacional y elige las cajas que necesitas. La base de ingesta GPS siempre va; el
          precio nace del costo real de infraestructura.
        </p>
      </div>

      {/* Chips de familia */}
      <div className="mx-auto mt-10 flex max-w-5xl flex-wrap gap-2">
        <button
          onClick={() => pickFam("all")}
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
            fam === "all" ? "border-gray-950 bg-gray-950 text-white" : "border-gray-200 bg-white text-gray-800 hover:border-gray-300"
          }`}
        >
          Todas <span className={fam === "all" ? "text-blue-300" : "text-gray-400"}>{totalCajas}</span>
        </button>
        {FAMILIES.map((fn, fi) =>
          famCount[fi] ? (
            <button
              key={fi}
              onClick={() => pickFam(fi)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                fam === fi ? "border-gray-950 bg-gray-950 text-white" : "border-gray-200 bg-white text-gray-800 hover:border-gray-300"
              }`}
            >
              {fn} <span className={fam === fi ? "text-blue-300" : "text-gray-400"}>{famCount[fi]}</span>
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
              <div key={p.id} className={`overflow-hidden rounded-xl border ${noneSel ? "border-gray-200" : "border-blue-500"} bg-white`}>
                <div className="flex items-center gap-3 p-4">
                  <button
                    onClick={() => toggleAll(p)}
                    disabled={locked}
                    aria-label="Seleccionar todas del pilar"
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-white ${
                      locked
                        ? "cursor-default border-gray-400 bg-gray-400"
                        : allSel
                          ? "border-blue-600 bg-blue-600"
                          : noneSel
                            ? "border-gray-300 bg-white"
                            : "border-blue-300 bg-blue-300"
                    }`}
                  >
                    {locked || allSel ? <IconCheck className="h-4 w-4" /> : noneSel ? null : <IconMinus className="h-4 w-4" />}
                  </button>
                  <button onClick={() => setExpanded((e) => ({ ...e, [p.id]: !exp }))} className="flex-1 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-gray-950">{p.nombre}</span>
                      {locked && (
                        <span className="rounded-full bg-gray-950 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                          Base · incluido
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-gray-500">{p.desc}</p>
                  </button>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-extrabold text-gray-950">{fmtUSD(pv)}</p>
                    <p className="text-[11px] text-gray-500">/activo · mes</p>
                  </div>
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, [p.id]: !exp }))}
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:border-gray-300"
                  >
                    {selCount}/{vitems.length} <IconChevron open={exp} />
                  </button>
                </div>
                {exp && (
                  <div className="max-h-80 overflow-auto border-t border-gray-100 bg-gray-50/60">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-wide text-gray-400">
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
                              className={`border-t border-gray-100 ${locked ? "cursor-default" : "cursor-pointer hover:bg-white"} ${on ? "" : "opacity-40"}`}
                            >
                              <td className="px-3 py-2">
                                <span
                                  className={`flex h-[18px] w-[18px] items-center justify-center rounded border-2 text-white ${
                                    !on ? "border-gray-300 bg-white" : locked ? "border-gray-400 bg-gray-400" : "border-blue-600 bg-blue-600"
                                  }`}
                                >
                                  {on ? <IconCheck className="h-3 w-3" /> : null}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <span className="text-gray-800">{it.label}</span>
                                {it.tecnico && <span className="block font-mono text-[11px] text-gray-400">{it.tecnico}</span>}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                                {it.volMes == null ? "—" : fmtN(it.volMes)}
                              </td>
                              <td className="px-3 py-2 text-right font-bold tabular-nums text-blue-700">{fmtUSD(ipv)}</td>
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
          <div className="sticky top-24 rounded-xl border border-gray-800 bg-gray-950 p-7 text-white">
            <p className="text-sm text-gray-400">
              Precio por activo · <span className="font-semibold text-blue-300">{famLabel}</span>
            </p>
            <p className="mt-1 text-5xl font-extrabold tracking-tight text-blue-300">{fmtUSD(calc.precioVeh)}</p>
            <p className="text-sm text-gray-400">USD / activo · mes</p>

            <div className="mt-6 space-y-2 border-t border-gray-800 pt-5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Cajas seleccionadas</span>
                <span className="font-semibold">
                  {calc.nSel} de {calc.nItems}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Flota del cliente</span>
                <span className="font-semibold">{fmtN(flota)} activos</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total mensual</span>
                <span className="font-semibold">{fmtUSD(calc.mensual, 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total anual</span>
                <span className="font-semibold">{fmtUSD(calc.anual, 0)}</span>
              </div>
              {calc.filtered && (
                <div className="flex justify-between border-t border-gray-800 pt-3">
                  <span className="text-gray-400">Plan completo · todas</span>
                  <span className="font-semibold">
                    {fmtUSD(calc.precioVehAll)}/activo · {fmtUSD(calc.mensualAll, 0)}/mes
                  </span>
                </div>
              )}
            </div>

            <label htmlFor="flota" className="mt-6 block text-xs font-semibold uppercase tracking-wide text-gray-400">
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
            <div className="mt-1 flex items-baseline justify-between text-xs text-gray-500">
              <span>100</span>
              <span className="text-lg font-bold text-white">{fmtN(flota)} activos</span>
              <span>5.000</span>
            </div>

            <a
              href={`${base}/contacto?intent=cotizar`}
              className="mt-6 block rounded-lg bg-blue-600 px-6 py-3 text-center font-bold text-white transition-colors hover:bg-blue-700"
            >
              Agendar diagnóstico gratuito
            </a>
            <p className="mt-4 text-center text-xs leading-relaxed text-gray-500">
              Precios referenciales en USD, basados en costos reales de infraestructura. La propuesta final se
              entrega tras el diagnóstico gratuito.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
