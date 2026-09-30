"use client";

import type { CSSProperties } from "react";

export interface PercentageValueProps {
  title: string;
  value: number;
  max: number;
  /** Hexadecimal RGB/RGBA color without the leading #. */
  barColor?: string;
}

/** Displays resolved values; query execution and color-rule evaluation stay with the caller. */
export function PercentageValue({
  title,
  value,
  max,
  barColor = "2563eb",
}: Readonly<PercentageValueProps>) {
  const count = Number.isFinite(value) ? value : 0;
  const total = Number.isFinite(max) ? max : 10;
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  const progress = Math.min(100, Math.max(0, percentage));
  const color = /^(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(barColor)
    ? `#${barColor}`
    : "#2563eb";
  const style: CSSProperties & { "--miot-progress-color": string } = {
    "--miot-progress-color": color,
  };
  return (
    <div className="miot-percentage-value" style={style}>
      <div className="miot-percentage-value__header">
        <span className="miot-percentage-value__title">{title}</span>
        <span className="miot-percentage-value__count">
          {count} / {total}{" "}
          <span className="miot-percentage-value__percent">({progress}%)</span>
        </span>
      </div>
      <div className="miot-percentage-value__body">
        <progress className="miot-percentage-value__bar" aria-label={title} max={100} value={progress} />
      </div>
    </div>
  );
}
