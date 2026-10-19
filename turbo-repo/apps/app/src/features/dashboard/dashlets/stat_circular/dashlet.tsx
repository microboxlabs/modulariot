"use client";

import { PortableScalarWidget } from "../common/portable-scalar-widget";

import { useMemo } from "react";
import { CircularStat } from "@microboxlabs/miot-dashboard-ui/react";
import "@microboxlabs/miot-dashboard-ui/styles.css";
import { useOptionalDashboard } from "../../context/dashboard-context";
import { tr } from "@/features/i18n/tr.service";
import type {
  DashletComponentProps,
  DashletLayoutDefaults,
  DataProviderEntry,
} from "../types";
import type { PgrestParam, PgrestHttpMethod } from "../common/pgrest-types";
import { resolveHandlebarsField } from "../common/use-handlebars-templates";
import { useHybridPgrestContext } from "../common/use-dashlet-pgrest";
import { useEffectiveRefreshInterval } from "../../hooks/use-effective-refresh-interval";
import { evaluateRule } from "../common/color-rule-engine";
import type { RingColorRulesConfig } from "./value-color-rules";
import { normalizeRingColorRulesConfig } from "./value-color-rules";

// ============================================================================
// Configuration Types
// ============================================================================

export interface DashletConfig {
  title: string;
  value: string;
  maxValue: string;
  unit: string;
  /** Custom bar color (hex without #, e.g. "3b82f6") */
  barColor?: string;
  dataMode: "static" | "pgrest" | "planner";
  pgrestFunctionName: string;
  pgrestParams: PgrestParam[];
  pgrestHttpMethod: PgrestHttpMethod;
  dataSourceId?: string;
  plannerVariableName?: string;
  dataProvider?: DataProviderEntry[];
  /** Default ring color (hex without #) */
  ringColor?: string;
  /** Ring color rules */
  ringColorRules?: RingColorRulesConfig;
}

/** Default bar color (blue-500) */
export const DEFAULT_BAR_COLOR = "3b82f6";

export const defaultConfig: DashletConfig = {
  title: "Storage Used",
  value: "67",
  maxValue: "100",
  unit: "GB",
  barColor: DEFAULT_BAR_COLOR,
  dataMode: "static",
  pgrestFunctionName: "",
  pgrestParams: [],
  pgrestHttpMethod: "POST",
  dataProvider: [],
  ringColor: "3b82f6",
};

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 3,
  minH: 3,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

// ============================================================================
// Component - Style 5: Circular Progress
// ============================================================================

const EMPTY_DATA_PROVIDER: DataProviderEntry[] = [];

/**
 * Circular Progress Card - Donut chart style
 */
export function Dashlet(props: Readonly<DashletComponentProps>) {
  const { hostAccess } = useOptionalDashboard();
  return hostAccess ? <PortableScalarWidget widget={props.widget} /> : <LegacyDashlet {...props} />;
}

function LegacyDashlet({ widget }: Readonly<DashletComponentProps>) {
  const { dictionary } = useOptionalDashboard();
  const config = widget.config as unknown as DashletConfig;
  const { dataProvider = EMPTY_DATA_PROVIDER } = config;

  // Coerce to string for backwards compatibility with old numeric configs
  const title = String(config.title ?? defaultConfig.title);
  const value = String(config.value ?? defaultConfig.value);
  const maxValue = String(config.maxValue ?? defaultConfig.maxValue);
  const unit = String(config.unit ?? defaultConfig.unit);

  // ── Data fetching (supports static, pgrest, and planner) ─────────────────
  const refreshIntervalMs = useEffectiveRefreshInterval(widget.config);
  const { templateContext, loading, fetchError } = useHybridPgrestContext(
    config,
    dataProvider,
    refreshIntervalMs
  );

  // ── Resolve handlebars templates ──────────────────────────────────────────
  const compiledTitle = useMemo(
    () => resolveHandlebarsField(title, templateContext),
    [title, templateContext]
  );
  const compiledValue = useMemo(
    () => resolveHandlebarsField(value, templateContext),
    [value, templateContext]
  );
  const compiledMaxValue = useMemo(
    () => resolveHandlebarsField(maxValue, templateContext),
    [maxValue, templateContext]
  );
  const compiledUnit = useMemo(
    () => resolveHandlebarsField(unit, templateContext),
    [unit, templateContext]
  );

  const numericValue = Number(compiledValue) || 0;
  const numericMaxValue = Number(compiledMaxValue) || 0;

  // Evaluate ring color rules
  const ringColorRulesConfig = normalizeRingColorRulesConfig(
    config.ringColorRules
  );
  let ruleStrokeColor: string | undefined;

  if (ringColorRulesConfig.rules.length > 0) {
    const evalValue = String(numericValue);

    // Sort rules so most specific matches win:
    // - greater_than/greater_than_or_equal: check highest thresholds first
    // - less_than/less_than_or_equal: check lowest thresholds first
    const sortedRules = [...ringColorRulesConfig.rules].sort((a, b) => {
      const aVal = Number(a.value) || 0;
      const bVal = Number(b.value) || 0;
      const isAGreater =
        a.operator === "greater_than" || a.operator === "greater_than_or_equal";
      const isBGreater =
        b.operator === "greater_than" || b.operator === "greater_than_or_equal";
      const isALess =
        a.operator === "less_than" || a.operator === "less_than_or_equal";
      const isBLess =
        b.operator === "less_than" || b.operator === "less_than_or_equal";

      // If both are "greater" type, sort descending (highest first)
      if (isAGreater && isBGreater) return bVal - aVal;
      // If both are "less" type, sort ascending (lowest first)
      if (isALess && isBLess) return aVal - bVal;
      // Mixed operators: keep original order
      return 0;
    });

    for (const rule of sortedRules) {
      if (
        evaluateRule(
          {
            column: "",
            operator: rule.operator,
            value: rule.value,
            color: "blue",
          },
          evalValue
        )
      ) {
        ruleStrokeColor = rule.color;
        break;
      }
    }
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <p className="text-sm text-red-500 dark:text-red-400">
          Error: {fetchError}
        </p>
      </div>
    );
  }

  return (
    <CircularStat
      title={compiledTitle}
      value={numericValue}
      max={numericMaxValue}
      valueLabel={compiledValue}
      unit={compiledUnit}
      totalLabel={`${tr("dashboard.widgetOf", dictionary)} ${compiledMaxValue} ${compiledUnit}`}
      ringColor={ruleStrokeColor ?? config.ringColor ?? "3b82f6"}
    />
  );
}
