"use client";

import { useState } from "react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig, GradientColor } from "./dashlet";
import { SimpleDashletSettings, SettingsPickerItem } from "../common";
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

const FIELDS = [
  { id: "sg-title", labelKey: "common.title", state: "title", hbPlaceholder: "{{row.label}}", staticPlaceholder: "Active Users" },
  { id: "sg-value", labelKey: "common.value", state: "value", hbPlaceholder: "{{row.count}}", staticPlaceholder: "2847" },
  { id: "sg-unit", labelKey: "common.unit", state: "unit", hbPlaceholder: "{{row.unit}}", staticPlaceholder: "" },
] as const;

export function DashletSettings(
  props: Readonly<DashletSettingsProps<DashletConfig>>,
) {
  const [color, setColor] = useState<GradientColor>(
    props.config.color || "blue",
  );

  return (
    <SimpleDashletSettings
      fields={FIELDS}
      idPrefix="sg"
      settingsProps={props}
      thresholds
      extraSaveFields={{ color }}
      extraVisualization={
        <SettingsPickerItem label="Color">
          <ColorPickerDropdown
            options={COLOR_OPTIONS}
            value={color}
            onChange={setColor}
            title="Select color"
          />
        </SettingsPickerItem>
      }
    />
  );
}
