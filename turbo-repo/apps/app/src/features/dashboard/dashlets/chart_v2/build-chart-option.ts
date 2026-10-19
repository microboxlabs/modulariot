import {
  buildMixedChartOption,
  type MixedChartOptions,
} from "@microboxlabs/miot-dashboard-ui/charts";
import { dashboardChartHost } from "../common/chart-host";
import type { ChartColorRulesConfig } from "../chart/value-color-rules";

export function buildEChartsOption(
  config: MixedChartOptions & { valueColorRules?: ChartColorRulesConfig },
  rows: Record<string, string>[],
  darkMode = false,
  noDataLabel?: string,
  containerWidth = 0
) {
  return buildMixedChartOption(
    config,
    rows,
    darkMode,
    noDataLabel,
    containerWidth,
    dashboardChartHost(config.valueColorRules)
  );
}
