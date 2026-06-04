"use client";

import { Fragment } from "react";
import { twMerge } from "tailwind-merge";
import type {
  CalendarItem,
  CalendarItemBadge,
  CalendarItemMetric,
} from "../types/calendar-item";

export interface ItemCardProps {
  item: CalendarItem;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

/** Badge tone → pill Tailwind classes. Mirrors the freight card's flowbite badges. */
const BADGE_TONE: Record<string, string> = {
  gray: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  failure: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  green: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  success: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
};

/** Metric status → text tint. Mirrors the lead-time KPI states. */
const METRIC_STATUS_TEXT: Record<
  NonNullable<CalendarItemMetric["status"]>,
  string
> = {
  success: "text-gray-600 dark:text-gray-400",
  warning: "text-gray-600 dark:text-gray-400",
  error: "text-yellow-400 dark:text-yellow-300",
  unknown: "text-gray-400 dark:text-gray-500",
};

function occupancyFillColor(pct: number): string {
  return pct >= 100 ? "bg-yellow-400 dark:bg-yellow-300" : "bg-gray-400";
}

function BadgePill({ badge }: { badge: CalendarItemBadge }) {
  const Icon = badge.icon;
  return (
    <span
      title={badge.tooltip}
      className={twMerge(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium cursor-help",
        BADGE_TONE[badge.tone ?? "gray"] ?? BADGE_TONE.gray
      )}
    >
      {Icon ? <Icon className="w-3 h-3" /> : null}
      {badge.label}
    </span>
  );
}

function MetricView({ metric }: { metric: CalendarItemMetric }) {
  // Bar mode (e.g. occupancy).
  if (metric.max != null) {
    const pct =
      metric.value == null
        ? 0
        : Math.min(100, (metric.value / metric.max) * 100);
    return (
      <div className="flex items-center gap-1.5 flex-1">
        <span className="text-[10px] text-gray-600 dark:text-gray-300 font-medium shrink-0">
          {metric.label}
        </span>
        <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={twMerge("h-full rounded-full transition-all", occupancyFillColor(pct))}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[10px] text-gray-500 dark:text-gray-400 tabular-nums">
          {metric.value == null ? "—" : `${Math.round(pct)}%`}
        </span>
      </div>
    );
  }
  // Icon + value mode (e.g. lead time).
  const tone = METRIC_STATUS_TEXT[metric.status ?? "unknown"];
  const Icon = metric.icon;
  return (
    <div className="flex items-center gap-1.5">
      {Icon ? <Icon className={twMerge("w-3.5 h-3.5", tone)} /> : null}
      <span className={twMerge("font-medium", tone)}>
        {metric.value == null ? "—" : `${metric.value}${metric.unit ?? ""}`}
      </span>
    </div>
  );
}

/**
 * Default sidebar card for a CalendarItem. Reproduces the freight ServiceEvent
 * look (ID badge + route subtitle, client title, badge row, KPI/occupancy row)
 * but renders purely from the canonical item — no domain knowledge. Hosts can
 * override via CalendarHost.renderItemCard.
 */
export function ItemCard({ item, selected = false, onClick, className }: ItemCardProps) {
  const badges = item.badges ?? [];
  const metrics = item.metrics ?? [];
  return (
    <button
      type="button"
      onClick={onClick}
      className={twMerge(
        "w-full text-left rounded-xl transition-all duration-200 overflow-hidden",
        "border shadow-sm hover:shadow-lg hover:-translate-y-0.5 cursor-pointer",
        selected
          ? "bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-600 ring-2 ring-primary-500/50"
          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600",
        className
      )}
    >
      <div className="p-2 flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-mono font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded shrink-0">
            {item.id}
          </span>
          {item.subtitle ? (
            <span className="text-xs truncate text-gray-600 dark:text-gray-300">
              {item.subtitle}
            </span>
          ) : null}
        </div>

        <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
          {item.title}
        </h4>

        {badges.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1 pointer-events-auto">
            {badges.map((b, i) => (
              <BadgePill key={`${b.label}-${i}`} badge={b} />
            ))}
          </div>
        ) : null}

        {metrics.length > 0 ? (
          <div className="flex items-center gap-2 text-xs">
            {metrics.map((m, i) => (
              <Fragment key={`${m.label}-${i}`}>
                {i > 0 ? (
                  <span className="w-px h-3 bg-gray-200 dark:bg-gray-600" />
                ) : null}
                <MetricView metric={m} />
              </Fragment>
            ))}
          </div>
        ) : null}
      </div>
    </button>
  );
}
