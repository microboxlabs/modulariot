"use client";

import { useState, useMemo } from "react";
import { Label, TextInput, Select, ToggleSwitch, Button } from "flowbite-react";
import { HiXMark } from "react-icons/hi2";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig, ChartType, SeriesConfig } from "./dashlet";
import type { ColorPalette } from "./chart-palettes";
import { COLOR_PALETTES } from "./chart-palettes";
import { tr } from "@/features/i18n/tr.service";
import {
  SettingsTextField,
  SettingsSelectField,
  SettingsTextareaField,
  SettingsFieldGrid,
  usePgrestSettingsState,
  fromPgrestParamItems,
  buildSimplePgrestConfig,
  PgrestDataTab,
  useActiveProviders,
  type SimpleDataMode,
} from "../common";
import { SettingsModalShell } from "../common/settings-modal-shell";

// ============================================================================
// Chart type options
// ============================================================================

const CHART_TYPE_OPTIONS: { value: ChartType; label: string }[] = [
  { value: "line", label: "Line" },
  { value: "bar", label: "Bar" },
  { value: "pie", label: "Pie" },
  { value: "gauge", label: "Gauge" },
  { value: "scatter", label: "Scatter" },
];

const PALETTE_OPTIONS: { value: string; label: string }[] = [
  ...Object.keys(COLOR_PALETTES).map((k) => ({
    value: k,
    label: k.charAt(0).toUpperCase() + k.slice(1),
  })),
  { value: "custom", label: "Custom" },
];

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
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const activeProviders = useActiveProviders();

  // Visualization state
  const [title, setTitle] = useState(config.title ?? "Chart");
  const [chartType, setChartType] = useState<ChartType>(config.chartType ?? "bar");
  const [xAxisColumn, setXAxisColumn] = useState(config.xAxisColumn ?? "");
  const [series, setSeries] = useState<SeriesItem[]>(
    toSeriesItems(config.series?.length ? config.series : [{ columnKey: "", label: "" }]),
  );
  const [xAxisLabel, setXAxisLabel] = useState(config.xAxisLabel ?? "");
  const [yAxisLabel, setYAxisLabel] = useState(config.yAxisLabel ?? "");
  const [showLegend, setShowLegend] = useState(config.showLegend ?? true);
  const [colorPalette, setColorPalette] = useState<ColorPalette>(
    config.colorPalette ?? "default",
  );
  const [customColors, setCustomColors] = useState<string[]>(
    config.customColors ?? [],
  );
  const [smooth, setSmooth] = useState(config.smooth ?? false);
  const [stacked, setStacked] = useState(config.stacked ?? false);

  // Data state
  const [dataMode, setDataMode] = useState<SimpleDataMode>(
    (config.dataMode as SimpleDataMode) ?? "static",
  );
  const [dataSourceId, setDataSourceId] = useState<string>(
    config.dataSourceId ?? "",
  );
  const [plannerVariableName, setPlannerVariableName] = useState(
    config.plannerVariableName ?? "",
  );
  const [rowsJson, setRowsJson] = useState(
    JSON.stringify(config.rows ?? [], null, 2),
  );

  // Detected columns (from static rows or pgrest introspection)
  const [detectedColumns, setDetectedColumns] = useState<string[]>(() => {
    const rows = config.rows;
    if (rows?.length > 0) return Object.keys(rows[0]);
    return [];
  });

  // Pgrest settings
  const pg = usePgrestSettingsState({
    ...buildSimplePgrestConfig(
      { ...config, dataSourceId: dataSourceId || undefined },
      (detected) => {
        const keys = detected.map((d) => d.key);
        setDetectedColumns(keys);
        if (keys.length >= 1 && !xAxisColumn) setXAxisColumn(keys[0]);
        if (keys.length >= 2 && series.length === 1 && !series[0].columnKey) {
          setSeries(toSeriesItems([{ columnKey: keys[1], label: keys[1] }]));
        }
      },
    ),
  });

  // Update detected columns when static JSON changes
  const handleRowsJsonChange = (val: string) => {
    setRowsJson(val);
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setDetectedColumns(Object.keys(parsed[0]));
      }
    } catch {
      // ignore parse errors during editing
    }
  };

  // Column options for dropdowns
  const columnOptions = useMemo(
    () => detectedColumns.map((k) => ({ value: k, label: k })),
    [detectedColumns],
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
      prev.map((s) => (s._id === id ? { ...s, ...patch } : s)),
    );
  };

  const addSeries = () => {
    setSeries((prev) => [...prev, ...toSeriesItems([{ columnKey: "", label: "" }])]);
  };

  const removeSeries = (id: string) => {
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
  const handleSave = () => {
    let parsedRows = config.rows ?? [];
    if (dataMode === "static") {
      try {
        const parsed = JSON.parse(rowsJson);
        if (!Array.isArray(parsed)) return;
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
      colorPalette,
      customColors,
      smooth,
      stacked,
      dataMode,
      rows: parsedRows,
      pgrestFunctionName: pg.pgrestFunctionName,
      pgrestParams: fromPgrestParamItems(pg.pgrestParams),
      pgrestHttpMethod: pg.pgrestHttpMethod,
      dataSourceId: dataSourceId || undefined,
      plannerVariableName: plannerVariableName || undefined,
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
      <SettingsTextField
        id="ch-title"
        label={tr("common.title", dictionary)}
        value={title}
        onChange={setTitle}
      />

      {/* Chart Type */}
      <SettingsSelectField
        id="ch-chart-type"
        label={tr("dashboard.settings.chartType", dictionary)}
        value={chartType}
        onChange={handleChartTypeChange}
        options={CHART_TYPE_OPTIONS}
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
          >
            <option value="">
              {detectedColumns.length === 0 ? "No columns detected" : "Select..."}
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
        <Label className="mb-1 block text-sm">
          {tr("dashboard.settings.series", dictionary)}
        </Label>
        <div className="space-y-2">
          {series.map((s, i) => (
            <div key={s._id} className="flex items-end gap-1.5">
              <div className="flex-1">
                {i === 0 && (
                  <Label className="mb-0.5 block text-xs text-gray-500">
                    {tr("dashboard.settings.seriesColumn", dictionary)}
                  </Label>
                )}
                <Select
                  value={s.columnKey}
                  onChange={(e) =>
                    updateSeries(s._id, { columnKey: e.target.value })
                  }
                  sizing="sm"
                >
                  <option value="">Select...</option>
                  {columnOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex-1">
                {i === 0 && (
                  <Label className="mb-0.5 block text-xs text-gray-500">
                    {tr("dashboard.settings.seriesLabel", dictionary)}
                  </Label>
                )}
                <TextInput
                  value={s.label}
                  onChange={(e) =>
                    updateSeries(s._id, { label: e.target.value })
                  }
                  placeholder="Label"
                  sizing="sm"
                />
              </div>
              {series.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSeries(s._id)}
                  className="mb-0.5 rounded p-1 text-gray-400 hover:text-red-500"
                >
                  <HiXMark className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        {!isSingleSeries(chartType) && (
          <Button
            size="xs"
            color="light"
            onClick={addSeries}
            className="mt-1.5"
          >
            {tr("dashboard.settings.addSeries", dictionary)}
          </Button>
        )}
      </div>

      {/* Axis Labels (cartesian only) */}
      {isCartesian(chartType) && (
        <SettingsFieldGrid cols={2}>
          <SettingsTextField
            id="ch-x-label"
            label={tr("dashboard.settings.xAxisLabel", dictionary)}
            value={xAxisLabel}
            onChange={setXAxisLabel}
          />
          <SettingsTextField
            id="ch-y-label"
            label={tr("dashboard.settings.yAxisLabel", dictionary)}
            value={yAxisLabel}
            onChange={setYAxisLabel}
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

      {/* Color Palette */}
      <SettingsSelectField
        id="ch-palette"
        label={tr("dashboard.settings.colorPalette", dictionary)}
        value={colorPalette}
        onChange={(v) => setColorPalette(v as ColorPalette)}
        options={PALETTE_OPTIONS}
      />

      {/* Custom colors per series */}
      {colorPalette === "custom" && (
        <div className="space-y-1.5">
          {series.map((s, i) => (
            <div key={s._id} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[60px] truncate">
                {s.label || `Series ${i + 1}`}
              </span>
              <input
                type="color"
                value={customColors[i] ?? "#5470c6"}
                onChange={(e) => updateCustomColor(i, e.target.value)}
                className="h-7 w-7 cursor-pointer rounded border border-gray-300 p-0 dark:border-gray-600"
              />
            </div>
          ))}
        </div>
      )}

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
    <SettingsModalShell
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      dictionary={dictionary}
      visualizationTab={visualizationTab}
      dataTab={dataTab}
      className="w-[28rem]"
    />
  );
}
