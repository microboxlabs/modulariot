"use client";

import { useState } from "react";
import { Button, TextInput, Label, ToggleSwitch } from "flowbite-react";
import { HiPlus, HiTrash } from "react-icons/hi2";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig, BarColor } from "./dashlet";
import {
  HbTextFieldList,
  PgrestDataTab,
  useSimplePgrestSettings,
} from "../common";
import { SettingsModalShell } from "../common/settings-modal-shell";
import {
  ColorPickerDropdown,
  type ColorOption,
} from "@/features/common/components/color-picker-dropdown";

const COLOR_OPTIONS: ColorOption<BarColor>[] = [
  {
    value: "bg-blue-500 dark:bg-blue-400",
    label: "Blue",
    dotClass: "bg-blue-500",
  },
  {
    value: "bg-green-500 dark:bg-green-400",
    label: "Green",
    dotClass: "bg-green-500",
  },
  {
    value: "bg-yellow-500 dark:bg-yellow-400",
    label: "Yellow",
    dotClass: "bg-yellow-500",
  },
  {
    value: "bg-purple-500 dark:bg-purple-400",
    label: "Purple",
    dotClass: "bg-purple-500",
  },
  { value: "bg-red-500 dark:bg-red-400", label: "Red", dotClass: "bg-red-500" },
  {
    value: "bg-cyan-500 dark:bg-cyan-400",
    label: "Cyan",
    dotClass: "bg-cyan-500",
  },
];

interface StackItem {
  id: string;
  label: string;
  value: number;
  color: BarColor;
}

const FIELDS = [
  { id: "st-title", labelKey: "common.title", state: "title", hbPlaceholder: "{{row.label}}", staticPlaceholder: "Traffic Sources" },
  { id: "st-unit", labelKey: "common.unit", state: "unit", hbPlaceholder: "{{row.unit}}", staticPlaceholder: "%" },
] as const;

const FIELD_NAMES = ["title", "unit"] as const;

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const [title, setTitle] = useState(config.title || "Traffic Sources");
  const [unit, setUnit] = useState(config.unit ?? "%");
  const [showHeader, setShowHeader] = useState(config.showHeader ?? true);

  // Initialize items with unique IDs
  const initializeItems = (): StackItem[] => {
    const defaultItems: Omit<StackItem, "id">[] = [
      { label: "Direct", value: 45, color: "bg-blue-500 dark:bg-blue-400" },
      { label: "Organic", value: 30, color: "bg-green-500 dark:bg-green-400" },
    ];
    return (config.items || defaultItems).map((item, i) => ({
      ...item,
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
    pg,
    handleDataModeChange,
    pgrestSaveFields,
  } = useSimplePgrestSettings({
    config,
    fieldNames: FIELD_NAMES,
    fieldValues,
    fieldSetters,
  });

  const handleSave = () => {
    const itemsToSave = items.map(({ label, value, color }) => ({
      label,
      value,
      color,
    }));
    onSave({
      title: title.trim() || "Traffic Sources",
      items: itemsToSave,
      unit: unit.trim() || "%",
      showHeader,
      ...pgrestSaveFields,
    });
    onClose();
  };

  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

  const addItem = () =>
    setItems([
      ...items,
      {
        id: `item-${Date.now()}`,
        label: "",
        value: 0,
        color: "bg-blue-500 dark:bg-blue-400",
      },
    ]);

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

      <HbTextFieldList
        fields={FIELDS}
        fieldValues={fieldValues}
        fieldSetters={fieldSetters}
        isPgrest={isPgrest}
        dictionary={dictionary}
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
            <TextInput
              value={item.label}
              onChange={(e) => updateItem(item.id, "label", e.target.value)}
              placeholder="Label"
              sizing="sm"
              className="flex-1"
            />
            <TextInput
              type="number"
              value={item.value}
              onChange={(e) =>
                updateItem(item.id, "value", Number(e.target.value))
              }
              sizing="sm"
              className="w-16"
            />
            <ColorPickerDropdown
              options={COLOR_OPTIONS}
              value={item.color}
              onChange={(c) => updateItem(item.id, "color", c)}
              title="Color"
            />
            <Button
              size="xs"
              color="failure"
              onClick={() => removeItem(item.id)}
              onMouseDown={handleMouseDown}
              className="no-drag"
            >
              <HiTrash className="h-3 w-3" />
            </Button>
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
    />
  );
}
