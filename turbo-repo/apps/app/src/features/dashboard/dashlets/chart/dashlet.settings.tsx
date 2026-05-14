"use client";

import { useState, useMemo, useEffect } from "react";
import { Label, Select, ToggleSwitch, Button } from "flowbite-react";
import { HiXMark } from "react-icons/hi2";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig, ChartType, SeriesConfig, XAxisDateFormat, DateRange } from "./dashlet";
import { tr } from "@/features/i18n/tr.service";
import { AdvancedColorPicker } from "@/features/common/components/advanced-color-picker";
import {
  SettingsSelectField,
  SettingsTextareaField,
  SettingsFieldGrid,
  HbTextField,
  HbTextareaField,
  HbInlineInput,
} from "../common/settings-fields";
import { usePgrestSettingsState } from "../common/use-pgrest-settings-state";
import { fromPgrestParamItems } from "../common/pgrest-types";
import { buildSimplePgrestConfig } from "../common/pgrest-settings-helpers";
import { PgrestDataTab } from "../common/pgrest-data-tab";
import { useActiveProviders } from "../common/use-active-providers";
import { type SimpleDataMode } from "../common/use-simple-pgrest-settings";
import { usePlannerContext } from "../../context/planner-context";
import { useChartColorSettings, ChartColorRulesEditor } from "./value-color-rules";
import { useWidgetRefreshSettings } from "../common/use-widget-refresh-settings";
import { SettingsShell, buildStandardTabs } from "../common/settings-shell";
import { useSettingsDirty } from "../common/use-settings-dirty";

// ============================================================================
// Chart type options
// ============================================================================

const CHART_TYPE_KEYS: { value: ChartType; i18nKey: string }[] = [
  { value: "line", i18nKey: "dashboard.dashlets.chart.typeLine" },
  { value: "bar", i18nKey: "dashboard.dashlets.chart.typeBar" },
  { value: "pie", i18nKey: "dashboard.dashlets.chart.typePie" },
  { value: "gauge", i18nKey: "dashboard.dashlets.chart.typeGauge" },
  { value: "scatter", i18nKey: "dashboard.dashlets.chart.typeScatter" },
];

const isCartesian = (t: ChartType) =>
  t === "line" || t === "bar" || t === "scatter";
const isSingleSeries = (t: ChartType) => t === "pie" || t === "gauge";

type SeriesItem = SeriesConfig & { _id: string };
let seriesIdCounter = 0;
function toSeriesItems(items: SeriesConfig[]): SeriesItem[] {
  return items.map((s) => ({ ...s, _id: `s-${++seriesIdCounter}` }));
}

// ============================================================================
// Component
// ============================================================================

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
  dashletName,
  widgetId,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const activeProviders = useActiveProviders();
  const refresh = useWidgetRefreshSettings(config, dictionary);
  const { schemas } = usePlannerContext();

  const chartTypeOptions = useMemo(
    () =>
      CHART_TYPE_KEYS.map((o) => ({
        value: o.value,
        label: tr(o.i18nKey, dictionary),
      })),
    [dictionary]
  );

  // Visualization state
  const [title, setTitle] = useState(config.title ?? "Chart");
  const [chartType, setChartType] = useState<ChartType>(
    config.chartType ?? "bar"
  );
  const [xAxisColumn, setXAxisColumn] = useState(config.xAxisColumn ?? "");
  const [series, setSeries] = useState<SeriesItem[]>(
    toSeriesItems(
      config.series?.length ? config.series : [{ columnKey: "", label: "" }]
    )
  );
  const [xAxisLabel, setXAxisLabel] = useState(config.xAxisLabel ?? "");
  const [yAxisLabel, setYAxisLabel] = useState(config.yAxisLabel ?? "");
  const [showLegend, setShowLegend] = useState(config.showLegend ?? true);
  const [customColors, setCustomColors] = useState<string[]>(
    config.customColors ?? []
  );
  const [smooth, setSmooth] = useState(config.smooth ?? false);
  const [stacked, setStacked] = useState(config.stacked ?? false);
  const [horizontal, setHorizontal] = useState(config.horizontal ?? false);
  const [showBarLabels, setShowBarLabels] = useState(config.showBarLabels ?? false);
  const [xAxisDateFormat, setXAxisDateFormat] = useState<XAxisDateFormat>(
    config.xAxisDateFormat ?? "none"
  );

  const colorRules = useChartColorSettings({ valueColorRules: config.valueColorRules });
  const [tooltipTemplate, setTooltipTemplate] = useState(
    config.tooltipTemplate ?? ""
  );

  // Data state
  const [dataMode, setDataMode] = useState<SimpleDataMode>(
    (config.dataMode as SimpleDataMode) ?? "static"
  );
  const [dataSourceId, setDataSourceId] = useState<string>(
    config.dataSourceId ?? ""
  );
  const [plannerVariableName, setPlannerVariableName] = useState(
    config.plannerVariableName ?? ""
  );
  const [rowsJson, setRowsJson] = useState(
    JSON.stringify(config.rows ?? [], null, 2)
  );

  // Detected columns (from static rows or pgrest introspection)
  const [detectedColumns, setDetectedColumns] = useState<string[]>(() => {
    const rows = config.rows;
    if (rows?.length > 0) return Object.keys(rows[0]);
    return [];
  });

  // Schema suggestions for Handlebars autocomplete
  const schemaSuggestions = useMemo(() => {
    if (dataMode === "planner" && plannerVariableName) {
      return schemas.get(plannerVariableName);
    }
    if (detectedColumns.length > 0) return detectedColumns;
    return undefined;
  }, [dataMode, plannerVariableName, schemas, detectedColumns]);

  // Reconcile xAxisColumn and series against a new set of valid column keys
  const reconcileColumns = (keys: string[]) => {
    setDetectedColumns(keys);
    const keySet = new Set(keys);

    // Reset xAxisColumn if it's no longer valid
    setXAxisColumn((prev) =>
      prev && keySet.has(prev) ? prev : (keys[0] ?? "")
    );

    setSeries((prev) => {
      const reconciled = prev.map((s) => {
        if (s.columnKey && !keySet.has(s.columnKey)) {
          return { ...s, columnKey: "", label: "" };
        }
        return s;
      });
      // If every series was cleared and we have keys, seed the first one
      if (reconciled.every((s) => !s.columnKey) && keys.length >= 2) {
        return toSeriesItems([{ columnKey: keys[1], label: keys[1] }]);
      }
      return reconciled;
    });
  };

  // Pgrest settings
  const pg = usePgrestSettingsState({
    ...buildSimplePgrestConfig(
      { ...config, dataSourceId: dataSourceId || undefined },
      (detected) => {
        reconcileColumns(detected.map((d) => d.key));
      }
    ),
  });

  // Auto-detect columns on mount when pgrest/planner is already configured
  useEffect(() => {
    if (dataMode === "pgrest" && pg.pgrestFunctionName) {
      pg.detectColumns();
    } else if (dataMode === "planner" && plannerVariableName) {
      const keys = schemas.get(plannerVariableName);
      if (keys?.length) reconcileColumns(keys);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update detected columns when static JSON changes
  const handleRowsJsonChange = (val: string) => {
    setRowsJson(val);
    try {
      const parsed = JSON.parse(val);
      if (!Array.isArray(parsed)) return;
      const isObjectArray = parsed.every(
        (item) =>
          item !== null && typeof item === "object" && !Array.isArray(item)
      );
      if (isObjectArray && parsed.length > 0) {
        reconcileColumns(Object.keys(parsed[0]));
      } else {
        reconcileColumns([]);
      }
    } catch {
      // ignore parse errors during editing
    }
  };

  // Column options for dropdowns
  const columnOptions = useMemo(
    () => detectedColumns.map((k) => ({ value: k, label: k })),
    [detectedColumns]
  );

  // Handle chart type change
  const handleChartTypeChange = (type: string) => {
    const newType = type as ChartType;
    setChartType(newType);
    // Trim series for pie/gauge
    if (isSingleSeries(newType) && series.length > 1) {
      setSeries([series[0]]);
    }
  };

  // Series CRUD
  const updateSeries = (id: string, patch: Partial<SeriesConfig>) => {
    setSeries((prev) =>
      prev.map((s) => (s._id === id ? { ...s, ...patch } : s))
    );
  };

  const addSeries = () => {
    setSeries((prev) => [
      ...prev,
      ...toSeriesItems([{ columnKey: "", label: "" }]),
    ]);
  };

  const removeSeries = (id: string) => {
    const index = series.findIndex((s) => s._id === id);
    if (index >= 0) {
      setCustomColors((prev) => prev.filter((_, i) => i !== index));
    }
    setSeries((prev) => prev.filter((s) => s._id !== id));
  };

  // Custom color helpers
  const updateCustomColor = (index: number, color: string) => {
    setCustomColors((prev) => {
      const next = [...prev];
      next[index] = color;
      return next;
    });
  };

  // Save handler
  const isDirty = useSettingsDirty(isOpen, {
    title,
    chartType,
    xAxisColumn,
    series,
    xAxisLabel,
    yAxisLabel,
    showLegend,
    customColors,
    smooth,
    stacked,
    horizontal,
    showBarLabels,
    xAxisDateFormat,
    tooltipTemplate,
    colorRulesJson: JSON.stringify(colorRules.rules),
    dataMode,
    rowsJson,
    pgFn: pg.pgrestFunctionName,
    pgParams: pg.pgrestParams,
    pgMethod: pg.pgrestHttpMethod,
    dataSourceId,
    plannerVariableName,
    refreshValue: refresh.value,
  });

  const handleSave = () => {
    let parsedRows = config.rows ?? [];
    if (dataMode === "static") {
      try {
        const parsed = JSON.parse(rowsJson);
        if (!Array.isArray(parsed)) return;
        const isObjectArray = parsed.every(
          (item) =>
            item !== null && typeof item === "object" && !Array.isArray(item)
        );
        if (!isObjectArray) return;
        parsedRows = parsed;
      } catch {
        return;
      }
    }

    onSave({
      title,
      chartType,
      xAxisColumn,
      series: series
        .filter((s) => s.columnKey)
        .map(({ _id: _, ...rest }) => rest),
      xAxisLabel,
      yAxisLabel,
      showLegend,
      colorPalette: "custom",
      customColors,
      smooth,
      stacked,
      horizontal,
      showBarLabels,
      xAxisDateFormat: xAxisDateFormat !== "none" ? xAxisDateFormat : undefined,
      tooltipTemplate: tooltipTemplate || undefined,
      ...colorRules.buildSavePayload(),
      dataMode,
      rows: parsedRows,
      pgrestFunctionName: pg.pgrestFunctionName,
      pgrestParams: fromPgrestParamItems(pg.pgrestParams),
      pgrestHttpMethod: pg.pgrestHttpMethod,
      dataSourceId: dataSourceId || undefined,
      plannerVariableName: plannerVariableName || undefined,
      ...refresh.savePayload,
    });
    onClose();
  };

  // ===========================================================================
  // Visualization Tab
  // ===========================================================================

  const xAxisColumnLabel =
    chartType === "pie"
      ? tr("dashboard.settings.categoryColumn", dictionary)
      : tr("dashboard.settings.xAxisColumn", dictionary);

  const visualizationTab = (
    <>
      {/* Title */}
      <HbTextField
        id="ch-title"
        label={tr("common.title", dictionary)}
        value={title}
        onChange={setTitle}
        schemaSuggestions={schemaSuggestions}
      />

      {/* Chart Type */}
      <SettingsSelectField
        id="ch-chart-type"
        label={tr("dashboard.settings.chartType", dictionary)}
        value={chartType}
        onChange={handleChartTypeChange}
        options={chartTypeOptions}
      />

      {/* X-Axis / Category Column (hidden for gauge) */}
      {chartType !== "gauge" && (
        <div>
          <Label htmlFor="ch-x-col" className="mb-1 block text-sm">
            {xAxisColumnLabel}
          </Label>
          <Select
            id="ch-x-col"
            value={xAxisColumn}
            onChange={(e) => setXAxisColumn(e.target.value)}
            sizing="sm"
            className="[&>select]:cursor-pointer"
          >
            <option value="">
              {detectedColumns.length === 0
                ? tr("dashboard.dashlets.chart.noColumnsDetected", dictionary)
                : tr("dashboard.dashlets.chart.selectPlaceholder", dictionary)}
            </option>
            {columnOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
      )}

      {/* Series Configuration */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm">
            {tr("dashboard.settings.series", dictionary)}
          </Label>
          {!isSingleSeries(chartType) && (
            <Button size="xs" color="light" onClick={addSeries}>
              {tr("dashboard.settings.addSeries", dictionary)}
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {series.map((s, i) => (
            <div
              key={s._id}
              className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700"
            >
              <Select
                value={s.columnKey}
                onChange={(e) =>
                  updateSeries(s._id, { columnKey: e.target.value })
                }
                sizing="sm"
                className="flex-1 [&>select]:cursor-pointer"
              >
                <option value="">
                  {tr("dashboard.settings.seriesColumn", dictionary)}
                </option>
                {columnOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              <HbInlineInput
                value={s.label}
                onChange={(v) => updateSeries(s._id, { label: v })}
                placeholder={tr("dashboard.settings.seriesLabel", dictionary)}
                className="flex-1"
                schemaSuggestions={schemaSuggestions}
              />
              <AdvancedColorPicker
                value={(customColors[i] ?? "5470c6").replace(/^#/, "")}
                onChange={(c) => updateCustomColor(i, `#${c}`)}
                title={
                  s.label ||
                  tr("dashboard.dashlets.chart.seriesNumber", dictionary, {
                    n: String(i + 1),
                  })
                }
              />
              {series.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSeries(s._id)}
                  aria-label={tr("dashboard.settings.removeSeries", dictionary)}
                  title={tr("dashboard.settings.removeSeries", dictionary)}
                  className="cursor-pointer rounded p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <HiXMark className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Axis Labels (cartesian only) */}
      {isCartesian(chartType) && (
        <SettingsFieldGrid cols={2}>
          <HbTextField
            id="ch-x-label"
            label={tr("dashboard.settings.xAxisLabel", dictionary)}
            value={xAxisLabel}
            onChange={setXAxisLabel}
            schemaSuggestions={schemaSuggestions}
          />
          <HbTextField
            id="ch-y-label"
            label={tr("dashboard.settings.yAxisLabel", dictionary)}
            value={yAxisLabel}
            onChange={setYAxisLabel}
            schemaSuggestions={schemaSuggestions}
          />
        </SettingsFieldGrid>
      )}

      {/* Legend */}
      <div className="flex items-center justify-between">
        <Label className="text-sm">
          {tr("dashboard.settings.showLegend", dictionary)}
        </Label>
        <ToggleSwitch checked={showLegend} onChange={setShowLegend} />
      </div>

      {/* Chart-specific options */}
      {chartType === "line" && (
        <div className="flex items-center justify-between">
          <Label className="text-sm">
            {tr("dashboard.settings.smooth", dictionary)}
          </Label>
          <ToggleSwitch checked={smooth} onChange={setSmooth} />
        </div>
      )}

      {(chartType === "line" || chartType === "bar") && (
        <div className="flex items-center justify-between">
          <Label className="text-sm">
            {tr("dashboard.settings.stacked", dictionary)}
          </Label>
          <ToggleSwitch checked={stacked} onChange={setStacked} />
        </div>
      )}

      {chartType === "bar" && (
        <div className="flex items-center justify-between">
          <Label className="text-sm">
            {tr("dashboard.settings.horizontalBars", dictionary)}
          </Label>
          <ToggleSwitch checked={horizontal} onChange={setHorizontal} />
        </div>
      )}

      {chartType === "bar" && (
        <div className="flex items-center justify-between">
          <Label className="text-sm">
            {tr("dashboard.settings.showBarLabels", dictionary)}
          </Label>
          <ToggleSwitch checked={showBarLabels} onChange={setShowBarLabels} />
        </div>
      )}

      {chartType === "line" && (
        <div className="flex items-center justify-between">
          <Label className="text-sm">
            {tr("dashboard.settings.xAxisIsDate", dictionary)}
          </Label>
          <ToggleSwitch
            checked={xAxisDateFormat !== "none"}
            onChange={(v) => setXAxisDateFormat(v ? "month" : "none")}
          />
        </div>
      )}



      {/* Color rules */}
      <ChartColorRulesEditor
        rules={colorRules.rules}
        dictionary={dictionary}
        onAdd={colorRules.addRule}
        onRemove={colorRules.removeRule}
        onUpdate={colorRules.updateRule}
        onToggleTarget={colorRules.toggleTarget}
      />

      {/* Custom tooltip template */}
      <HbTextareaField
        id="ch-tooltip-template"
        label={tr("dashboard.settings.tooltipTemplate", dictionary)}
        value={tooltipTemplate}
        onChange={setTooltipTemplate}
        placeholder={"{{row.name}}\n{{row.value}}"}
        rows={3}
      />
    </>
  );

  // ===========================================================================
  // Data Tab
  // ===========================================================================

  const dataTab = (
    <>
      <PgrestDataTab
        id="ch-data-mode"
        dataMode={dataMode}
        onDataModeChange={setDataMode}
        pgrest={pg}
        dictionary={dictionary}
        plannerVariableName={plannerVariableName}
        onPlannerVariableNameChange={setPlannerVariableName}
        onPlannerSchemaDetected={reconcileColumns}
        dataSourceId={dataSourceId}
        onDataSourceIdChange={setDataSourceId}
        activeProviders={activeProviders}
      />

      {dataMode === "static" && (
        <SettingsTextareaField
          id="ch-rows-json"
          label={tr("dashboard.settings.rowsJsonArray", dictionary)}
          value={rowsJson}
          onChange={handleRowsJsonChange}
          rows={6}
        />
      )}
    </>
  );

  return (
    <SettingsShell
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      dictionary={dictionary}
      tabs={buildStandardTabs(dictionary, visualizationTab, dataTab)}
      className="w-[28rem]"
      footer={refresh.selectNode}
      title={dashletName}
      widgetId={widgetId}
      isDirty={isDirty}
    />
  );
}
