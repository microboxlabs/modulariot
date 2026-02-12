"use client";

import { useState } from "react";
import { Button } from "flowbite-react";
import {
  HiChartBar,
  HiCurrencyDollar,
  HiUsers,
  HiShoppingCart,
  HiClock,
  HiCheckCircle,
} from "react-icons/hi2";
import { createPortal } from "react-dom";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig, ColorTheme, IconType } from "./dashlet";
import {
  ColorPickerDropdown,
  type ColorOption,
} from "@/features/common/components/color-picker-dropdown";
import {
  IconPickerDropdown,
  type IconOption,
} from "@/features/common/components/icon-picker-dropdown";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import {
  SettingsTextField,
  SettingsPickerRow,
  SettingsPickerItem,
} from "../common";

/** Color options for ColorPickerDropdown */
const COLOR_OPTIONS: ColorOption<ColorTheme>[] = [
  { value: "gray", label: "Gray", dotClass: "bg-gray-500" },
  { value: "blue", label: "Blue", dotClass: "bg-blue-500" },
  { value: "green", label: "Green", dotClass: "bg-green-500" },
  { value: "yellow", label: "Yellow", dotClass: "bg-yellow-500" },
  { value: "red", label: "Red", dotClass: "bg-red-500" },
  { value: "purple", label: "Purple", dotClass: "bg-purple-500" },
  { value: "teal", label: "Teal", dotClass: "bg-teal-500" },
  { value: "orange", label: "Orange", dotClass: "bg-orange-500" },
];

/** Icon options for IconPickerDropdown */
const ICON_OPTIONS: IconOption<IconType>[] = [
  { value: "chart", label: "Chart", icon: HiChartBar },
  { value: "currency", label: "Currency", icon: HiCurrencyDollar },
  { value: "users", label: "Users", icon: HiUsers },
  { value: "cart", label: "Cart", icon: HiShoppingCart },
  { value: "clock", label: "Clock", icon: HiClock },
  { value: "check", label: "Check", icon: HiCheckCircle },
];

/**
 * Settings Modal
 */
export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const [name, setName] = useState(config.name || "Metric");
  const [value, setValue] = useState(config.value || "0");
  const [color, setColor] = useState<ColorTheme>(config.color || "gray");
  const [icon, setIcon] = useState<IconType>(config.icon || "chart");

  const handleSave = () => {
    onSave({
      name: name.trim() || "Metric",
      value: value.trim() || "0",
      color,
      icon,
    });
    onClose();
  };

  if (globalThis.window === undefined) return null;

  const modalContent = (
    <AbsoluteModal
      selected={isOpen}
      setSelected={(selected) => {
        if (!selected) onClose();
      }}
      className="no-drag w-72 gap-4 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex w-full flex-col gap-3">
        <SettingsTextField
          id="dashlet-name"
          label="Label"
          value={name}
          onChange={setName}
          placeholder="Enter label..."
        />
        <SettingsTextField
          id="dashlet-value"
          label="Value"
          value={value}
          onChange={setValue}
          placeholder="Enter value..."
        />
        <SettingsPickerRow>
          <SettingsPickerItem label="Icon">
            <IconPickerDropdown
              options={ICON_OPTIONS}
              value={icon}
              onChange={setIcon}
              title="Select icon"
            />
          </SettingsPickerItem>
          <SettingsPickerItem label="Color">
            <ColorPickerDropdown
              options={COLOR_OPTIONS}
              value={color}
              onChange={setColor}
              title="Select color"
            />
          </SettingsPickerItem>
        </SettingsPickerRow>

        {/* Save Button */}
        <Button onClick={handleSave} size="sm" className="w-full">
          Save
        </Button>
      </div>
    </AbsoluteModal>
  );

  return createPortal(modalContent, document.body);
}
