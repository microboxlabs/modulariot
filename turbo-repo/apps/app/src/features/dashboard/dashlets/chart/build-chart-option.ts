import { buildLegacyChartOption, type LegacyChartOptions } from "@microboxlabs/miot-dashboard-ui/charts";
import { evaluateColorRulesGeneric } from "../common/color-rule-evaluation";
import { normalizeChartColorRulesConfig, type ChartColorRulesConfig } from "./value-color-rules";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";

export function buildEChartsOption(
  config: LegacyChartOptions & { valueColorRules?: ChartColorRulesConfig },
  rows: Record<string, string>[],
  darkMode = false,
  noDataLabel?: string,
  containerWidth = 0,
) {
  const rules = normalizeChartColorRulesConfig(config.valueColorRules).rules;
  return buildLegacyChartOption(config, rows, darkMode, noDataLabel, containerWidth, {
    formatDateLabel: (value) => formatDateString(value, "date", "es-CL", "America/Santiago", value),
    colorForValue: (value) => {
      const color = evaluateColorRulesGeneric(rules, String(value), ["item" as const]).item;
      return color ? `#${color}` : undefined;
    },
  });
}
