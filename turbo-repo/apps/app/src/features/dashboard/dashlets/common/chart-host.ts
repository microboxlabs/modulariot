import type { ChartOptionHost } from "@microboxlabs/miot-dashboard-ui/charts";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import { evaluateColorRulesGeneric } from "./color-rule-evaluation";
import {
  normalizeChartColorRulesConfig,
  type ChartColorRulesConfig,
} from "../chart/value-color-rules";

/** Date labels and value colors for the portable chart builders. */
export function dashboardChartHost(
  valueColorRules: ChartColorRulesConfig | undefined
): ChartOptionHost {
  const rules = normalizeChartColorRulesConfig(valueColorRules).rules;
  return {
    formatDateLabel: (value) =>
      formatDateString(value, "date", "es-CL", "America/Santiago", value),
    colorForValue: (value) => {
      const color = evaluateColorRulesGeneric(rules, String(value), [
        "item" as const,
      ]).item;
      return color ? `#${color}` : undefined;
    },
  };
}
