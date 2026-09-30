"use client";
import type { CSSProperties } from "react";

export interface DetailedStatProps {
  readonly title: string;
  readonly value: string;
  readonly description: string;
  readonly previousValue: string;
  readonly target: string;
  readonly changeLabel: string;
  readonly positive: boolean;
  readonly progress: number;
  readonly progressLabel: string;
  readonly progressSummary: string;
  readonly previousLabel: string;
  /** Six-digit RGB without #. Invalid values use theme defaults. */
  readonly valueColor?: string;
  readonly barColor?: string;
  readonly badgeColor?: string;
}
function color(raw: string | undefined) {
  return raw && /^[\da-f]{6}$/i.test(raw) ? `#${raw}` : undefined;
}
/** Resolved, formatted values and host-translated labels; no data fetching. */
export function DetailedStat({
  title,
  value,
  description,
  previousValue,
  target,
  changeLabel,
  positive,
  progress,
  progressLabel,
  progressSummary,
  previousLabel,
  valueColor,
  barColor,
  badgeColor,
}: DetailedStatProps) {
  const percent = Number.isFinite(progress)
    ? Math.max(0, Math.min(100, progress))
    : 0;
  const badge = color(badgeColor);
  return (
    <article className="miot-detailed-stat" aria-label={title || undefined}>
      <header>
        <div>
          <p>{title}</p>
          <strong style={{ color: color(valueColor) }}>{value}</strong>
        </div>
        <span
          className="miot-detailed-stat__change"
          data-positive={positive}
          style={{
            color: badge,
            backgroundColor: badge ? `${badge}26` : undefined,
          }}
        >
          <span aria-hidden="true">{positive ? "↗" : "↘"}</span>
          {changeLabel}
        </span>
      </header>
      <p className="miot-detailed-stat__description">{description}</p>
      <div className="miot-detailed-stat__progress">
        <div>
          <span>{progressLabel}</span>
          <span>{target}</span>
        </div>
        <progress
          aria-label={progressLabel}
          max={100}
          value={percent}
          style={{ "--miot-progress-color": color(barColor) } as CSSProperties}
        />
        <p>{progressSummary}</p>
      </div>
      <dl>
        <dt>{previousLabel}</dt>
        <dd>{previousValue}</dd>
      </dl>
    </article>
  );
}
