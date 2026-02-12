"use client";

import { useState } from "react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig, GradientColor } from "./dashlet";
import {
  DashletSettingsWrapper,
  SettingsTitleValueUnit,
  SettingsPickerItem,
} from "../common";
import {
  ColorPickerDropdown,
  type ColorOption,
} from "@/features/common/components/color-picker-dropdown";

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
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const [title, setTitle] = useState(config.title || "Active Users");
  const [value, setValue] = useState(config.value || 2847);
  const [unit, setUnit] = useState(config.unit || "");
  const [color, setColor] = useState<GradientColor>(config.color || "blue");

  const handleSave = () => {
    onSave({ title, value, unit, color });
    onClose();
  };

  return (
    <DashletSettingsWrapper
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      dictionary={dictionary}
    >
      <SettingsTitleValueUnit
        title={title}
        onTitleChange={setTitle}
        value={value}
        onValueChange={setValue}
        unit={unit}
        onUnitChange={setUnit}
        dictionary={dictionary}
      />
      <SettingsPickerItem label="Color">
        <ColorPickerDropdown
          options={COLOR_OPTIONS}
          value={color}
          onChange={setColor}
          title="Select color"
        />
      </SettingsPickerItem>
    </DashletSettingsWrapper>
  );
}
