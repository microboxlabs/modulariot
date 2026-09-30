"use client";

import { SparklineStat } from "@microboxlabs/miot-dashboard-ui/react";
import "@microboxlabs/miot-dashboard-ui/styles.css";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import { type PgrestDashletFields } from "../common/use-dashlet-pgrest";
import { useDashletPgrest } from "../common/use-dashlet-pgrest";
import {
  DashletLoading,
  DashletError,
  parseResolvedNumber,
} from "../common/dashlet-states";
import { useEffectiveRefreshInterval } from "../../hooks/use-effective-refresh-interval";
import { useRowThreshold } from "../common/use-threshold";
import {
  getThresholdTextClasses,
  getThresholdTextStyle,
} from "../common/threshold-engine";
import type { ThresholdConfig } from "../common/threshold-types";

// ============================================================================
// Configuration Types
// ============================================================================

export interface DashletConfig extends PgrestDashletFields {
  title: string;
  value: string;
  unit: string;
  sparkline: number[];
  thresholds?: ThresholdConfig;
}

export const defaultConfig: DashletConfig = {
  title: "Page Views",
  value: "24567",
  unit: "",
  sparkline: [30, 45, 35, 50, 40, 60, 55, 70, 65, 80, 75, 90],
};

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 3,
  minH: 2,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

const FIELD_DEFAULTS: Record<string, string> = {
  title: "Page Views",
  value: "24567",
  unit: "",
};

// ============================================================================
// Component - Style 9: Sparkline
// ============================================================================

/**
 * Sparkline Card - Mini line chart in the background
 */
export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const rawSparkline = config.sparkline;
  const sparkline =
    Array.isArray(rawSparkline) && rawSparkline.length >= 2
      ? rawSparkline
      : defaultConfig.sparkline;
  const refreshIntervalMs = useEffectiveRefreshInterval(widget.config);

  const { resolved, loading, fetchError, firstRow } = useDashletPgrest(
    config,
    FIELD_DEFAULTS,
    refreshIntervalMs
  );

  const { color: thresholdColor, appliesTo } = useRowThreshold(
    config.thresholds,
    firstRow
  );

  if (loading) return <DashletLoading />;
  if (fetchError) return <DashletError message={fetchError} />;

  const title = resolved.title || "Page Views";
  const unit = resolved.unit ?? "";
  const value = parseResolvedNumber(resolved.value);

  const textColor = thresholdColor && appliesTo("text") ? thresholdColor : null;
  return (
    <SparklineStat
      title={title}
      value={value.toLocaleString()}
      unit={unit}
      values={sparkline}
      valueClassName={
        textColor ? getThresholdTextClasses(textColor) : undefined
      }
      valueStyle={textColor ? getThresholdTextStyle(textColor) : undefined}
    />
  );
}
