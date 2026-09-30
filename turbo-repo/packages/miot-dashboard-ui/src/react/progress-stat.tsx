"use client";
import type { CSSProperties } from "react";
export interface ProgressStatProps {
  title: string;
  value: number;
  target: number;
  unit: string;
  /** Optional RGB/RGBA hex without #. */
  barColor?: string;
  textColor?: string;
  /** Localized accessible value; receives finite resolved values. */
  formatValue?: (value: number, target: number, unit: string) => string;
}
function hex(value: string | undefined) {
  return value && /^(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)
    ? `#${value}`
    : undefined;
}
/** Resolved, accessible progress with fixed quarter milestones. */
export function ProgressStat({
  title,
  value,
  target,
  unit,
  barColor,
  textColor,
  formatValue,
}: Readonly<ProgressStatProps>) {
  const count = Number.isFinite(value) ? value : 0;
  const total = Number.isFinite(target) ? target : 100;
  const percentage =
    total > 0 ? Math.min(100, Math.max(0, (count / total) * 100)) : 0;
  let defaultColor = "#ef4444";
  if (percentage >= 75) defaultColor = "#22c55e";
  else if (percentage >= 50) defaultColor = "#3b82f6";
  else if (percentage >= 25) defaultColor = "#eab308";
  const style: CSSProperties & { "--miot-progress-color": string } = {
    "--miot-progress-color": hex(barColor) ?? defaultColor,
  };
  return (
    <div className="miot-progress-stat" style={style}>
      <div className="miot-progress-stat__header">
        <p>{title}</p>
        <strong style={{ color: hex(textColor) }}>
          {count}
          <span>{unit}</span>
        </strong>
      </div>
      <div className="miot-progress-stat__gauge">
        <progress
          aria-label={title}
          aria-valuetext={formatValue?.(count, total, unit) ?? `${count} / ${total} ${unit}`}
          max={100}
          value={percentage}
        />
        {[25, 50, 75].map((mark) => (
          <i key={mark} aria-hidden="true" style={{ left: `${mark}%` }} />
        ))}
      </div>
      <div className="miot-progress-stat__labels" aria-hidden="true">
        {[0, 0.25, 0.5, 0.75, 1].map((part) => (
          <span key={part}>
            {part === 1 ? total : Math.round(total * part)}
          </span>
        ))}
      </div>
    </div>
  );
}
