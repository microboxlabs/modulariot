"use client";
import { useMemo, type CSSProperties } from "react";
export interface SparklineStatProps {
  readonly title: string;
  readonly value: string;
  readonly unit?: string;
  readonly values: readonly number[];
  /** A translated summary exposes the trend as an image; omit for decoration. */
  readonly trendLabel?: string;
  readonly valueClassName?: string;
  readonly valueStyle?: CSSProperties;
}
function paths(values: readonly number[]) {
  let scale = 1;
  for (const value of values)
    if (Number.isFinite(value)) scale = Math.max(scale, Math.abs(value));
  let min = Infinity,
    max = -Infinity;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    min = Math.min(min, value / scale);
    max = Math.max(max, value / scale);
  }
  const range = max - min || 1;
  const lines: string[] = [],
    areas: string[] = [];
  let segment: string[] = [],
    start = 0,
    end = 0;
  const flush = () => {
    if (segment.length > 1) {
      lines.push(`M ${segment.join(" L ")}`);
      areas.push(`M ${start},50 L ${segment.join(" L ")} L ${end},50 Z`);
    }
    segment = [];
  };
  values.forEach((value, index) => {
    if (!Number.isFinite(value)) {
      flush();
      return;
    }
    const x = values.length > 1 ? (index / (values.length - 1)) * 200 : 0;
    const y = 50 - ((value / scale - min) / range) * 50;
    if (segment.length === 0) start = x;
    end = x;
    segment.push(`${x},${y}`);
  });
  flush();
  return { line: lines.join(" "), area: areas.join(" ") };
}
/** A dependency-free mini trend over host-resolved samples and formatted text. */
export function SparklineStat({
  title,
  value,
  unit,
  values,
  trendLabel,
  valueClassName = "",
  valueStyle,
}: SparklineStatProps) {
  const geometry = useMemo(() => paths(values), [values]);
  return (
    <article className="miot-sparkline-stat" aria-label={title || undefined}>
      <svg
        viewBox="0 0 200 50"
        preserveAspectRatio="none"
        role={trendLabel ? "img" : undefined}
        aria-label={trendLabel}
        aria-hidden={trendLabel ? undefined : true}
      >
        <path d={geometry.area} fill="currentColor" opacity=".2" />
        <path
          d={geometry.line}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
      <div>
        <p>{title}</p>
        <strong className={valueClassName} style={valueStyle}>
          {value}
          {unit && <span>{unit}</span>}
        </strong>
      </div>
    </article>
  );
}
