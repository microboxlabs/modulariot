"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";

// Separa un valor tipo "1.900+", "+28", "65%", "48hr", "2.9M+" o "99.9%" en
// prefijo / número / sufijo para poder animar solo la parte numérica y
// reconstruir el string original. Un separador con 1-2 dígitos detrás
// ("2.9", "99.9") es decimal; con 3 ("55.847", "1.900") es de miles.
function parseValue(raw: string) {
  const m = raw.match(/^([^\d]*)([\d.,]+)([^\d]*)$/);
  if (!m) return { prefix: "", target: 0, decimals: 0, suffix: raw, grouped: false };
  const [, prefix, digits, suffix] = m;
  const decimalMatch = digits.match(/[.,](\d{1,2})$/);
  if (decimalMatch) {
    const decimals = decimalMatch[1].length;
    const intPart = digits.slice(0, digits.length - decimals - 1);
    return { prefix, target: parseFloat(`${intPart}.${decimalMatch[1]}`), decimals, suffix, grouped: false };
  }
  return {
    prefix,
    target: parseInt(digits.replace(/[.,]/g, ""), 10),
    decimals: 0,
    suffix,
    grouped: digits.includes(".") || digits.includes(","),
  };
}

function formatNumber(n: number, decimals: number, grouped: boolean) {
  if (decimals > 0) return n.toFixed(decimals);
  const rounded = Math.round(n);
  return grouped ? new Intl.NumberFormat("de-DE").format(rounded) : String(rounded);
}

// Efecto "contador mecánico": anima de 0 al valor real cuando entra al viewport.
export function Counter({ value, duration = 1.4 }: { value: string; duration?: number }) {
  const { prefix, target, decimals, suffix, grouped } = parseValue(value);
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
      {formatNumber(display, decimals, grouped)}
      {suffix}
    </span>
  );
}
