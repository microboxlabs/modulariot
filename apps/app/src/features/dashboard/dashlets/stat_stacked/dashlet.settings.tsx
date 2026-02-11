"use client";

import { useState } from "react";
import { Button, TextInput, Label } from "flowbite-react";
import { HiPlus, HiTrash } from "react-icons/hi2";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import {
  DashletSettingsWrapper,
  SettingsTextField,
  SettingsFieldGrid,
} from "../common";
import {
  ColorPickerDropdown,
  type ColorOption,
} from "@/features/common/components/color-picker-dropdown";

type BarColor =
  | "bg-blue-500"
  | "bg-green-500"
  | "bg-yellow-500"
  | "bg-purple-500"
  | "bg-red-500"
  | "bg-cyan-500";

const COLOR_OPTIONS: ColorOption<BarColor>[] = [
  { value: "bg-blue-500", label: "Blue", dotClass: "bg-blue-500" },
  { value: "bg-green-500", label: "Green", dotClass: "bg-green-500" },
  { value: "bg-yellow-500", label: "Yellow", dotClass: "bg-yellow-500" },
  { value: "bg-purple-500", label: "Purple", dotClass: "bg-purple-500" },
  { value: "bg-red-500", label: "Red", dotClass: "bg-red-500" },
  { value: "bg-cyan-500", label: "Cyan", dotClass: "bg-cyan-500" },
];

interface StackItem {
  id: string;
  label: string;
  value: number;
  color: string;
}

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
}: DashletSettingsProps) {
  const typedConfig = config as unknown as DashletConfig;
  const [title, setTitle] = useState(typedConfig.title || "Traffic Sources");
  const [unit, setUnit] = useState(typedConfig.unit || "%");

  // Initialize items with unique IDs
  const initializeItems = (): StackItem[] => {
    const defaultItems = [
      { label: "Direct", value: 45, color: "bg-blue-500" },
      { label: "Organic", value: 30, color: "bg-green-500" },
    ];
    return (typedConfig.items || defaultItems).map((item, i) => ({
      ...item,
      id: `item-${Date.now()}-${i}`,
    }));
  };

  const [items, setItems] = useState(initializeItems);

  const handleSave = () => {
    const itemsToSave = items.map(({ label, value, color }) => ({
      label,
      value,
      color,
    }));
    onSave({ title, items: itemsToSave, unit });
    onClose();
  };

  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

  const addItem = () =>
    setItems([
      ...items,
      { id: `item-${Date.now()}`, label: "", value: 0, color: "bg-blue-500" },
    ]);

  const removeItem = (id: string) =>
    setItems(items.filter((item) => item.id !== id));

  const updateItem = (id: string, field: string, val: string | number) => {
    setItems(
      items.map((item) => (item.id === id ? { ...item, [field]: val } : item))
    );
  };

  return (
    <DashletSettingsWrapper
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      width="w-80"
      scrollable
    >
      <SettingsFieldGrid cols={2}>
        <SettingsTextField
          id="title"
          label="Title"
          value={title}
          onChange={setTitle}
        />
        <SettingsTextField
          id="unit"
          label="Unit"
          value={unit}
          onChange={setUnit}
        />
      </SettingsFieldGrid>

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
              value={item.color as BarColor}
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
    </DashletSettingsWrapper>
  );
}
