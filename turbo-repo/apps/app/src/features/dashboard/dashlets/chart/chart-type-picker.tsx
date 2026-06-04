"use client";

import { useState, useEffect, useRef } from "react";
import { Label, Button } from "flowbite-react";
import { HiChevronDown } from "react-icons/hi2";
import type { ChartType } from "./dashlet";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

// ============================================================================
// SVG chart type icons
// ============================================================================

function LineIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="3,17 7,10 12,14 17,6 21,9" />
    </svg>
  );
}

function BarIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <rect x="3" y="13" width="4" height="8" rx="1" />
      <rect x="10" y="8" width="4" height="13" rx="1" />
      <rect x="17" y="4" width="4" height="17" rx="1" />
    </svg>
  );
}

function PieIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2a10 10 0 1 0 10 10H12V2z" opacity="0.55" />
      <path d="M12 2v10h10A10 10 0 0 0 12 2z" />
    </svg>
  );
}

function GaugeIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
    >
      <path d="M5 18A8 8 0 0 1 19 18" />
      <line x1="12" y1="18" x2="9" y2="12" />
      <circle cx="12" cy="18" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ScatterIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="5" cy="17" r="2" />
      <circle cx="10" cy="8" r="2" />
      <circle cx="15" cy="14" r="2" />
      <circle cx="20" cy="5" r="2" />
      <circle cx="8" cy="19" r="2" />
      <circle cx="18" cy="16" r="2" />
    </svg>
  );
}

export const CHART_ICON: Record<
  ChartType,
  (p: Readonly<{ className?: string }>) => React.ReactElement
> = {
  line: LineIcon,
  bar: BarIcon,
  pie: PieIcon,
  gauge: GaugeIcon,
  scatter: ScatterIcon,
};

// ============================================================================
// Chart type definitions
// ============================================================================

export const CHART_TYPE_DEFS: {
  value: ChartType;
  labelKey: string;
  descKey: string;
}[] = [
  {
    value: "line",
    labelKey: "dashboard.dashlets.chart.typeLine",
    descKey: "dashboard.dashlets.chart.typeLineDesc",
  },
  {
    value: "bar",
    labelKey: "dashboard.dashlets.chart.typeBar",
    descKey: "dashboard.dashlets.chart.typeBarDesc",
  },
  {
    value: "pie",
    labelKey: "dashboard.dashlets.chart.typePie",
    descKey: "dashboard.dashlets.chart.typePieDesc",
  },
  {
    value: "gauge",
    labelKey: "dashboard.dashlets.chart.typeGauge",
    descKey: "dashboard.dashlets.chart.typeGaugeDesc",
  },
  {
    value: "scatter",
    labelKey: "dashboard.dashlets.chart.typeScatter",
    descKey: "dashboard.dashlets.chart.typeScatterDesc",
  },
];

// ============================================================================
// ChartTypePicker
// ============================================================================

interface ChartTypePickerProps {
  value: ChartType;
  onChange: (t: ChartType) => void;
  dictionary: I18nRecord;
}

export function ChartTypePicker({
  value,
  onChange,
  dictionary,
}: Readonly<ChartTypePickerProps>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeDef = CHART_TYPE_DEFS.find((d) => d.value === value)!;
  const ActiveIcon = CHART_ICON[value];

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  return (
    <div>
      <Label className="mb-1.5 block text-xs font-normal text-gray-500 dark:text-gray-400">
        {tr("dashboard.settings.chartType", dictionary)}
      </Label>
      <div ref={containerRef} className="relative">
        <Button
          type="button"
          color="light"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex justify-between"
        >
          <span className="flex items-center gap-2">
            <ActiveIcon className="h-5 w-5" />
            {trDynamic(activeDef.labelKey, dictionary)}
          </span>
          <HiChevronDown
            className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </Button>

        {open && (
          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
            {CHART_TYPE_DEFS.map((def) => {
              const Icon = CHART_ICON[def.value];
              const isActive = value === def.value;
              return (
                <button
                  key={def.value}
                  type="button"
                  onClick={() => {
                    onChange(def.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${isActive ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
                >
                  <Icon
                    className={`h-7 w-7 shrink-0 ${isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"}`}
                  />
                  <div>
                    <div
                      className={`text-sm font-medium leading-tight ${isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-900 dark:text-white"}`}
                    >
                      {trDynamic(def.labelKey, dictionary)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {trDynamic(def.descKey, dictionary)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
