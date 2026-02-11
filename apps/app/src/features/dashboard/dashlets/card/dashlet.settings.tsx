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
import type { DashletConfig, CardBackgroundColor, CardIcon } from "./dashlet";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import {
  ColorPickerDropdown,
  type ColorOption,
} from "@/features/common/components/color-picker-dropdown";
import {
  IconPickerDropdown,
  type IconOption,
} from "@/features/common/components/icon-picker-dropdown";
import {
  SettingsTextField,
  SettingsPickerRow,
  SettingsPickerItem,
} from "../common";

/** Background color options for ColorPickerDropdown */
const BG_COLOR_OPTIONS: ColorOption<CardBackgroundColor>[] = [
  {
    value: "white",
    label: "White",
    dotClass: "bg-white border border-gray-300",
  },
  { value: "gray", label: "Gray", dotClass: "bg-gray-500" },
  { value: "blue", label: "Blue", dotClass: "bg-blue-500" },
  { value: "green", label: "Green", dotClass: "bg-green-500" },
  { value: "yellow", label: "Yellow", dotClass: "bg-yellow-500" },
  { value: "red", label: "Red", dotClass: "bg-red-500" },
  { value: "purple", label: "Purple", dotClass: "bg-purple-500" },
];

/** Icon options for IconPickerDropdown */
const ICON_OPTIONS: IconOption<CardIcon>[] = [
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
}: Readonly<DashletSettingsProps>) {
  const typedConfig = config as unknown as DashletConfig;
  const [name, setName] = useState(typedConfig.name || "Metric");
  const [value, setValue] = useState(typedConfig.value || "0");
  const [backgroundColor, setBackgroundColor] = useState<CardBackgroundColor>(
    typedConfig.backgroundColor || "white"
  );
  const [icon, setIcon] = useState<CardIcon>(typedConfig.icon || "chart");

  const handleSave = () => {
    onSave({
      name: name.trim() || "Metric",
      value: value.trim() || "0",
      backgroundColor,
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
          id="card-name"
          label="Label"
          value={name}
          onChange={setName}
          placeholder="Enter label..."
        />
        <SettingsTextField
          id="card-value"
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
              options={BG_COLOR_OPTIONS}
              value={backgroundColor}
              onChange={setBackgroundColor}
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
