"use client";

import { SensitiveStat } from "@microboxlabs/miot-dashboard-ui/react";
import "@microboxlabs/miot-dashboard-ui/styles.css";
import { tr } from "@/features/i18n/tr.service";
import { useOptionalDashboard } from "../../context/dashboard-context";
import { HiEye, HiEyeSlash } from "react-icons/hi2";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import { useThresholdDashletData } from "../common/use-threshold-dashlet-data";
import { type PgrestDashletFields } from "../common/use-dashlet-pgrest";
import { DashletLoading, DashletError } from "../common/dashlet-states";
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
  isSensitive: boolean;
  thresholds?: ThresholdConfig;
}

export const defaultConfig: DashletConfig = {
  title: "Account Balance",
  value: "125847.32",
  unit: "$",
  isSensitive: true,
};

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 3,
  minH: 2,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

const FIELD_DEFAULTS: Record<string, string> = {
  title: "Account Balance",
  value: "125847.32",
  unit: "$",
};

function getValueTextClasses(
  thresholdColor: string | null,
  appliesTo: (
    target: import("../common/threshold-types").ThresholdTarget
  ) => boolean
): string {
  if (thresholdColor && appliesTo("text"))
    return getThresholdTextClasses(thresholdColor);
  return "text-gray-900 dark:text-white";
}

// ============================================================================
// Component - Style 10: Sensitive Data (Hidden by default)
// ============================================================================

/**
 * Sensitive Data Card - Value hidden until user clicks to reveal
 */
export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const isSensitive = config.isSensitive ?? true;
  const { dictionary } = useOptionalDashboard();
  const { resolved, loading, fetchError, thresholdColor, appliesTo } =
    useThresholdDashletData(widget.config, config, FIELD_DEFAULTS);

  if (loading) return <DashletLoading />;
  if (fetchError) return <DashletError message={fetchError} />;

  const title = resolved.title || "Account Balance";
  const unit = resolved.unit ?? "$";
  const parsedValue =
    resolved.value === "" || resolved.value == null
      ? Number.NaN
      : Number(resolved.value);
  const formattedValue = Number.isFinite(parsedValue)
    ? `${unit}${parsedValue.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : `${unit}${resolved.value}`;

  return (
    <SensitiveStat
      resetKey={widget.id}
      title={title}
      value={formattedValue}
      sensitive={isSensitive}
      showLabel={tr("dashboard.settings.showSensitiveValue", dictionary)}
      hideLabel={tr("dashboard.settings.hideSensitiveValue", dictionary)}
      hint={tr("dashboard.settings.revealSensitiveValue", dictionary)}
      showIcon={<HiEye />}
      hideIcon={<HiEyeSlash />}
      valueClassName={getValueTextClasses(thresholdColor, appliesTo)}
      valueStyle={
        thresholdColor && appliesTo("text")
          ? getThresholdTextStyle(thresholdColor)
          : undefined
      }
    />
  );
}
