"use client";
import { withStableKeys } from "./stable-keys";
export interface StackedStatItem {
  readonly label: string;
  readonly value: number;
  /** RGB hex without #; invalid values use the fallback color. */
  readonly color: string;
}
export interface StackedStatProps {
  readonly title: string;
  readonly items: readonly StackedStatItem[];
  readonly unit?: string;
  readonly showHeader?: boolean;
  readonly chartType?: "bar" | "donut";
  readonly formatValue?: (value: number) => string;
}
function segments(items: readonly StackedStatItem[]) {
  const maximum = items.reduce(
    (max, item) =>
      Number.isFinite(item.value) ? Math.max(max, item.value) : max,
    0,
  );
  const weights = items.map((item) =>
    Number.isFinite(item.value) && item.value > 0 && maximum > 0
      ? item.value / maximum
      : 0,
  );
  const total = weights.reduce((sum, value) => sum + value, 0);
  let offset = 0;
  return items.map((item, index) => {
    const share = total > 0 ? (weights[index]! / total) * 100 : 0;
    const segment = {
      ...item,
      value: Number.isFinite(item.value) ? item.value : 0,
      share,
      offset,
      color: /^[\da-f]{6}$/i.test(item.color) ? `#${item.color}` : "#9ca3af",
    };
    offset += share;
    return segment;
  });
}
/** Lightweight SVG distribution chart with a text legend and native tooltips. */
export function StackedStat({
  title,
  items,
  unit = "",
  showHeader = true,
  chartType = "bar",
  formatValue = String,
}: StackedStatProps) {
  const values = segments(items);
  const donut = chartType === "donut";
  return (
    <article
      className="miot-stacked-stat"
      aria-label={title || undefined}
      data-chart-type={chartType}
    >
      {showHeader && <p className="miot-stacked-stat__title">{title}</p>}
      <svg
        className="miot-stacked-stat__chart"
        viewBox={donut ? "0 0 100 100" : "0 0 100 20"}
        preserveAspectRatio={donut ? "xMidYMid meet" : "none"}
        role="img"
        aria-label={title}
      >
        {donut ? (
          <circle
            cx="50"
            cy="50"
            r="36"
            fill="none"
            stroke="var(--miot-chart-empty,#e5e7eb)"
            strokeWidth="16"
          />
        ) : (
          <rect
            width="100"
            height="20"
            fill="var(--miot-chart-empty,#e5e7eb)"
          />
        )}
        {withStableKeys(values, (entry) => entry.label).map(({ item, key }) => {
          if (!item.share) return null;
          const label = `${item.label}: ${formatValue(item.value)}${unit} (${item.share.toFixed(1)}%)`;
          return donut ? (
            <circle
              key={key}
              cx="50"
              cy="50"
              r="36"
              fill="none"
              stroke={item.color}
              strokeWidth="16"
              pathLength="100"
              strokeDasharray={`${item.share} ${100 - item.share}`}
              strokeDashoffset={-item.offset}
              transform="rotate(-90 50 50)"
            >
              <title>{label}</title>
            </circle>
          ) : (
            <rect
              key={key}
              x={item.offset}
              width={item.share}
              height="20"
              fill={item.color}
            >
              <title>{label}</title>
            </rect>
          );
        })}
      </svg>
      <ul className="miot-stacked-stat__legend">
        {withStableKeys(values, (entry) => entry.label).map(({ item, key }) => (
          <li key={key}>
            <span aria-hidden="true" style={{ backgroundColor: item.color }} />
            <span>{item.label}</span>
            <strong>
              {formatValue(item.value)}
              {unit}
            </strong>
          </li>
        ))}
      </ul>
    </article>
  );
}
