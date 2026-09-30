"use client";

export interface CircularStatProps {
  title: string;
  value: number;
  max: number;
  /** Host-formatted value, preserving locale and template output. */
  valueLabel: string;
  unit: string;
  /** Complete localized footer, for example “of 100 GB”. */
  totalLabel: string;
  /** Hexadecimal RGB/RGBA without #. */
  ringColor?: string;
}

/** Presentation only; data binding and threshold rules belong to the host. */
export function CircularStat({
  title,
  value,
  max,
  valueLabel,
  unit,
  totalLabel,
  ringColor = "3b82f6",
}: Readonly<CircularStatProps>) {
  const count = Number.isFinite(value) ? value : 0;
  const total = Number.isFinite(max) ? max : 0;
  const progress =
    total > 0 ? Math.min(100, Math.max(0, (count / total) * 100)) : 0;
  const circumference = 92 * Math.PI;
  const color = /^(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(ringColor)
    ? `#${ringColor}`
    : "#3b82f6";
  return (
    <div className="miot-circular-stat">
      <p className="miot-circular-stat__title">{title}</p>
      <div
        className="miot-circular-stat__gauge"
        role="progressbar"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-valuetext={`${valueLabel} ${unit}; ${totalLabel}`}
      >
        <svg width={100} height={100} viewBox="0 0 100 100" aria-hidden="true">
          <circle
            className="miot-circular-stat__track"
            cx={50}
            cy={50}
            r={46}
            fill="none"
            strokeWidth={8}
          />
          <circle
            className="miot-circular-stat__ring"
            cx={50}
            cy={50}
            r={46}
            fill="none"
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress / 100)}
            stroke={color}
          />
        </svg>
        <div className="miot-circular-stat__value">
          <strong>{valueLabel}</strong>
          <span>{unit}</span>
        </div>
      </div>
      <p className="miot-circular-stat__total">{totalLabel}</p>
    </div>
  );
}
