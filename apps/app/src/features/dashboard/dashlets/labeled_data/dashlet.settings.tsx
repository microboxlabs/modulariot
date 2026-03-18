"use client";

import { useState } from "react";
import { Button } from "flowbite-react";
import { createPortal } from "react-dom";
import { twMerge } from "tailwind-merge";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig, ColorTheme, IconType } from "./dashlet";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import {
  ColorPickerDropdown,
  type ColorOption,
} from "@/features/common/components/color-picker-dropdown";
import { IconPickerDropdown } from "@/features/common/components/icon-picker-dropdown";
import { tr } from "@/features/i18n/tr.service";
import {
  SettingsPickerRow,
  SettingsPickerItem,
  HbTextField,
  usePgrestSettingsState,
  PgrestDataTab,
  fromPgrestParamItems,
  humanizeKey,
} from "../common";
import { DASHLET_ICON_OPTIONS } from "../common/icon-options";

type SettingsTab = "visualization" | "data";
type LabeledDataMode = "static" | "pgrest";

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

const ICON_OPTIONS = DASHLET_ICON_OPTIONS;

/** Field config for the two labeled data text fields */
const LABELED_DATA_FIELDS = [
  { id: "dashlet-name", labelKey: "common.label", state: "name", hbPlaceholder: "{{row.metric_name}}", staticPlaceholder: "Enter label..." },
  { id: "dashlet-value", labelKey: "common.value", state: "value", hbPlaceholder: "{{row.total}}", staticPlaceholder: "Enter value..." },
] as const;

/**
 * Settings Modal
 */
export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("visualization");
  const [name, setName] = useState(config.name || "Metric");
  const [value, setValue] = useState(config.value || "0");
  const [color, setColor] = useState<ColorTheme>(config.color || "gray");
  const [icon, setIcon] = useState<IconType>(config.icon || "chart");
  const [dataMode, setDataMode] = useState<LabeledDataMode>(
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
      if (detected.length >= 1) {
        setName(`{{row.${detected[0].key}}}`);
      }
      if (detected.length >= 2) {
        setValue(`{{row.${detected[1].key}}}`);
      }
    },
  });

  const handleSave = () => {
    onSave({
      name: name.trim() || "Metric",
      value: value.trim() || "0",
      color,
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

  const fieldValues: Record<string, string> = { name, value };
  const fieldSetters: Record<string, (v: string) => void> = {
    name: setName,
    value: setValue,
  };

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
            {tr("dashboard.settings.visualization", dictionary)}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("data")}
            className={tabClass("data")}
          >
            {tr("dashboard.settings.dataProvider", dictionary)}
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 space-y-3 overflow-y-auto">
          {activeTab === "visualization" ? (
            <>
              {LABELED_DATA_FIELDS.map((f) => (
                <HbTextField
                  key={f.id}
                  id={f.id}
                  label={tr(f.labelKey, dictionary)}
                  value={fieldValues[f.state]}
                  onChange={fieldSetters[f.state]}
                  placeholder={isPgrest ? f.hbPlaceholder : f.staticPlaceholder}
                />
              ))}
              <SettingsPickerRow>
                <SettingsPickerItem label={tr("dashboard.settings.icon", dictionary)}>
                  <IconPickerDropdown
                    options={ICON_OPTIONS}
                    value={icon}
                    onChange={setIcon}
                    title={tr("dashboard.settings.icon", dictionary)}
                  />
                </SettingsPickerItem>
                <SettingsPickerItem label={tr("dashboard.settings.color", dictionary)}>
                  <ColorPickerDropdown
                    options={COLOR_OPTIONS}
                    value={color}
                    onChange={setColor}
                    title={tr("dashboard.settings.color", dictionary)}
                  />
                </SettingsPickerItem>
              </SettingsPickerRow>
            </>
          ) : (
            <PgrestDataTab
              id="labeled-data-mode"
              dataMode={dataMode}
              onDataModeChange={(v) => setDataMode(v as LabeledDataMode)}
              pgrest={pg}
              dictionary={dictionary}
            />
          )}
        </div>

        {/* Save Button */}
        <Button onClick={handleSave} size="sm" className="w-full">
          {tr("common.save", dictionary)}
        </Button>
      </div>
    </AbsoluteModal>
  );

  return createPortal(modalContent, document.body);
}
