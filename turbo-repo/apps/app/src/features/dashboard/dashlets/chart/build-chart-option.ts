import {
  buildLegacyChartOption,
  type LegacyChartOptions,
} from "@microboxlabs/miot-dashboard-ui/charts";
import { dashboardChartHost } from "../common/chart-host";
import type { ChartColorRulesConfig } from "./value-color-rules";

export function buildEChartsOption(
  config: LegacyChartOptions & { valueColorRules?: ChartColorRulesConfig },
  rows: Record<string, string>[],
  darkMode = false,
  noDataLabel?: string,
  containerWidth = 0
) {
  return buildLegacyChartOption(
    config,
    rows,
    darkMode,
    noDataLabel,
    containerWidth,
    dashboardChartHost(config.valueColorRules)
  );
}
