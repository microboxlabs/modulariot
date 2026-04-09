"use client";

import { HiShoppingCart } from "react-icons/hi2";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import type { PgrestDashletFields } from "../common";
import {
  useDashletPgrest,
  DashletLoading,
  DashletError,
  parseResolvedNumber,
} from "../common";
import { useEffectiveRefreshInterval } from "../../hooks/use-effective-refresh-interval";
import { useRowThreshold } from "../common/use-threshold";
import { getThresholdTextClasses, getThresholdIconClasses } from "../common/threshold-engine";
import type { ThresholdConfig } from "../common/threshold-types";
import { KpiStat } from "@/features/common/components/kpi-stat";

// ============================================================================
// Configuration Types
// ============================================================================

export interface DashletConfig extends PgrestDashletFields {
  title: string;
  value: string;
  unit: string;
  subtitle: string;
  thresholds?: ThresholdConfig;
}

export const defaultConfig: DashletConfig = {
  title: "Orders",
  value: "156",
  unit: "",
  subtitle: "Last 24 hours",
};

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 3,
  minH: 2,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

const FIELD_DEFAULTS: Record<string, string> = {
  title: "Orders",
  value: "156",
  unit: "",
  subtitle: "Last 24 hours",
};

// ============================================================================
// Component - Style 4: Icon Accent
// ============================================================================

/**
 * Icon Accent Card - Large icon with accent color
 */
export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const refreshIntervalMs = useEffectiveRefreshInterval(widget.config);

  const { resolved, loading, fetchError, firstRow } = useDashletPgrest(
    config,
    FIELD_DEFAULTS, refreshIntervalMs
  );

  const { color: thresholdColor, appliesTo } = useRowThreshold(config.thresholds, firstRow);

  if (loading) return <DashletLoading />;
  if (fetchError) return <DashletError message={fetchError} />;

  const title = resolved.title || "Orders";
  const unit = resolved.unit ?? "";
  const subtitle = resolved.subtitle || "";
  const value = parseResolvedNumber(resolved.value);

  const iconClassName = thresholdColor && appliesTo("icon")
    ? `${getThresholdIconClasses(thresholdColor).text} ${getThresholdIconClasses(thresholdColor).bg}`
    : undefined;
  const valueClassName = thresholdColor && appliesTo("text")
    ? getThresholdTextClasses(thresholdColor)
    : undefined;

  return (
    <KpiStat
      icon={{ icon: HiShoppingCart, className: iconClassName }}
      title={{ text: title }}
      value={{ text: value, className: valueClassName }}
      unit={unit}
      description={{ text: subtitle }}
      variant="horizontal"
      className="h-full text-2xl"
    />
  );
}
