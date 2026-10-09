"use client";

import { DetailedStat } from "@microboxlabs/miot-dashboard-ui/react";
import "@microboxlabs/miot-dashboard-ui/styles.css";
import { tr } from "@/features/i18n/tr.service";
import { useOptionalDashboard } from "../../context/dashboard-context";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import { type PgrestDashletFields } from "../common/use-dashlet-pgrest";
import { useDashletPgrest } from "../common/use-dashlet-pgrest";
import {
  DashletLoading,
  DashletError,
  parseResolvedNumber,
} from "../common/dashlet-states";
import { evaluateColorRulesWithFields } from "../common/color-rule-evaluation";
import { useEffectiveRefreshInterval } from "../../hooks/use-effective-refresh-interval";
import type {
  ValueColorRulesConfig,
  ValueColorRule,
} from "./value-color-rules";
import { normalizeValueColorRulesConfig } from "./value-color-rules";

// ============================================================================
// Configuration Types
// ============================================================================

export interface DashletConfig extends PgrestDashletFields {
  title: string;
  value: string;
  previousValue: string;
  unit: string;
  description: string;
  target: string;
  /** Value-based color rules for text, bar, and badge */
  valueColorRules?: ValueColorRulesConfig;
}

export const defaultConfig: DashletConfig = {
  title: "Monthly Revenue",
  value: "84500",
  previousValue: "72000",
  unit: "$",
  description: "Total monthly revenue across all products",
  target: "100000",
};

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 4,
  minH: 4,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

const FIELD_DEFAULTS: Record<string, string> = {
  title: "Monthly Revenue",
  value: "84500",
  previousValue: "72000",
  unit: "$",
  description: "Total monthly revenue across all products",
  target: "100000",
};

// ============================================================================
// Color Rules Helpers
// ============================================================================

const TARGET_KEYS = ["text", "bar", "badge"] as const;
type TargetKey = (typeof TARGET_KEYS)[number];

function evaluateColorRules(
  rules: ValueColorRule[],
  evalValue: string,
  fieldValues: Record<string, number>
): {
  textColor: string | undefined;
  barColor: string | undefined;
  badgeColor: string | undefined;
} {
  const colors = evaluateColorRulesWithFields<TargetKey, ValueColorRule>(
    rules,
    evalValue,
    fieldValues,
    [...TARGET_KEYS]
  );
  return {
    textColor: colors.text,
    barColor: colors.bar,
    badgeColor: colors.badge,
  };
}

// ============================================================================
// Component - Style 2: Full Details Card
// ============================================================================

/**
 * Full Details Card - Shows everything at once
 */
export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const { dictionary } = useOptionalDashboard();
  const refreshIntervalMs = useEffectiveRefreshInterval(widget.config);

  const { resolved, loading, fetchError } = useDashletPgrest(
    config,
    FIELD_DEFAULTS,
    refreshIntervalMs
  );

  if (loading) return <DashletLoading />;
  if (fetchError) return <DashletError message={fetchError} />;

  const title = resolved.title || "Monthly Revenue";
  const unit = resolved.unit ?? "$";
  const description = resolved.description || "";

  const value = parseResolvedNumber(resolved.value);
  const previousValue = parseResolvedNumber(resolved.previousValue);
  const target = parseResolvedNumber(resolved.target);

  const change = value - previousValue;
  const changePercent =
    previousValue === 0
      ? 0
      : Number(((change / previousValue) * 100).toFixed(1));
  const progressPercent =
    target > 0 ? Math.max(0, Math.min(100, (value / target) * 100)) : 0;
  const isPositive = change >= 0;

  // Evaluate value color rules
  const valueColorRulesConfig = normalizeValueColorRulesConfig(
    config.valueColorRules
  );

  // Field values map for field comparison mode
  const fieldValues: Record<string, number> = { previousValue, target };

  const {
    textColor: ruleTextColor,
    barColor: ruleBarColor,
    badgeColor: ruleBadgeColor,
  } = valueColorRulesConfig.rules.length > 0
    ? evaluateColorRules(
        valueColorRulesConfig.rules,
        String(value),
        fieldValues
      )
    : { textColor: undefined, barColor: undefined, badgeColor: undefined };

  return (
    <DetailedStat
      title={title}
      value={`${unit}${value.toLocaleString()}`}
      description={description}
      previousValue={`${unit}${previousValue.toLocaleString()}`}
      target={`${unit}${target.toLocaleString()}`}
      changeLabel={`${isPositive ? "+" : ""}${changePercent}%`}
      positive={isPositive}
      progress={progressPercent}
      progressLabel={tr("dashboard.settings.progressToTarget", dictionary)}
      progressSummary={`${progressPercent.toFixed(0)}% ${tr("dashboard.settings.targetReached", dictionary)}`}
      previousLabel={tr("dashboard.settings.previousPeriod", dictionary)}
      valueColor={ruleTextColor}
      barColor={ruleBarColor}
      badgeColor={ruleBadgeColor}
    />
  );
}
