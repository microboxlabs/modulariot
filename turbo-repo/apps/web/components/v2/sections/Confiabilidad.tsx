"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationFrame, useMotionValue, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Reveal } from "../Reveal";
import { Section, SectionHeader, ArrowRight, btnPrimary } from "./shared";

// Diferenciador de precisión (pulsos/min vs estándar 12/20). Gancho para minería.
// 3 barras a la misma escala (GMAX) + un pulso animado fuera de la tarjeta que
// late al ritmo real de cada una; la fila activa dentro de la tarjeta se
// resalta en sync con lo que el pulso está mostrando afuera.
// Paleta (símbolo/acción/accent) validada con dataviz/scripts/validate_palette.js.
type PulseRow = {
  label: string;
  rate: number;
  value: string;
  pct: number;
  dot: string;
  bar: string;
  ring: string;
  caption: string;
};

// El más rápido (Minería) late cada BEAT_FLOOR segundos; los otros dos se
// escalan proporcionalmente — la diferencia de velocidad que se ve es la
// diferencia real entre los tres pulsos/min, no un número inventado.
const BEAT_FLOOR = 1.1;

function PulseVisualizer({ rows, active, pulsesUnit }: { rows: PulseRow[]; active: number; pulsesUnit: string }) {
  const reduce = useReducedMotion();
  const row = rows[active];
  const fastest = Math.max(...rows.map((r) => r.rate));
  const targetInterval = (fastest / row.rate) * BEAT_FLOOR;

  // El anillo y el punto son los mismos nodos siempre (sin key/remount): así el
  // color de Tailwind hace CSS-crossfade solo, y el tempo se relaja hacia el
  // nuevo objetivo cuadro a cuadro en vez de reiniciar el ciclo de golpe.
  const intervalRef = useRef(targetInterval);
  const phaseRef = useRef(0);
  const ringScale = useMotionValue(2.2);
  const ringOpacity = useMotionValue(0.15);
  const dotScale = useMotionValue(1);

  useAnimationFrame((_, delta) => {
    if (reduce) return;
    const dt = delta / 1000;
    intervalRef.current += (targetInterval - intervalRef.current) * Math.min(1, dt * 2.5);
    phaseRef.current = (phaseRef.current + dt / intervalRef.current) % 1;
    const p = phaseRef.current;

    ringScale.set(2.2 - 1.2 * p);
    ringOpacity.set(0.15 + 0.85 * p);
    // El "golpe" del punto sube y baja dentro de [0.85, 1] — termina en 1 justo
    // cuando el anillo también llega a escala 1, así nunca queda un hueco entre
    // los dos mientras se resuelve el ciclo.
    const smooth = (t: number) => t * t * (3 - 2 * t);
    let bump = 0;
    if (p >= 0.85 && p < 0.93) bump = smooth((p - 0.85) / 0.08);
    else if (p >= 0.93) bump = smooth(1 - (p - 0.93) / 0.07);
    dotScale.set(1 + 0.22 * bump);
  });

  return (
    <div className="flex shrink-0 flex-col items-center gap-5">
      <div className="relative flex h-44 w-44 items-center justify-center">
        {/* Bisel giratorio — textura de instrumento de precisión, no ligado al ritmo */}
        <motion.span
          aria-hidden
          className="absolute h-36 w-36 rounded-full border border-dashed border-hairline-strong"
          animate={reduce ? {} : { rotate: 360 }}
          transition={reduce ? { duration: 0 } : { duration: 16, repeat: Infinity, ease: "linear" }}
        />
        {/* Anillo de aproximación: se cierra sobre el punto al ritmo real del pulso */}
        <motion.span
          className={`absolute h-16 w-16 rounded-full border-2 transition-colors duration-700 ${row.ring}`}
          style={reduce ? { scale: 1, opacity: 0.6 } : { scale: ringScale, opacity: ringOpacity }}
        />
        {/* Punto objetivo: recibe el "golpe" justo cuando el anillo llega */}
        <motion.span
          className={`absolute h-16 w-16 rounded-full transition-colors duration-700 ${row.dot}`}
          style={reduce ? { scale: 1 } : { scale: dotScale }}
        />
      </div>
      <div className="h-14 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={row.label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
          >
            <p className="display text-3xl tabular-nums">{row.value.replace("/min", "")}</p>
            <p className="mt-1 flex items-center justify-center gap-2 text-xs font-medium text-ink-3">
              <span className={`h-1.5 w-1.5 rounded-full ${row.dot}`} aria-hidden />
              {row.label} · {pulsesUnit}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// Datos numéricos, colores y valores formateados: no son texto, así que
// quedan en código, alineados por índice con "rows" del namespace
// confiabilidad en los JSON de i18n (label/caption son lo único traducido).
const RATES = [3.96, 12, 20];
const VALUES = ["3.96/min", "12/min", "20/min"];
const DOTS = ["bg-symptom", "bg-action", "bg-accent"];
const RINGS = ["border-symptom", "border-action", "border-accent"];
const GMAX = 24;
const px = (v: number) => (v / GMAX) * 100;

type RowText = { label: string; caption: string };

export function Confiabilidad({ base }: { base: string }) {
  const t = useTranslations("confiabilidad");
  const rowsText = t.raw("rows") as RowText[];
  const rows: PulseRow[] = rowsText.map((r, i) => ({
    label: r.label,
    caption: r.caption,
    rate: RATES[i],
    value: VALUES[i],
    pct: px(RATES[i]),
    dot: DOTS[i],
    bar: DOTS[i],
    ring: RINGS[i],
  }));

  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setActive((i) => (i + 1) % rows.length), 4000);
    return () => clearInterval(timer);
  }, [paused, rows.length]);

  return (
    <Section id="confiabilidad" tone="gray">
      <SectionHeader kicker={t("kicker")} title={t("title")} subtitle={t("subtitle")} />
      <div
        className="mt-12 grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-16"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <Reveal className="rounded-[14px] border border-hairline bg-surface p-8 sm:p-10">
          {/* Comparación: 3 barras a la misma escala; la fila activa se resalta en sync con el pulso de la derecha */}
          <div className="space-y-2">
            {rows.map((r, i) => {
              const isActive = i === active;
              return (
                <div
                  key={r.label}
                  onMouseEnter={() => setActive(i)}
                  className={`-mx-3 cursor-pointer rounded-lg px-3 py-2 transition-opacity duration-500 ${isActive ? "opacity-100" : "opacity-40"}`}
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="flex items-center gap-2 text-sm font-medium text-ink-1">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${r.dot}`} aria-hidden />
                      {r.label}
                    </span>
                    <span className="display text-lg tabular-nums">{r.value}</span>
                  </div>
                  <div className="mt-2 h-2.5 rounded-sm bg-surface-3">
                    <div className={`h-full rounded-r-sm ${r.bar}`} style={{ width: `${r.pct}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-ink-4">{r.caption}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-hairline pt-8">
            <a href={`${base}/proveedores-gps`} className={btnPrimary}>
              {t("cta")} <ArrowRight />
            </a>
            <p className="text-xs text-ink-4">{t("disclaimer")}</p>
          </div>
        </Reveal>

        <PulseVisualizer rows={rows} active={active} pulsesUnit={t("pulsesUnit")} />
      </div>
    </Section>
  );
}
