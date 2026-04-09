"use client";

import { useState } from "react";
import { Button, Label, ToggleSwitch } from "flowbite-react";
import { HiPlus, HiTrash } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig, BarColor, ChartType } from "./dashlet";
import {
  HbTextFieldList,
  HbInlineInput,
  PgrestDataTab,
  useSimplePgrestSettings,
} from "../common";
import { usePlannerContext } from "../../context/planner-context";
import {
  SettingsModalShell,
  useWidgetRefreshSettings,
} from "../common/settings-modal-shell";
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
  color: BarColor;
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
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const refresh = useWidgetRefreshSettings(config, dictionary);
  const { schemas } = usePlannerContext();
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
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700"
          >
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
              aria-label={tr(
                "dashboard.settings.categoryAriaLabel",
                dictionary,
                {
                  name: item.label || tr("dashboard.settings.new", dictionary),
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
              aria-label={tr(
                "dashboard.settings.categoryAriaLabel",
                dictionary,
                {
                  name: item.label || tr("dashboard.settings.new", dictionary),
                  field: tr("common.value", dictionary),
                }
              )}
            />
            <AdvancedColorPicker
              value={item.color}
              onChange={(c) => updateItem(item.id, "color", c)}
              title="Color"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeItem(item.id);
              }}
              onMouseDown={handleMouseDown}
              className="no-drag cursor-pointer rounded p-1.5 text-gray-400 hover:text-red-500 transition-colors"
            >
              <HiTrash className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
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
    <SettingsModalShell
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      dictionary={dictionary}
      visualizationTab={visualizationTab}
      dataTab={dataTab}
      refreshSelect={refresh.selectNode}
    />
  );
}
