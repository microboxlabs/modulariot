"use client";

import { useMemo } from "react";
import { StackedStat } from "@microboxlabs/miot-dashboard-ui/react";
import "@microboxlabs/miot-dashboard-ui/styles.css";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import { type PgrestDashletFields } from "../common/use-dashlet-pgrest";
import { useDashletPgrest } from "../common/use-dashlet-pgrest";
import { DashletLoading, DashletError } from "../common/dashlet-states";
import { resolveHandlebarsField } from "../common/use-handlebars-templates";
import { useEffectiveRefreshInterval } from "../../hooks/use-effective-refresh-interval";
import type { ThresholdConfig } from "../common/threshold-types";

// ============================================================================
// Configuration Types
// ============================================================================

/** Hex color without # prefix */
// export type BarColor = string;

export type ChartType = "bar" | "donut";

export interface DashletConfig extends PgrestDashletFields {
  title: string;
  items: { label: string; value: string; color: string }[];
  unit: string;
  showHeader: boolean;
  chartType?: ChartType;
  thresholds?: ThresholdConfig;
}

export const defaultConfig: DashletConfig = {
  title: "Traffic Sources",
  items: [
    { label: "Direct", value: "45", color: "3b82f6" },
    { label: "Organic", value: "30", color: "22c55e" },
    { label: "Referral", value: "15", color: "eab308" },
    { label: "Social", value: "10", color: "a855f7" },
  ],
  unit: "%",
  showHeader: true,
  chartType: "bar",
};

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 4,
  minH: 2,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

const FIELD_DEFAULTS: Record<string, string> = {
  title: "Traffic Sources",
  unit: "%",
};

export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const {
    items = defaultConfig.items,
    showHeader = true,
    chartType = "bar",
  } = config;
  const refreshIntervalMs = useEffectiveRefreshInterval(widget.config);

  const { resolved, loading, fetchError, firstRow } = useDashletPgrest(
    config,
    FIELD_DEFAULTS,
    refreshIntervalMs
  );

  // Resolve Handlebars templates in item labels and values (only in remote modes)
  const isStatic = !config.dataMode || config.dataMode === "static";
  const resolvedItems = useMemo(() => {
    if (isStatic || !firstRow) {
      return items.map((item) => ({
        label: item.label,
        value: Number(item.value) || 0,
        color: (item.color ?? "").replace(/^#/, ""),
      }));
    }
    const context = { ...firstRow, row: firstRow };
    return items.map((item) => ({
      label: resolveHandlebarsField(item.label, context),
      value: Number(resolveHandlebarsField(String(item.value), context)) || 0,
      color: (item.color ?? "").replace(/^#/, ""),
    }));
  }, [items, firstRow, isStatic]);

  if (loading) return <DashletLoading />;
  if (fetchError) return <DashletError message={fetchError} />;

  const title = resolved.title || "Traffic Sources";
  const unit = resolved.unit ?? "%";
  return (
    <StackedStat
      title={title}
      items={resolvedItems}
      unit={unit}
      showHeader={showHeader}
      chartType={chartType}
    />
  );
}
