"use client";

import { useState } from "react";
import { Button, TextInput, Label } from "flowbite-react";
import { HiPlus, HiTrash } from "react-icons/hi2";
import { createPortal } from "react-dom";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
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

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
}: DashletSettingsProps) {
  const typedConfig = config as unknown as DashletConfig;
  const [title, setTitle] = useState(typedConfig.title || "Traffic Sources");
  const [unit, setUnit] = useState(typedConfig.unit || "%");
  const [items, setItems] = useState(
    typedConfig.items || [
      { label: "Direct", value: 45, color: "bg-blue-500" },
      { label: "Organic", value: 30, color: "bg-green-500" },
    ]
  );

  const handleSave = () => {
    onSave({ title, items, unit });
    onClose();
  };

  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

  const addItem = () =>
    setItems([...items, { label: "", value: 0, color: "bg-blue-500" }]);
  const removeItem = (i: number) =>
    setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, val: string | number) => {
    setItems(
      items.map((item, idx) => (idx === i ? { ...item, [field]: val } : item))
    );
  };

  if (typeof globalThis.window === "undefined") return null;

  return createPortal(
    <AbsoluteModal
      selected={isOpen}
      setSelected={(s) => !s && onClose()}
      className="no-drag w-80 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="title" className="mb-1 block text-sm">
              Title
            </Label>
            <TextInput
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              sizing="sm"
            />
          </div>
          <div>
            <Label htmlFor="unit" className="mb-1 block text-sm">
              Unit
            </Label>
            <TextInput
              id="unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              sizing="sm"
            />
          </div>
        </div>

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
          {items.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700"
            >
              <TextInput
                value={item.label}
                onChange={(e) => updateItem(i, "label", e.target.value)}
                placeholder="Label"
                sizing="sm"
                className="flex-1"
              />
              <TextInput
                type="number"
                value={item.value}
                onChange={(e) => updateItem(i, "value", Number(e.target.value))}
                sizing="sm"
                className="w-16"
              />
              <ColorPickerDropdown
                options={COLOR_OPTIONS}
                value={item.color as BarColor}
                onChange={(c) => updateItem(i, "color", c)}
                title="Color"
              />
              <Button
                size="xs"
                color="failure"
                onClick={() => removeItem(i)}
                onMouseDown={handleMouseDown}
                className="no-drag"
              >
                <HiTrash className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            color="gray"
            onClick={onClose}
            onMouseDown={handleMouseDown}
            size="sm"
            className="no-drag w-full"
          >
            Cancel
          </Button>
          <Button
            color="blue"
            onClick={handleSave}
            onMouseDown={handleMouseDown}
            size="sm"
            className="no-drag w-full"
          >
            Save
          </Button>
        </div>
      </div>
    </AbsoluteModal>,
    document.body
  );
}
