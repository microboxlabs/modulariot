"use client";

import { useState } from "react";
import { Button, TextInput, Label } from "flowbite-react";
import { createPortal } from "react-dom";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import {
  ColorPickerDropdown,
  type ColorOption,
} from "@/features/common/components/color-picker-dropdown";

type GradientColor = "blue" | "green" | "red" | "yellow" | "purple";

const COLOR_OPTIONS: ColorOption<GradientColor>[] = [
  { value: "blue", label: "Blue", dotClass: "bg-blue-500" },
  { value: "green", label: "Green", dotClass: "bg-green-500" },
  { value: "red", label: "Red", dotClass: "bg-red-500" },
  { value: "yellow", label: "Yellow", dotClass: "bg-yellow-500" },
  { value: "purple", label: "Purple", dotClass: "bg-purple-500" },
];

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
}: DashletSettingsProps) {
  const typedConfig = config as unknown as DashletConfig;
  const [title, setTitle] = useState(typedConfig.title || "Active Users");
  const [value, setValue] = useState(typedConfig.value || 2847);
  const [unit, setUnit] = useState(typedConfig.unit || "");
  const [color, setColor] = useState<GradientColor>(
    typedConfig.color || "blue"
  );

  const handleSave = () => {
    onSave({ title, value, unit, color });
    onClose();
  };

  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

  if (globalThis.window === undefined) return null;

  return createPortal(
    <AbsoluteModal
      selected={isOpen}
      setSelected={(s) => !s && onClose()}
      className="no-drag w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex flex-col gap-3">
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
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="value" className="mb-1 block text-sm">
              Value
            </Label>
            <TextInput
              id="value"
              type="number"
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
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
        <div className="flex items-center gap-2">
          <Label className="text-sm">Color</Label>
          <ColorPickerDropdown
            options={COLOR_OPTIONS}
            value={color}
            onChange={setColor}
            title="Select color"
          />
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
