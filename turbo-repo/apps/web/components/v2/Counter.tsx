"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";

// Separa un valor tipo "1.900+", "+28", "65%" o "48hr" en prefijo / número / sufijo
// para poder animar solo la parte numérica y reconstruir el string original.
function parseValue(raw: string) {
  const m = raw.match(/^([^\d]*)([\d.,]+)([^\d]*)$/);
  if (!m) return { prefix: "", target: 0, suffix: raw, digits: "" };
  const [, prefix, digits, suffix] = m;
  return { prefix, target: parseInt(digits.replace(/[.,]/g, ""), 10), suffix, digits };
}

function formatNumber(n: number, useDotSeparator: boolean) {
  const rounded = Math.round(n);
  return useDotSeparator ? new Intl.NumberFormat("de-DE").format(rounded) : String(rounded);
}

// Efecto "contador mecánico": anima de 0 al valor real cuando entra al viewport.
export function Counter({ value, duration = 1.4 }: { value: string; duration?: number }) {
  const { prefix, target, suffix, digits } = parseValue(value);
  const useDotSeparator = digits.includes(".") || digits.includes(",");
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? target : 0);

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, target, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: setDisplay,
    });
    return () => controls.stop();
  }, [inView, reduce, target, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {formatNumber(display, useDotSeparator)}
      {suffix}
    </span>
  );
}
