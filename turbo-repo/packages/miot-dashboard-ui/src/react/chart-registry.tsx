"use client";
import { useCallback, useMemo, useState } from "react";
import { buildLegacyChartOption, buildMixedChartOption } from "../charts";
import {
  filterChartRowsByDateRange,
  type ChartDateRange,
} from "../core/chart-date-range";
import { evaluateColorRulesGeneric } from "../core/color-rule-evaluation";
import { createWidgetRegistry } from "../core/widget-registry";
import { createTemplateContext, createTemplateEngine } from "../templates";
import {
  useOptionalPlannerContext,
  useDashboardFilters,
  ChartCard,
  ChartEngineView,
  type ChartEngine,
  type WidgetComponentProps,
} from "@microboxlabs/miot-dashboard-ui/react";
import { chartWidgetConfig } from "./chart-widget-config";
type Config = ReturnType<typeof chartWidgetConfig.parse>;
type Option = ReturnType<typeof buildLegacyChartOption>;
type Kind = "chart" | "chart_v2";
const ranges: ChartDateRange[] = ["all", "7d", "30d", "90d", "180d", "1y"];
export interface ChartRegistryOptions {
  createEngine: (element: HTMLDivElement) => ChartEngine<Option>;
  defaultTitle: string;
  loadingLabel: string;
  errorLabel: string;
  unsupportedDataLabel: string;
  emptyLabel: string;
  rangeLabels: Record<ChartDateRange, string>;
  formatDateLabel?: (value: string) => string;
  describeChart?: (
    title: string,
    rows: readonly Record<string, string>[],
  ) => string;
  darkMode?: boolean;
  now?: () => number;
  templateEngine?: ReturnType<typeof createTemplateEngine>;
}
/** Read-only chart catalog. Query transport and permissions remain with planner providers. */
export function createChartRegistry(options: Readonly<ChartRegistryOptions>) {
  const engine = options.templateEngine ?? createTemplateEngine();
  function RegisteredChart({ widget }: Readonly<WidgetComponentProps>) {
    const parsed = useMemo(
      () => chartWidgetConfig.safeParse(widget.config),
      [widget.config],
    );
    if (!parsed.success) return <p role="alert">{options.errorLabel}</p>;
    return (
      <BoundChart
        key={`${widget.id}:${widget.componentId}:${parsed.data.dataMode}:${parsed.data.plannerVariableName ?? ""}:${parsed.data.defaultDateRange}`}
        config={parsed.data}
        kind={widget.componentId as Kind}
      />
    );
  }
  function BoundChart({
    config,
    kind,
  }: Readonly<{ config: Config; kind: Kind }>) {
    const { results, definitions } = useOptionalPlannerContext();
    const result =
      config.dataMode === "planner"
        ? results.get(config.plannerVariableName ?? "")
        : undefined;
    if (config.dataMode !== "static" && config.dataMode !== "planner")
      return <p role="alert">{options.unsupportedDataLabel}</p>;
    if (config.dataMode === "planner") {
      if (
        result?.loading ||
        (!result &&
          definitions.some(
            (d) => d.variableName === config.plannerVariableName,
          ))
      )
        return <output>{options.loadingLabel}</output>;
      if (!result || result.error)
        return <p role="alert">{options.errorLabel}</p>;
    }
    return (
      <ReadyChart
        config={config}
        kind={kind}
        rows={result?.rows ?? config.rows}
      />
    );
  }
  function ReadyChart({
    config,
    kind,
    rows,
  }: Readonly<{ config: Config; kind: Kind; rows: Record<string, string>[] }>) {
    const { activeFilters } = useDashboardFilters();
    const [range, setRange] = useState<ChartDateRange>(config.defaultDateRange);
    const [width, setWidth] = useState(0);
    const resize = useCallback((value: number) => setWidth(value), []);
    const dateAxis =
      config.xAxisDateFormat !== "none" &&
      (kind === "chart"
        ? config.chartType === "line"
        : config.chartFamily === "cartesian");
    const filteredRows = useMemo(
      () =>
        dateAxis
          ? filterChartRowsByDateRange(
              rows,
              config.xAxisColumn,
              range,
              options.now?.(),
            )
          : rows,
      [rows, config.xAxisColumn, range, dateAxis],
    );
    const fields = useMemo(
      () => [
        { id: "title", template: config.title || options.defaultTitle },
        { id: "x", template: config.xAxisLabel },
        { id: "y", template: config.yAxisLabel },
        { id: "right", template: config.yAxisLabelRight },
        ...config.series.map((s, i) => ({
          id: `series-${i}`,
          template: s.label,
        })),
        ...config.representations.map((s, i) => ({
          id: `rep-${i}`,
          template: s.label,
        })),
      ],
      [config],
    );
    const compiled = useMemo(() => engine.compileTemplates(fields), [fields]);
    const context = useMemo(
      () =>
        createTemplateContext({
          row: rows[0],
          filters: activeFilters,
          dataProvider: config.dataProvider,
        }),
      [rows, activeFilters, config.dataProvider],
    );
    const resolved = useMemo(
      () =>
        Object.fromEntries(
          fields.map((f) => [
            f.id,
            engine.resolveTemplate(compiled, f.id, context, f.template),
          ]),
        ),
      [fields, compiled, context],
    );
    const title = resolved.title ?? options.defaultTitle;
    const option = useMemo(() => {
      const resolvedConfig = {
        ...config,
        xAxisLabel: resolved.x ?? "",
        yAxisLabel: resolved.y ?? "",
        yAxisLabelRight: resolved.right ?? "",
        series: config.series.map((s, i) => ({
          ...s,
          label: resolved[`series-${i}`] ?? s.label,
        })),
        representations: config.representations.map((s, i) => ({
          ...s,
          label: resolved[`rep-${i}`] ?? s.label,
        })),
      };
      const host = {
        formatDateLabel: options.formatDateLabel,
        colorForValue: (value: number) => {
          const color = evaluateColorRulesGeneric(
            config.valueColorRules?.rules ?? [],
            String(value),
            ["item"],
          ).item;
          return color ? `#${color}` : undefined;
        },
      };
      return kind === "chart"
        ? buildLegacyChartOption(
            resolvedConfig,
            filteredRows,
            options.darkMode,
            options.emptyLabel,
            width,
            host,
          )
        : buildMixedChartOption(
            resolvedConfig,
            filteredRows,
            options.darkMode,
            options.emptyLabel,
            width,
            host,
          );
    }, [config, resolved, filteredRows, width, kind]);
    return (
      <ChartCard
        title={title}
        onResize={resize}
        toolbar={
          dateAxis && (
            <div>
              {ranges.map((value) => (
                <button
                  type="button"
                  className="miot-row-controls__pill"
                  key={value}
                  aria-pressed={range === value}
                  onClick={() => setRange(value)}
                >
                  {options.rangeLabels[value]}
                </button>
              ))}
            </div>
          )
        }
      >
        <ChartEngineView
          createEngine={options.createEngine}
          option={option}
          ariaLabel={options.describeChart?.(title, filteredRows) ?? title}
        />
      </ChartCard>
    );
  }
  return createWidgetRegistry(
    (["chart", "chart_v2"] as const).map((id) => ({
      meta: { id, hasChildren: false, hasSettings: false },
      Component: RegisteredChart,
      getLayoutDefaults: () => ({ minW: 6, minH: 4 }),
    })),
  );
}
