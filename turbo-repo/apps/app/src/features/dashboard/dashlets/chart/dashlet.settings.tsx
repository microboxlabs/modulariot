"use client";

import { useState, useMemo, useEffect } from "react";
import { Label, Select, Button } from "flowbite-react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig, ChartType, SeriesConfig, XAxisDateFormat } from "./dashlet";
import { tr } from "@/features/i18n/tr.service";
import { AdvancedColorPicker } from "@/features/common/components/advanced-color-picker";
import {
  SettingsTextareaField,
  SettingsFieldGrid,
  HbTextField,
  HbTextareaField,
  HbInlineInput,
  ExpandableSection,
  SettingsToggleRow,
} from "../common/settings-fields";
import { DeleteItemButton } from "../common/delete-item-button";
import { ChartTypePicker } from "./chart-type-picker";
import { usePgrestSettingsState } from "../common/use-pgrest-settings-state";
import { fromPgrestParamItems } from "../common/pgrest-types";
import { buildSimplePgrestConfig } from "../common/pgrest-settings-helpers";
import { PgrestDataTab } from "../common/pgrest-data-tab";
import { useActiveProviders } from "../common/use-active-providers";
import { type SimpleDataMode } from "../common/use-simple-pgrest-settings";
import { usePlannerContext } from "../../context/planner-context";
import { useDashboardFilterSuggestions } from "../common/use-filter-suggestions";
import { useChartColorSettings, ChartColorRulesEditor } from "./value-color-rules";
import { useWidgetRefreshSettings } from "../common/use-widget-refresh-settings";
import { SettingsShell, buildStandardTabs } from "../common/settings-shell";
import { useSettingsDirty } from "../common/use-settings-dirty";

// ============================================================================
// Helpers
// ============================================================================

const isCartesian = (t: ChartType) => t === "line" || t === "bar" || t === "scatter";
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
  const filterSuggestions = useDashboardFilterSuggestions();

  // Visualization state
  const [title, setTitle] = useState(config.title ?? "Chart");
  const [chartType, setChartType] = useState<ChartType>(config.chartType ?? "bar");
  const [xAxisColumn, setXAxisColumn] = useState(config.xAxisColumn ?? "");
  const [series, setSeries] = useState<SeriesItem[]>(
    toSeriesItems(config.series?.length ? config.series : [{ columnKey: "", label: "" }])
  );
  const [xAxisLabel, setXAxisLabel] = useState(config.xAxisLabel ?? "");
  const [yAxisLabel, setYAxisLabel] = useState(config.yAxisLabel ?? "");
  const [showLegend, setShowLegend] = useState(config.showLegend ?? true);
  const [customColors, setCustomColors] = useState<string[]>(config.customColors ?? []);
  const [smooth, setSmooth] = useState(config.smooth ?? false);
  const [stacked, setStacked] = useState(config.stacked ?? false);
  const [horizontal, setHorizontal] = useState(config.horizontal ?? false);
  const [showBarLabels, setShowBarLabels] = useState(config.showBarLabels ?? false);
  const [xAxisDateFormat, setXAxisDateFormat] = useState<XAxisDateFormat>(config.xAxisDateFormat ?? "none");
  const colorRules = useChartColorSettings({ valueColorRules: config.valueColorRules });
  const [tooltipTemplate, setTooltipTemplate] = useState(config.tooltipTemplate ?? "");

  // Data state
  const [dataMode, setDataMode] = useState<SimpleDataMode>(config.dataMode ?? "static");
  const [dataSourceId, setDataSourceId] = useState<string>(config.dataSourceId ?? "");
  const [plannerVariableName, setPlannerVariableName] = useState(config.plannerVariableName ?? "");
  const [rowsJson, setRowsJson] = useState(JSON.stringify(config.rows ?? [], null, 2));
  const [rowsError, setRowsError] = useState<string | null>(null);

  const [detectedColumns, setDetectedColumns] = useState<string[]>(() => {
    const rows = config.rows;
    if (rows?.length > 0) return Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
    return [];
  });

  const schemaSuggestions = useMemo(() => {
    if (dataMode === "planner" && plannerVariableName) return schemas.get(plannerVariableName);
    if (detectedColumns.length > 0) return detectedColumns;
    return undefined;
  }, [dataMode, plannerVariableName, schemas, detectedColumns]);

  const reconcileColumns = (keys: string[]) => {
    setDetectedColumns(keys);
    const keySet = new Set(keys);
    setXAxisColumn((prev) => (prev && keySet.has(prev) ? prev : (keys[0] ?? "")));
    setSeries((prev) => {
      const reconciled = prev.map((s) =>
        s.columnKey && !keySet.has(s.columnKey) ? { ...s, columnKey: "", label: "" } : s
      );
      if (reconciled.every((s) => !s.columnKey) && keys.length >= 2) {
        return toSeriesItems([{ columnKey: keys[1], label: keys[1] }]);
      }
      return reconciled;
    });
  };

  const pg = usePgrestSettingsState({
    ...buildSimplePgrestConfig(
      { ...config, dataSourceId: dataSourceId || undefined },
      (detected) => reconcileColumns(detected.map((d) => d.key))
    ),
  });

  useEffect(() => {
    if (dataMode === "pgrest" && pg.pgrestFunctionName) {
      pg.detectColumns();
    } else if (dataMode === "planner" && plannerVariableName) {
      const keys = schemas.get(plannerVariableName);
      if (keys?.length) reconcileColumns(keys);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRowsJsonChange = (val: string) => {
    setRowsJson(val);
    try {
      const parsed = JSON.parse(val);
      if (!Array.isArray(parsed)) { setRowsError(tr("dashboard.settings.mustBeJsonArray", dictionary)); return; }
      const isObjectArray = parsed.every(
        (item) => item !== null && typeof item === "object" && !Array.isArray(item)
      );
      if (!isObjectArray) { setRowsError(tr("dashboard.settings.mustBeJsonArray", dictionary)); return; }
      setRowsError(null);
      reconcileColumns(parsed.length > 0 ? Array.from(new Set(parsed.flatMap((r: Record<string, unknown>) => Object.keys(r)))) : []);
    } catch {
      setRowsError(tr("dashboard.settings.invalidJson", dictionary));
    }
  };

  const columnOptions = useMemo(
    () => detectedColumns.map((k) => ({ value: k, label: k })),
    [detectedColumns]
  );

  const handleChartTypeChange = (type: ChartType) => {
    setChartType(type);
    if (isSingleSeries(type) && series.length > 1) {
      setSeries([series[0]]);
      setCustomColors((prev) => (prev.length > 1 ? [prev[0]] : prev));
    }
  };

  const updateSeries = (id: string, patch: Partial<SeriesConfig>) =>
    setSeries((prev) => prev.map((s) => (s._id === id ? { ...s, ...patch } : s)));

  const addSeries = () =>
    setSeries((prev) => [...prev, ...toSeriesItems([{ columnKey: "", label: "" }])]);

  const removeSeries = (id: string) => {
    const index = series.findIndex((s) => s._id === id);
    if (index >= 0) setCustomColors((prev) => prev.filter((_, i) => i !== index));
    setSeries((prev) => prev.filter((s) => s._id !== id));
  };

  const updateCustomColor = (index: number, color: string) =>
    setCustomColors((prev) => { const next = [...prev]; next[index] = color; return next; });

  const isDirty = useSettingsDirty(isOpen, {
    title, chartType, xAxisColumn, series, xAxisLabel, yAxisLabel, showLegend,
    customColors, smooth, stacked, horizontal, showBarLabels, xAxisDateFormat,
    tooltipTemplate, colorRulesJson: JSON.stringify(colorRules.rules),
    dataMode, rowsJson, pgFn: pg.pgrestFunctionName, pgParams: pg.pgrestParams,
    pgMethod: pg.pgrestHttpMethod, dataSourceId, plannerVariableName,
    refreshValue: refresh.value,
  });

  const handleSave = () => {
    let parsedRows = config.rows ?? [];
    if (dataMode === "static") {
      if (rowsError) return;
      try {
        const parsed = JSON.parse(rowsJson);
        if (!Array.isArray(parsed)) { setRowsError(tr("dashboard.settings.mustBeJsonArray", dictionary)); return; }
        const isObjectArray = parsed.every(
          (item) => item !== null && typeof item === "object" && !Array.isArray(item)
        );
        if (!isObjectArray) { setRowsError(tr("dashboard.settings.mustBeJsonArray", dictionary)); return; }
        parsedRows = parsed;
      } catch { setRowsError(tr("dashboard.settings.invalidJson", dictionary)); return; }
    }
    onSave({
      title, chartType, xAxisColumn,
      series: series.filter((s) => s.columnKey).map(({ _id: _, ...rest }) => rest),
      xAxisLabel, yAxisLabel, showLegend,
      colorPalette: "custom", customColors,
      smooth, stacked, horizontal, showBarLabels,
      xAxisDateFormat: xAxisDateFormat === "none" ? undefined : xAxisDateFormat,
      tooltipTemplate: tooltipTemplate || undefined,
      ...colorRules.buildSavePayload(),
      dataMode, rows: parsedRows,
      pgrestFunctionName: pg.pgrestFunctionName,
      pgrestParams: fromPgrestParamItems(pg.pgrestParams),
      pgrestHttpMethod: pg.pgrestHttpMethod,
      dataSourceId: dataSourceId || undefined,
      plannerVariableName: plannerVariableName || undefined,
      ...refresh.savePayload,
    });
    onClose();
  };

  const xAxisColumnLabel =
    chartType === "pie"
      ? tr("dashboard.settings.categoryColumn", dictionary)
      : tr("dashboard.settings.xAxisColumn", dictionary);

  // ===========================================================================
  // Visualization Tab — grouped into expandable sections
  // ===========================================================================

  const visualizationTab = (
    <div className="space-y-2">

      {/* ── General ───────────────────────────────────────────────── */}
      <ExpandableSection title={tr("dashboard.settings.sectionGeneral", dictionary)}>
        <HbTextField
          id="ch-title"
          label={tr("common.title", dictionary)}
          value={title}
          onChange={setTitle}
          schemaSuggestions={schemaSuggestions}
          filterSuggestions={filterSuggestions}
        />
        <ChartTypePicker value={chartType} onChange={handleChartTypeChange} dictionary={dictionary} />
      </ExpandableSection>

      {/* ── Data Mapping ──────────────────────────────────────────── */}
      <ExpandableSection title={tr("dashboard.settings.sectionDataMapping", dictionary)}>
        {chartType !== "gauge" && (
          <div>
            <Label htmlFor="ch-x-col" className="mb-1 block text-xs font-normal text-gray-500 dark:text-gray-400">
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
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label className="text-xs font-normal text-gray-500 dark:text-gray-400">{tr("dashboard.settings.series", dictionary)}</Label>
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
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-600 dark:bg-gray-700"
              >
                <Select
                  value={s.columnKey}
                  onChange={(e) => updateSeries(s._id, { columnKey: e.target.value })}
                  sizing="sm"
                  className="flex-1 [&>select]:cursor-pointer"
                >
                  <option value="">{tr("dashboard.settings.seriesColumn", dictionary)}</option>
                  {columnOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </Select>
                <HbInlineInput
                  value={s.label}
                  onChange={(v) => updateSeries(s._id, { label: v })}
                  placeholder={tr("dashboard.settings.seriesLabel", dictionary)}
                  className="flex-1"
                  schemaSuggestions={schemaSuggestions}
                  filterSuggestions={filterSuggestions}
                />
                <AdvancedColorPicker
                  value={(customColors[i] ?? "5470c6").replace(/^#/, "")}
                  onChange={(c) => updateCustomColor(i, `#${c}`)}
                  title={s.label || tr("dashboard.dashlets.chart.seriesNumber", dictionary, { n: String(i + 1) })}
                />
                {series.length > 1 && (
                  <DeleteItemButton
                    onClick={() => removeSeries(s._id)}
                    ariaLabel={tr("dashboard.settings.removeSeries", dictionary)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </ExpandableSection>

      {/* ── Appearance ────────────────────────────────────────────── */}
      <ExpandableSection title={tr("dashboard.settings.sectionAppearance", dictionary)}>
        {isCartesian(chartType) && (
          <SettingsFieldGrid cols={2}>
            <HbTextField
              id="ch-x-label"
              label={tr("dashboard.settings.xAxisLabel", dictionary)}
              value={xAxisLabel}
              onChange={setXAxisLabel}
              schemaSuggestions={schemaSuggestions}
              filterSuggestions={filterSuggestions}
            />
            <HbTextField
              id="ch-y-label"
              label={tr("dashboard.settings.yAxisLabel", dictionary)}
              value={yAxisLabel}
              onChange={setYAxisLabel}
              schemaSuggestions={schemaSuggestions}
              filterSuggestions={filterSuggestions}
            />
          </SettingsFieldGrid>
        )}

        <SettingsToggleRow
          label={tr("dashboard.settings.showLegend", dictionary)}
          checked={showLegend}
          onChange={setShowLegend}
        />

        {chartType === "line" && (
          <SettingsToggleRow
            label={tr("dashboard.settings.smooth", dictionary)}
            checked={smooth}
            onChange={setSmooth}
          />
        )}

        {(chartType === "line" || chartType === "bar") && (
          <SettingsToggleRow
            label={tr("dashboard.settings.stacked", dictionary)}
            checked={stacked}
            onChange={setStacked}
          />
        )}

        {chartType === "bar" && (
          <SettingsToggleRow
            label={tr("dashboard.settings.horizontalBars", dictionary)}
            checked={horizontal}
            onChange={setHorizontal}
          />
        )}

        {chartType === "bar" && (
          <SettingsToggleRow
            label={tr("dashboard.settings.showBarLabels", dictionary)}
            checked={showBarLabels}
            onChange={setShowBarLabels}
          />
        )}

        {chartType === "line" && (
          <SettingsToggleRow
            label={tr("dashboard.settings.xAxisIsDate", dictionary)}
            checked={xAxisDateFormat !== "none"}
            onChange={(v) => setXAxisDateFormat(v ? "month" : "none")}
          />
        )}
      </ExpandableSection>

      {/* ── Colors & Rules ────────────────────────────────────────── */}
      <ExpandableSection title={tr("dashboard.settings.sectionColors", dictionary)} defaultOpen={false}>
        <ChartColorRulesEditor
          rules={colorRules.rules}
          dictionary={dictionary}
          onAdd={colorRules.addRule}
          onRemove={colorRules.removeRule}
          onUpdate={colorRules.updateRule}
          onToggleTarget={colorRules.toggleTarget}
        />
      </ExpandableSection>

      {/* ── Tooltip ───────────────────────────────────────────────── */}
      <ExpandableSection title={tr("dashboard.settings.sectionTooltip", dictionary)} defaultOpen={false}>
        <HbTextareaField
          id="ch-tooltip-template"
          value={tooltipTemplate}
          onChange={setTooltipTemplate}
          placeholder={"{{row.name}}\n{{row.value}}"}
          rows={3}
          schemaSuggestions={schemaSuggestions}
          filterSuggestions={filterSuggestions}
        />
      </ExpandableSection>

    </div>
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
        <>
          <SettingsTextareaField
            id="ch-rows-json"
            label={tr("dashboard.settings.rowsJsonArray", dictionary)}
            value={rowsJson}
            onChange={handleRowsJsonChange}
            rows={6}
          />
          {rowsError && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{rowsError}</p>
          )}
        </>
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
      className="w-md"
      footer={refresh.selectNode}
      title={dashletName}
      widgetId={widgetId}
      isDirty={isDirty}
    />
  );
}
