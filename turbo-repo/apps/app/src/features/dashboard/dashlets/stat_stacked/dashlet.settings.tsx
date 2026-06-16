"use client";

import { useState } from "react";
import { Button, Label, ToggleSwitch } from "flowbite-react";
import { HiPlus } from "react-icons/hi2";
import { ReactSortable } from "react-sortablejs";
import { twMerge } from "tailwind-merge";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig, ChartType } from "./dashlet";
import { HbTextFieldList, HbInlineInput } from "../common/settings-fields";
import { PgrestDataTab } from "../common/pgrest-data-tab";
import { useSimplePgrestSettings } from "../common/use-simple-pgrest-settings";
import { useThresholdSettings } from "../common/use-threshold-settings";
import { ThresholdEditor } from "../common/threshold-editor";
import { DeleteItemButton } from "../common/delete-item-button";
import { usePlannerContext } from "../../context/planner-context";
import { useDashboardFilterSuggestions } from "../common/use-filter-suggestions";
import { useWidgetRefreshSettings } from "../common/use-widget-refresh-settings";
import { SettingsShell, buildStandardTabs } from "../common/settings-shell";
import { useSettingsDirty } from "../common/use-settings-dirty";
import { tr } from "@/features/i18n/tr.service";
import { AdvancedColorPicker } from "@/features/common/components/advanced-color-picker";

/** Default color palette for cycling through new items */
const DEFAULT_COLORS = [
  "3b82f6", // Blue
  "22c55e", // Green
  "eab308", // Yellow
  "a855f7", // Purple
  "ef4444", // Red
  "06b6d4", // Cyan
  "f97316", // Orange
  "ec4899", // Pink
];

interface StackItem {
  id: string;
  label: string;
  value: string;
  color: string;
}

const FIELDS = [
  {
    id: "st-title",
    labelKey: "common.title",
    state: "title",
    hbPlaceholder: "{{row.label}}",
    staticPlaceholder: "Traffic Sources",
  },
  {
    id: "st-unit",
    labelKey: "common.unit",
    state: "unit",
    hbPlaceholder: "{{row.unit}}",
    staticPlaceholder: "",
  },
] as const;

const FIELD_NAMES = ["title", "unit"] as const;

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
  dashletName,
  widgetId,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const refresh = useWidgetRefreshSettings(config, dictionary);
  const { schemas } = usePlannerContext();
  const filterSuggestions = useDashboardFilterSuggestions();
  const [title, setTitle] = useState(config.title || "Traffic Sources");
  const [unit, setUnit] = useState(config.unit ?? "");
  const [showHeader, setShowHeader] = useState(config.showHeader ?? true);
  const [chartType, setChartType] = useState<ChartType>(
    config.chartType ?? "bar"
  );

  // Initialize items with unique IDs
  const initializeItems = (): StackItem[] => {
    const defaultItems: Omit<StackItem, "id">[] = [
      { label: "Direct", value: "45", color: "3b82f6" },
      { label: "Organic", value: "30", color: "22c55e" },
      { label: "Referral", value: "15", color: "eab308" },
      { label: "Social", value: "10", color: "a855f7" },
    ];
    return (config.items || defaultItems).map((item, i) => ({
      ...item,
      value: String(item.value),
      id: `item-${Date.now()}-${i}`,
    }));
  };

  const [items, setItems] = useState(initializeItems);
  const threshold = useThresholdSettings(config);

  const fieldValues = { title, unit };
  const fieldSetters = { title: setTitle, unit: setUnit };

  const {
    isPgrest,
    activeProviders,
    dataMode,
    dataSourceId,
    setDataSourceId,
    plannerVariableName,
    setPlannerVariableName,
    pg,
    handleDataModeChange,
    pgrestSaveFields,
  } = useSimplePgrestSettings({
    config,
    fieldNames: FIELD_NAMES,
    fieldValues,
    fieldSetters,
  });

  const schemaSuggestions =
    dataMode === "planner" && plannerVariableName
      ? schemas.get(plannerVariableName)
      : undefined;

  const isDirty = useSettingsDirty(isOpen, {
    title,
    items,
    unit,
    showHeader,
    chartType,
    pgrestSaveFields,
    refreshValue: refresh.value,
    thresholdState: threshold.thresholdEnabled,
    thresholdField: threshold.thresholdField,
    thresholdApplyTo: threshold.thresholdApplyTo,
    thresholdRules: threshold.thresholdRules,
  });

  const handleSave = () => {
    const itemsToSave = items.map(({ label, value, color }) => ({
      label: label.trim(),
      value: value.trim(),
      color,
    }));
    onSave({
      title: title.trim() || "Traffic Sources",
      items: itemsToSave,
      unit: unit.trim(),
      showHeader,
      chartType,
      ...pgrestSaveFields,
      ...refresh.savePayload,
      ...threshold.buildThresholdSavePayload(),
    });
    onClose();
  };

  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

  const addItem = () => {
    const nextColor = DEFAULT_COLORS[items.length % DEFAULT_COLORS.length];
    setItems([
      ...items,
      {
        id: `item-${Date.now()}`,
        label: "",
        value: "0",
        color: nextColor,
      },
    ]);
  };

  const removeItem = (id: string) =>
    setItems(items.filter((item) => item.id !== id));

  const updateItem = <K extends keyof StackItem>(
    id: string,
    field: K,
    val: StackItem[K]
  ) => {
    setItems(
      items.map((item) => (item.id === id ? { ...item, [field]: val } : item))
    );
  };

  const visualizationTab = (
    <>
      <div className="flex items-center justify-between py-1">
        <Label className="text-sm font-medium">Show Header</Label>
        <div className="shrink-0">
          <ToggleSwitch
            checked={showHeader}
            onChange={setShowHeader}
            sizing="sm"
          />
        </div>
      </div>

      {/* Chart Type Toggle */}
      <div className="space-y-1 py-1">
        <Label className="text-sm font-medium">
          {tr("dashboard.settings.chartType", dictionary)}
        </Label>
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
          <button
            type="button"
            onClick={() => setChartType("bar")}
            className={twMerge(
              "flex-1 px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
              chartType === "bar"
                ? "bg-primary-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            )}
          >
            {tr("dashboard.settings.bar", dictionary)}
          </button>
          <button
            type="button"
            onClick={() => setChartType("donut")}
            className={twMerge(
              "flex-1 px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
              chartType === "donut"
                ? "bg-primary-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            )}
          >
            {tr("dashboard.settings.donut", dictionary)}
          </button>
        </div>
      </div>

      <HbTextFieldList
        fields={FIELDS}
        fieldValues={fieldValues}
        fieldSetters={fieldSetters}
        isPgrest={isPgrest}
        dictionary={dictionary}
        schemaSuggestions={schemaSuggestions}
        filterSuggestions={filterSuggestions}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Categories</Label>
          <Button
            size="xs"
            color="light"
            onClick={addItem}
            onMouseDown={handleMouseDown}
            className="no-drag"
          >
            <HiPlus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>
        <ReactSortable
          list={items}
          setList={setItems}
          animation={150}
          handle=".drag-handle"
          className="space-y-2"
        >
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700"
            >
              <button
                type="button"
                className="drag-handle shrink-0 cursor-grab p-0.5 text-gray-400 hover:text-gray-600 active:cursor-grabbing dark:text-gray-500 dark:hover:text-gray-300"
                aria-label="Drag to reorder"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="h-3.5 w-3.5"
                >
                  <path
                    fillRule="evenodd"
                    d="M2 3.75A.75.75 0 0 1 2.75 3h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 3.75ZM2 8a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8Zm0 4.25a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              <HbInlineInput
                value={item.label}
                onChange={(v) => updateItem(item.id, "label", v)}
                placeholder={
                  isPgrest
                    ? "{{row.label}}"
                    : tr("dashboard.settings.label", dictionary)
                }
                className="flex-1"
                schemaSuggestions={schemaSuggestions}
                filterSuggestions={filterSuggestions}
                aria-label={tr(
                  "dashboard.settings.categoryAriaLabel",
                  dictionary,
                  {
                    name:
                      item.label || tr("dashboard.settings.new", dictionary),
                    field: tr("dashboard.settings.label", dictionary),
                  }
                )}
              />
              <HbInlineInput
                value={item.value}
                onChange={(v) => updateItem(item.id, "value", v)}
                placeholder={isPgrest ? "{{row.value}}" : "0"}
                className="w-20"
                schemaSuggestions={schemaSuggestions}
                filterSuggestions={filterSuggestions}
                aria-label={tr(
                  "dashboard.settings.categoryAriaLabel",
                  dictionary,
                  {
                    name:
                      item.label || tr("dashboard.settings.new", dictionary),
                    field: tr("common.value", dictionary),
                  }
                )}
              />
              <AdvancedColorPicker
                value={item.color}
                onChange={(c) => updateItem(item.id, "color", c)}
                title="Color"
              />
              <DeleteItemButton
                onClick={() => removeItem(item.id)}
                ariaLabel={tr("dashboard.settings.deleteItem", dictionary)}
              />
            </div>
          ))}
        </ReactSortable>
      </div>
      <ThresholdEditor
        enabled={threshold.thresholdEnabled}
        onToggle={threshold.setThresholdEnabled}
        field={threshold.thresholdField}
        onFieldChange={threshold.setThresholdField}
        applyTo={threshold.thresholdApplyTo}
        onApplyToChange={threshold.setThresholdApplyTo}
        rules={threshold.thresholdRules}
        onAdd={threshold.addThresholdRule}
        onRemove={threshold.removeThresholdRule}
        onUpdate={threshold.updateThresholdRule}
        schemaSuggestions={schemaSuggestions}
        dictionary={dictionary}
      />
    </>
  );

  const dataTab = (
    <PgrestDataTab
      id="st-data-mode"
      dataMode={dataMode}
      onDataModeChange={handleDataModeChange}
      pgrest={pg}
      dictionary={dictionary}
      plannerVariableName={plannerVariableName}
      onPlannerVariableNameChange={setPlannerVariableName}
      dataSourceId={dataSourceId}
      onDataSourceIdChange={setDataSourceId}
      activeProviders={activeProviders}
    />
  );

  return (
    <SettingsShell
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      dictionary={dictionary}
      tabs={buildStandardTabs(dictionary, visualizationTab, dataTab)}
      footer={refresh.selectNode}
      title={dashletName}
      widgetId={widgetId}
      isDirty={isDirty}
    />
  );
}
