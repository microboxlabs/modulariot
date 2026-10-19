"use client";

import { ExpandableStat } from "@microboxlabs/miot-dashboard-ui/react";
import "@microboxlabs/miot-dashboard-ui/styles.css";
import { tr } from "@/features/i18n/tr.service";
import { useOptionalDashboard } from "../../context/dashboard-context";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import { type PgrestDashletFields } from "../common/use-dashlet-pgrest";
import { useDashletPgrest } from "../common/use-dashlet-pgrest";
import { DashletLoading, DashletError } from "../common/dashlet-states";
import { evaluateColorRulesGeneric } from "../common/color-rule-evaluation";
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
  unit: string;
  details: { label: string; value: string }[];
  /** Custom color for the value text (hex without #) */
  valueColor?: string;
  /** Color rules for value-based styling */
  valueColorRules?: ValueColorRulesConfig;
}

export const defaultConfig: DashletConfig = {
  title: "Conversion Rate",
  value: "3.24",
  unit: "%",
  details: [
    { label: "Visitors", value: "12,847" },
    { label: "Conversions", value: "416" },
    { label: "Avg. Time", value: "2m 34s" },
    { label: "Bounce Rate", value: "42%" },
  ],
};

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 3,
  minH: 4,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

const FIELD_DEFAULTS: Record<string, string> = {
  title: "Conversion Rate",
  value: "3.24",
  unit: "%",
};

// ============================================================================
// Color Rules Helpers
// ============================================================================

const TARGET_KEYS = ["text", "bg"] as const;
type TargetKey = (typeof TARGET_KEYS)[number];

function evaluateColorRules(
  rules: ValueColorRule[],
  evalValue: string
): { textColor: string | undefined; bgColor: string | undefined } {
  const colors = evaluateColorRulesGeneric<TargetKey, ValueColorRule>(
    rules,
    evalValue,
    [...TARGET_KEYS]
  );
  return {
    textColor: colors.text,
    bgColor: colors.bg,
  };
}

export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const details = config.details || defaultConfig.details;
  const { dictionary } = useOptionalDashboard();
  const refreshIntervalMs = useEffectiveRefreshInterval(widget.config);

  const { resolved, loading, fetchError } = useDashletPgrest(
    config,
    FIELD_DEFAULTS,
    refreshIntervalMs
  );

  if (loading) return <DashletLoading />;
  if (fetchError) return <DashletError message={fetchError} />;

  const title = resolved.title || "Conversion Rate";
  const unit = resolved.unit ?? "%";
  const valueColor = config.valueColor;
  const parsedValue =
    resolved.value === "" || resolved.value == null
      ? Number.NaN
      : Number(resolved.value);
  const displayValue = Number.isFinite(parsedValue)
    ? parsedValue
    : resolved.value;

  // Evaluate value color rules
  const colorRulesConfig = normalizeValueColorRulesConfig(
    config.valueColorRules
  );

  const { textColor: ruleTextColor, bgColor: ruleBgColor } =
    colorRulesConfig.rules.length > 0
      ? evaluateColorRules(colorRulesConfig.rules, String(displayValue))
      : { textColor: undefined, bgColor: undefined };

  return (
    <ExpandableStat
      resetKey={widget.id}
      title={title}
      value={String(displayValue ?? "")}
      unit={unit}
      details={details}
      valueColor={ruleTextColor ?? valueColor}
      backgroundColor={ruleBgColor}
      showLabel={tr("dashboard.settings.showDetails", dictionary)}
      hideLabel={tr("dashboard.settings.hideDetails", dictionary)}
    />
  );
}
