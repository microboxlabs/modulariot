"use client";

import { useState } from "react";
import { Label } from "flowbite-react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import {
  DashletSettingsWrapper,
  SettingsTextField,
  SettingsNumberField,
  SettingsFieldGrid,
} from "../common";
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
}: Readonly<DashletSettingsProps>) {
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

  return (
    <DashletSettingsWrapper
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
    >
      <SettingsTextField
        id="title"
        label="Title"
        value={title}
        onChange={setTitle}
      />
      <SettingsFieldGrid cols={2}>
        <SettingsNumberField
          id="value"
          label="Value"
          value={value}
          onChange={setValue}
        />
        <SettingsTextField
          id="unit"
          label="Unit"
          value={unit}
          onChange={setUnit}
        />
      </SettingsFieldGrid>
      <div className="flex items-center gap-2">
        <Label className="text-sm">Color</Label>
        <ColorPickerDropdown
          options={COLOR_OPTIONS}
          value={color}
          onChange={setColor}
          title="Select color"
        />
      </div>
    </DashletSettingsWrapper>
  );
}
