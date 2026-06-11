"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Label, Select, Button, ToggleSwitch } from "flowbite-react";
import { HiChevronDown } from "react-icons/hi2";
import type { DashletSettingsProps } from "../types";
import type {
  DashletConfig,
  ChartFamily,
  RepresentationConfig,
  RepresentationType,
  XAxisDateFormat,
} from "./dashlet";
import { tr, trDynamic } from "@/features/i18n/tr.service";
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
import { CHART_ICON } from "../chart/chart-type-picker";
import { usePgrestSettingsState } from "../common/use-pgrest-settings-state";
import { fromPgrestParamItems } from "../common/pgrest-types";
import { buildSimplePgrestConfig } from "../common/pgrest-settings-helpers";
import { PgrestDataTab } from "../common/pgrest-data-tab";
import { useActiveProviders } from "../common/use-active-providers";
import { type SimpleDataMode } from "../common/use-simple-pgrest-settings";
import { usePlannerContext } from "../../context/planner-context";
import { useChartColorSettings, ChartColorRulesEditor } from "../chart/value-color-rules";
import { useWidgetRefreshSettings } from "../common/use-widget-refresh-settings";
import { SettingsShell, buildStandardTabs } from "../common/settings-shell";
import { useSettingsDirty } from "../common/use-settings-dirty";

// ============================================================================
// Helpers
// ============================================================================

const SINGLE_SERIES_FAMILIES: ChartFamily[] = ["pie", "gauge"];

type RepresentationItem = RepresentationConfig & { _id: string };
let repIdCounter = 0;
function toRepresentationItems(items: RepresentationConfig[]): RepresentationItem[] {
  return items.map((r) => ({ ...r, _id: `rep-${++repIdCounter}` }));
}

// ============================================================================
// Chart Family Picker
// ============================================================================

const LINE_ICON_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <polyline points="3,17 7,10 12,14 17,6 21,9" />
  </svg>
);
const BAR_ICON_SVG = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
    <rect x="3" y="13" width="4" height="8" rx="1" />
    <rect x="10" y="8" width="4" height="13" rx="1" />
    <rect x="17" y="4" width="4" height="17" rx="1" />
  </svg>
);

const FAMILY_DEFS: {
  value: ChartFamily;
  labelKey: string;
  descKey: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "cartesian",
    labelKey: "dashboard.dashlets.chart_v2.familyCartesian",
    descKey: "dashboard.dashlets.chart_v2.familyCartesianDesc",
    icon: (
      <span className="flex gap-0.5">
        {BAR_ICON_SVG}
        {LINE_ICON_SVG}
      </span>
    ),
  },
  {
    value: "pie",
    labelKey: "dashboard.dashlets.chart_v2.familyPie",
    descKey: "dashboard.dashlets.chart_v2.familyPieDesc",
    icon: <CHART_ICON.pie className="h-5 w-5" />,
  },
  {
    value: "gauge",
    labelKey: "dashboard.dashlets.chart_v2.familyGauge",
    descKey: "dashboard.dashlets.chart_v2.familyGaugeDesc",
    icon: <CHART_ICON.gauge className="h-5 w-5" />,
  },
];

interface ChartFamilyPickerProps {
  value: ChartFamily;
  onChange: (f: ChartFamily) => void;
  dictionary: DashletSettingsProps<DashletConfig>["dictionary"];
}

function ChartFamilyPicker({ value, onChange, dictionary }: Readonly<ChartFamilyPickerProps>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeDef = FAMILY_DEFS.find((d) => d.value === value)!;

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  return (
    <div>
      <Label className="mb-1.5 block text-xs font-normal text-gray-500 dark:text-gray-400">
        {trDynamic("dashboard.dashlets.chart_v2.chartFamily", dictionary)}
      </Label>
      <div ref={containerRef} className="relative">
        <Button
          type="button"
          color="light"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex justify-between"
        >
          <span className="flex items-center gap-2">
            <span className="shrink-0 text-gray-600 dark:text-gray-300">{activeDef.icon}</span>
            {trDynamic(activeDef.labelKey, dictionary)}
          </span>
          <HiChevronDown
            className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </Button>

        {open && (
          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
            {FAMILY_DEFS.map((f) => {
              const isActive = value === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => { onChange(f.value); setOpen(false); }}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${isActive ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
                >
                  <span
                    className={`h-7 w-7 shrink-0 flex items-center justify-center ${isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"}`}
                  >
                    {f.icon}
                  </span>
                  <div>
                    <div className={`text-sm font-medium leading-tight ${isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-900 dark:text-white"}`}>
                      {trDynamic(f.labelKey, dictionary)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {trDynamic(f.descKey, dictionary)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Per-representation type dropdown (line / bar / scatter)
// ============================================================================

const REP_TYPE_DEFS: {
  value: RepresentationType;
  labelKey: string;
  icon: React.ElementType;
}[] = [
  { value: "line",    labelKey: "dashboard.dashlets.chart.typeLine",    icon: CHART_ICON.line },
  { value: "bar",     labelKey: "dashboard.dashlets.chart.typeBar",     icon: CHART_ICON.bar },
  { value: "scatter", labelKey: "dashboard.dashlets.chart.typeScatter", icon: CHART_ICON.scatter },
];

interface RepTypeDropdownProps {
  value: RepresentationType;
  onChange: (t: RepresentationType) => void;
  dictionary: DashletSettingsProps<DashletConfig>["dictionary"];
}

function RepTypeDropdown({ value, onChange, dictionary }: Readonly<RepTypeDropdownProps>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeDef = REP_TYPE_DEFS.find((d) => d.value === value) ?? REP_TYPE_DEFS[0];
  const ActiveIcon = activeDef.icon;

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 cursor-pointer"
      >
        <ActiveIcon className="h-4 w-4 shrink-0" />
        <span>{trDynamic(activeDef.labelKey, dictionary)}</span>
        <HiChevronDown className={`h-3 w-3 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 w-36 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
          {REP_TYPE_DEFS.map((def) => {
            const Icon = def.icon;
            const isActive = value === def.value;
            return (
              <button
                key={def.value}
                type="button"
                onClick={() => { onChange(def.value); setOpen(false); }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${isActive ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"}`} />
                <span className={`font-medium ${isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-900 dark:text-white"}`}>
                  {trDynamic(def.labelKey, dictionary)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
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

  // Visualization state
  const [title, setTitle] = useState(config.title ?? "Chart v2");
  const [chartFamily, setChartFamily] = useState<ChartFamily>(config.chartFamily ?? "cartesian");
  const [xAxisColumn, setXAxisColumn] = useState(config.xAxisColumn ?? "");
  const [representations, setRepresentations] = useState<RepresentationItem[]>(
    toRepresentationItems(
      config.representations?.length
        ? config.representations
        : [{ columnKey: "", label: "", type: "bar" }]
    )
  );
  const [xAxisLabel, setXAxisLabel] = useState(config.xAxisLabel ?? "");
  const [yAxisLabel, setYAxisLabel] = useState(config.yAxisLabel ?? "");
  const [yAxisLabelRight, setYAxisLabelRight] = useState(config.yAxisLabelRight ?? "");
  const [showLegend, setShowLegend] = useState(config.showLegend ?? true);
  const [horizontal, setHorizontal] = useState(config.horizontal ?? false);
  const [dualYAxis, setDualYAxis] = useState(config.dualYAxis ?? false);
  const [customColors, setCustomColors] = useState<string[]>(config.customColors ?? []);
  const [xAxisDateFormat, setXAxisDateFormat] = useState<XAxisDateFormat>(
    config.xAxisDateFormat ?? "none"
  );
  const colorRules = useChartColorSettings({ valueColorRules: config.valueColorRules });
  const [tooltipTemplate, setTooltipTemplate] = useState(config.tooltipTemplate ?? "");

  // Data state
  const [dataMode, setDataMode] = useState<SimpleDataMode>(config.dataMode ?? "static");
  const [dataSourceId, setDataSourceId] = useState<string>(config.dataSourceId ?? "");
  const [plannerVariableName, setPlannerVariableName] = useState(
    config.plannerVariableName ?? ""
  );
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
    setRepresentations((prev) => {
      const reconciled = prev.map((r) =>
        r.columnKey && !keySet.has(r.columnKey) ? { ...r, columnKey: "", label: "" } : r
      );
      if (reconciled.every((r) => !r.columnKey) && keys.length >= 2) {
        return toRepresentationItems([{ columnKey: keys[1], label: keys[1], type: "bar" }]);
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
      if (!Array.isArray(parsed)) {
        setRowsError(tr("dashboard.settings.mustBeJsonArray", dictionary));
        return;
      }
      const isObjectArray = parsed.every(
        (item) => item !== null && typeof item === "object" && !Array.isArray(item)
      );
      if (!isObjectArray) {
        setRowsError(tr("dashboard.settings.mustBeJsonArray", dictionary));
        return;
      }
      setRowsError(null);
      reconcileColumns(
        parsed.length > 0
          ? Array.from(new Set(parsed.flatMap((r: Record<string, unknown>) => Object.keys(r))))
          : []
      );
    } catch {
      setRowsError(tr("dashboard.settings.invalidJson", dictionary));
    }
  };

  const columnOptions = useMemo(
    () => detectedColumns.map((k) => ({ value: k, label: k })),
    [detectedColumns]
  );

  // ── Family change ──────────────────────────────────────────────────────────

  const handleChartFamilyChange = (family: ChartFamily) => {
    setChartFamily(family);

    if (SINGLE_SERIES_FAMILIES.includes(family)) {
      setRepresentations((prev) => prev.slice(0, 1));
      setCustomColors((prev) => prev.slice(0, 1));
    }
  };

  // ── Representation CRUD ────────────────────────────────────────────────────

  const updateRepresentation = (id: string, patch: Partial<RepresentationConfig>) =>
    setRepresentations((prev) =>
      prev.map((r) => (r._id === id ? { ...r, ...patch } : r))
    );

  const addRepresentation = () => {
    const defaultType: RepresentationType = "bar";
    setRepresentations((prev) => [
      ...prev,
      ...toRepresentationItems([{ columnKey: "", label: "", type: defaultType }]),
    ]);
  };

  const removeRepresentation = (id: string) => {
    const index = representations.findIndex((r) => r._id === id);
    if (index >= 0) setCustomColors((prev) => prev.filter((_, i) => i !== index));
    setRepresentations((prev) => prev.filter((r) => r._id !== id));
  };

  const updateCustomColor = (index: number, color: string) =>
    setCustomColors((prev) => {
      const next = [...prev];
      next[index] = color;
      return next;
    });

  // ── Dirty tracking ─────────────────────────────────────────────────────────

  const isDirty = useSettingsDirty(isOpen, {
    title,
    chartFamily,
    xAxisColumn,
    representations,
    xAxisLabel,
    yAxisLabel,
    yAxisLabelRight,
    showLegend,
    horizontal,
    dualYAxis,
    customColors,
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

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = () => {
    let parsedRows = config.rows ?? [];
    if (dataMode === "static") {
      if (rowsError) return;
      try {
        const parsed = JSON.parse(rowsJson);
        if (!Array.isArray(parsed)) {
          setRowsError(tr("dashboard.settings.mustBeJsonArray", dictionary));
          return;
        }
        const isObjectArray = parsed.every(
          (item) => item !== null && typeof item === "object" && !Array.isArray(item)
        );
        if (!isObjectArray) {
          setRowsError(tr("dashboard.settings.mustBeJsonArray", dictionary));
          return;
        }
        parsedRows = parsed;
      } catch {
        setRowsError(tr("dashboard.settings.invalidJson", dictionary));
        return;
      }
    }

    onSave({
      title,
      chartFamily,
      xAxisColumn,
      representations: representations
        .filter((r) => r.columnKey)
        .map(({ _id: _, ...rest }) => rest),
      xAxisLabel,
      yAxisLabel,
      yAxisLabelRight: yAxisLabelRight || undefined,
      showLegend,
      horizontal,
      dualYAxis: dualYAxis || undefined,
      colorPalette: "custom",
      customColors,
      xAxisDateFormat: xAxisDateFormat === "none" ? undefined : xAxisDateFormat,
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

  const isCartesian = chartFamily === "cartesian";
  const isSingle = SINGLE_SERIES_FAMILIES.includes(chartFamily);
  const xAxisColumnLabel =
    chartFamily === "pie"
      ? tr("dashboard.settings.categoryColumn", dictionary)
      : tr("dashboard.settings.xAxisColumn", dictionary);

  // ===========================================================================
  // Visualization Tab
  // ===========================================================================

  const visualizationTab = (
    <div className="space-y-2">

      {/* ── General ───────────────────────────────────────────────── */}
      <ExpandableSection title={tr("dashboard.settings.sectionGeneral", dictionary)}>
        <HbTextField
          id="cv2-title"
          label={tr("common.title", dictionary)}
          value={title}
          onChange={setTitle}
          schemaSuggestions={schemaSuggestions}
        />
        <ChartFamilyPicker value={chartFamily} onChange={handleChartFamilyChange} dictionary={dictionary} />
      </ExpandableSection>

      {/* ── Data Mapping ──────────────────────────────────────────── */}
      <ExpandableSection title={tr("dashboard.settings.sectionDataMapping", dictionary)}>

        {/* X-axis column (not shown for gauge) */}
        {chartFamily !== "gauge" && (
          <div>
            <Label
              htmlFor="cv2-x-col"
              className="mb-1 block text-xs font-normal text-gray-500 dark:text-gray-400"
            >
              {xAxisColumnLabel}
            </Label>
            <Select
              id="cv2-x-col"
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

        {/* Representations */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label className="text-xs font-normal text-gray-500 dark:text-gray-400">
              {trDynamic("dashboard.dashlets.chart_v2.representations", dictionary)}
            </Label>
            {!isSingle && (
              <Button size="xs" color="light" onClick={addRepresentation}>
                {trDynamic("dashboard.dashlets.chart_v2.addRepresentation", dictionary)}
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {representations.map((rep, i) => (
              <div
                key={rep._id}
                className="rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700"
              >
                {/* Row 1: type toggle + column + label + color + delete */}
                <div className="flex items-center gap-2">
                  {isCartesian && (
                    <RepTypeDropdown
                      value={rep.type}
                      onChange={(t) => updateRepresentation(rep._id, { type: t })}
                      dictionary={dictionary}
                    />
                  )}
                  <Select
                    value={rep.columnKey}
                    onChange={(e) => updateRepresentation(rep._id, { columnKey: e.target.value })}
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
                    value={rep.label}
                    onChange={(v) => updateRepresentation(rep._id, { label: v })}
                    placeholder={tr("dashboard.settings.seriesLabel", dictionary)}
                    className="flex-1"
                    schemaSuggestions={schemaSuggestions}
                  />
                  <AdvancedColorPicker
                    value={(customColors[i] ?? "5470c6").replace(/^#/, "")}
                    onChange={(c) => updateCustomColor(i, `#${c}`)}
                    title={
                      rep.label ||
                      trDynamic("dashboard.dashlets.chart_v2.repNumber", dictionary, {
                        n: String(i + 1),
                      })
                    }
                  />
                  {representations.length > 1 && (
                    <DeleteItemButton
                      onClick={() => removeRepresentation(rep._id)}
                      ariaLabel={trDynamic(
                        "dashboard.dashlets.chart_v2.removeRepresentation",
                        dictionary
                      )}
                    />
                  )}
                </div>

                {/* Row 2: per-type inline toggles + axis selector (cartesian only) */}
                {isCartesian && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 pl-0.5">
                    {dualYAxis && (
                      <div className="flex gap-0.5 rounded border border-gray-200 p-0.5 dark:border-gray-600">
                        {([0, 1] as const).map((idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => updateRepresentation(rep._id, { yAxisIndex: idx })}
                            className={`rounded px-2 py-0.5 text-xs font-semibold transition-colors cursor-pointer ${
                              (rep.yAxisIndex ?? 0) === idx
                                ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
                                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            }`}
                          >
                            {idx === 0 ? "L" : "R"}
                          </button>
                        ))}
                      </div>
                    )}
                    {rep.type === "line" && (
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                        <ToggleSwitch
                          checked={rep.smooth ?? false}
                          onChange={(v) => updateRepresentation(rep._id, { smooth: v })}
                          label=""
                          sizing="sm"
                        />
                        {trDynamic("dashboard.dashlets.chart_v2.repSmooth", dictionary)}
                      </label>
                    )}
                    {(rep.type === "line" || rep.type === "bar") && (
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                        <ToggleSwitch
                          checked={rep.stacked ?? false}
                          onChange={(v) => updateRepresentation(rep._id, { stacked: v })}
                          label=""
                          sizing="sm"
                        />
                        {trDynamic("dashboard.dashlets.chart_v2.repStacked", dictionary)}
                      </label>
                    )}
                    {rep.type === "bar" && (
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                        <ToggleSwitch
                          checked={rep.showLabels ?? false}
                          onChange={(v) => updateRepresentation(rep._id, { showLabels: v })}
                          label=""
                          sizing="sm"
                        />
                        {trDynamic("dashboard.dashlets.chart_v2.repShowLabels", dictionary)}
                      </label>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </ExpandableSection>

      {/* ── Appearance ────────────────────────────────────────────── */}
      <ExpandableSection title={tr("dashboard.settings.sectionAppearance", dictionary)}>
        {isCartesian && (
          <>
            <SettingsFieldGrid cols={2}>
              <HbTextField
                id="cv2-x-label"
                label={tr("dashboard.settings.xAxisLabel", dictionary)}
                value={xAxisLabel}
                onChange={setXAxisLabel}
                schemaSuggestions={schemaSuggestions}
              />
              <HbTextField
                id="cv2-y-label"
                label={tr("dashboard.settings.yAxisLabel", dictionary)}
                value={yAxisLabel}
                onChange={setYAxisLabel}
                schemaSuggestions={schemaSuggestions}
              />
            </SettingsFieldGrid>
            {dualYAxis && (
              <HbTextField
                id="cv2-y-label-right"
                label={trDynamic("dashboard.dashlets.chart_v2.yAxisLabelRight", dictionary)}
                value={yAxisLabelRight}
                onChange={setYAxisLabelRight}
                schemaSuggestions={schemaSuggestions}
              />
            )}
          </>
        )}

        <SettingsToggleRow
          label={tr("dashboard.settings.showLegend", dictionary)}
          checked={showLegend}
          onChange={setShowLegend}
        />

        {isCartesian && representations.every((r) => r.type === "bar") && (
          <SettingsToggleRow
            label={tr("dashboard.settings.horizontalBars", dictionary)}
            checked={horizontal}
            onChange={setHorizontal}
          />
        )}

        {isCartesian && (
          <SettingsToggleRow
            label={trDynamic("dashboard.dashlets.chart_v2.dualYAxis", dictionary)}
            checked={dualYAxis}
            onChange={setDualYAxis}
          />
        )}

        {isCartesian && (
          <SettingsToggleRow
            label={tr("dashboard.settings.xAxisIsDate", dictionary)}
            checked={xAxisDateFormat !== "none"}
            onChange={(v) => setXAxisDateFormat(v ? "month" : "none")}
          />
        )}
      </ExpandableSection>

      {/* ── Colors & Rules ────────────────────────────────────────── */}
      <ExpandableSection
        title={tr("dashboard.settings.sectionColors", dictionary)}
        defaultOpen={false}
      >
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
      <ExpandableSection
        title={tr("dashboard.settings.sectionTooltip", dictionary)}
        defaultOpen={false}
      >
        <HbTextareaField
          id="cv2-tooltip-template"
          value={tooltipTemplate}
          onChange={setTooltipTemplate}
          placeholder={"{{row.name}}\n{{row.value}}"}
          rows={3}
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
        id="cv2-data-mode"
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
            id="cv2-rows-json"
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
