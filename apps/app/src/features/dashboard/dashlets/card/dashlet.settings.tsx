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
import { twMerge } from "tailwind-merge";
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
  SettingsSelectField,
  HbTextField,
  usePgrestSettingsState,
  PgrestSettingsSection,
  fromPgrestParamItems,
  humanizeKey,
} from "../common";

type SettingsTab = "visualization" | "data";
type CardDataMode = "static" | "pgrest";

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

const PGREST_LABELS = {
  functionName: "Function Name",
  httpMethod: "HTTP Method",
  parameters: "Parameters",
  key: "Key",
  value: "Value",
  addParameter: "Add Parameter",
};

/**
 * Settings Modal
 */
export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("visualization");
  const [name, setName] = useState(config.name || "Metric");
  const [value, setValue] = useState(config.value || "0");
  const [descriptor, setDescriptor] = useState(config.descriptor || "");
  const [backgroundColor, setBackgroundColor] = useState<CardBackgroundColor>(
    config.backgroundColor || "white"
  );
  const [icon, setIcon] = useState<CardIcon>(config.icon || "chart");
  const [dataMode, setDataMode] = useState<CardDataMode>(
    config.dataMode || "static"
  );

  const pg = usePgrestSettingsState({
    pgrestFunctionName: config.pgrestFunctionName || "",
    pgrestParams: config.pgrestParams || [],
    pgrestHttpMethod: config.pgrestHttpMethod || "POST",
    onColumnsDetected: (keys) =>
      keys.map((key, i) => ({
        _id: `col-${Date.now()}-${i}`,
        key,
        label: humanizeKey(key),
        type: "text" as const,
      })),
    setColumns: () => {},
    onDetectionComplete: (detected) => {
      // Auto-fill name/value/descriptor with first detected keys
      if (detected.length >= 1) {
        setName(`{{row.${detected[0].key}}}`);
      }
      if (detected.length >= 2) {
        setValue(`{{row.${detected[1].key}}}`);
      }
      if (detected.length >= 3) {
        setDescriptor(`{{row.${detected[2].key}}}`);
      }
    },
  });

  const handleSave = () => {
    onSave({
      name: name.trim() || "Metric",
      value: value.trim() || "0",
      descriptor: descriptor.trim(),
      backgroundColor,
      icon,
      dataMode,
      pgrestFunctionName: pg.pgrestFunctionName,
      pgrestParams: fromPgrestParamItems(pg.pgrestParams),
      pgrestHttpMethod: pg.pgrestHttpMethod,
    });
    onClose();
  };

  if (globalThis.window === undefined) return null;

  const tabClass = (tab: SettingsTab) =>
    twMerge(
      "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
      activeTab === tab
        ? "border-blue-500 text-blue-600 dark:text-blue-400"
        : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400",
    );

  const isPgrest = dataMode === "pgrest";

  const modalContent = (
    <AbsoluteModal
      selected={isOpen}
      setSelected={(selected) => {
        if (!selected) onClose();
      }}
      className="no-drag w-96 gap-4 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex w-full max-h-[75vh] flex-col gap-3">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setActiveTab("visualization")}
            className={tabClass("visualization")}
          >
            Visualization
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("data")}
            className={tabClass("data")}
          >
            Data Provider
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 space-y-3 overflow-y-auto">
          {activeTab === "visualization" ? (
            <>
              {isPgrest ? (
                <>
                  <HbTextField
                    id="card-name"
                    label="Label"
                    value={name}
                    onChange={setName}
                    placeholder="{{row.metric_name}}"
                  />
                  <HbTextField
                    id="card-value"
                    label="Value"
                    value={value}
                    onChange={setValue}
                    placeholder="{{row.total}}"
                  />
                  <HbTextField
                    id="card-descriptor"
                    label="Descriptor"
                    value={descriptor}
                    onChange={setDescriptor}
                    placeholder="{{row.unit}}"
                  />
                </>
              ) : (
                <>
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
                  <SettingsTextField
                    id="card-descriptor"
                    label="Descriptor"
                    value={descriptor}
                    onChange={setDescriptor}
                    placeholder="Enter descriptor..."
                  />
                </>
              )}
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
            </>
          ) : (
            <>
              <SettingsSelectField
                id="card-data-mode"
                label="Data Source"
                value={dataMode}
                onChange={(v) => setDataMode(v as CardDataMode)}
                options={[
                  { value: "static", label: "Static" },
                  { value: "pgrest", label: "PGREST" },
                ]}
              />
              {isPgrest && (
                <PgrestSettingsSection pgrest={pg} labels={PGREST_LABELS} />
              )}
            </>
          )}
        </div>

        {/* Save Button */}
        <Button onClick={handleSave} size="sm" className="w-full">
          Save
        </Button>
      </div>
    </AbsoluteModal>
  );

  return createPortal(modalContent, document.body);
}
