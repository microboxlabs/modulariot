"use client";

import { useState, useRef } from "react";
import { Button, TextInput } from "flowbite-react";
import { createPortal } from "react-dom";
import { twMerge } from "tailwind-merge";
import type { DashletSettingsProps, DataProviderEntry } from "../types";
import type { DashletConfig, InfoCardIcon } from "./dashlet";
import { ICON_OPTIONS } from "./dashlet";
import { tr } from "@/features/i18n/tr.service";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import {
  IconPickerDropdown,
  type IconOption,
} from "@/features/common/components/icon-picker-dropdown";
import {
  SettingsPickerRow,
  SettingsPickerItem,
  HbTextField,
  HbTextareaField,
} from "../common";

// ============================================================================
// Types
// ============================================================================

type SettingsTab = "visualization" | "data";

/** Convert ICON_OPTIONS to IconPickerDropdown format */
const ICON_PICKER_OPTIONS: IconOption<InfoCardIcon>[] = ICON_OPTIONS.map(
  (opt) => ({
    value: opt.id,
    label: opt.label,
    icon: opt.component,
  })
);

// ============================================================================
// Settings Component
// ============================================================================

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("visualization");

  // Visualization fields
  const [title, setTitle] = useState(config.title || "Metric");
  const [icon, setIcon] = useState<InfoCardIcon>(config.icon || "chart");
  const [value, setValue] = useState(config.value || "100%");
  const [descriptor, setDescriptor] = useState(
    config.descriptor || "Percentage of tasks completed"
  );
  const [aiPlaceholder, setAiPlaceholder] = useState(
    config.aiPlaceholder || "AI summary will appear here"
  );
  const [viewMoreUrl, setViewMoreUrl] = useState(config.viewMoreUrl || "");

  // Data provider entries
  const idCounter = useRef(0);
  const assignId = (entry: DataProviderEntry): DataProviderEntry => ({
    ...entry,
    _id: entry._id ?? idCounter.current++,
  });
  const [dataProvider, setDataProvider] = useState<DataProviderEntry[]>(() =>
    (
      (config as DashletConfig & { dataProvider?: DataProviderEntry[] })
        .dataProvider || [
        { key: "title", value: "Example Title" },
        { key: "value", value: "100" },
      ]
    ).map(assignId)
  );

  const handleSave = () => {
    onSave({
      title,
      icon,
      value,
      descriptor,
      aiPlaceholder,
      viewMoreUrl,
      dataProvider: dataProvider.map(({ _id, ...rest }) => rest),
    } as DashletConfig);
    onClose();
  };

  const addDataEntry = () => {
    setDataProvider([...dataProvider, assignId({ key: "", value: "" })]);
  };

  const removeDataEntry = (index: number) => {
    setDataProvider(dataProvider.filter((_, i) => i !== index));
  };

  const updateDataEntry = (
    index: number,
    field: "key" | "value",
    newValue: string
  ) => {
    setDataProvider(
      dataProvider.map((entry, i) =>
        i === index ? { ...entry, [field]: newValue } : entry
      )
    );
  };

  if (globalThis.window === undefined) return null;

  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

  const modalContent = (
    <AbsoluteModal
      selected={isOpen}
      setSelected={(selected) => {
        if (!selected) onClose();
      }}
      className="no-drag w-96 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex w-full flex-col gap-3 max-h-[70vh]">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setActiveTab("visualization")}
            className={twMerge(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === "visualization"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
            )}
          >
            {tr("dashboard.settings.visualization", dictionary)}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("data")}
            className={twMerge(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === "data"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
            )}
          >
            {tr("dashboard.settings.dataProvider", dictionary)}
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {activeTab === "visualization" ? (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {tr("dashboard.settings.dynamicValuesHint", dictionary, {
                  code: "{{data_provider.key}}",
                })}
              </p>

              <HandlebarsTextField
                id="title"
                label={tr("common.title", dictionary)}
                value={title}
                onChange={setTitle}
                placeholder={tr("dashboard.settings.titlePlaceholder", dictionary)}
              />

              <SettingsPickerRow>
                <SettingsPickerItem label={tr("dashboard.settings.icon", dictionary)}>
                  <IconPickerDropdown
                    options={ICON_PICKER_OPTIONS}
                    value={icon}
                    onChange={setIcon}
                    title={tr("dashboard.settings.selectIcon", dictionary)}
                  />
                </SettingsPickerItem>
              </SettingsPickerRow>

              <HandlebarsTextField
                id="value"
                label={tr("common.value", dictionary)}
                value={value}
                onChange={setValue}
                placeholder={tr("dashboard.settings.valuePlaceholder", dictionary)}
              />

              <HandlebarsTextareaField
                id="descriptor"
                label={tr("dashboard.settings.descriptor", dictionary)}
                value={descriptor}
                onChange={setDescriptor}
                placeholder={tr("dashboard.settings.descriptorPlaceholder", dictionary)}
                rows={2}
              />

              <HandlebarsTextareaField
                id="aiPlaceholder"
                label={tr("dashboard.settings.aiPlaceholder", dictionary)}
                value={aiPlaceholder}
                onChange={setAiPlaceholder}
                placeholder={tr("dashboard.settings.aiPlaceholderPlaceholder", dictionary)}
                rows={2}
              />

              <HandlebarsTextField
                id="viewMoreUrl"
                label={tr("dashboard.settings.viewMoreUrl", dictionary)}
                value={viewMoreUrl}
                onChange={setViewMoreUrl}
                placeholder="https://example.com/details"
              />
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {tr("dashboard.settings.defineVariablesHint", dictionary, {
                  code: "{{data_provider.key}}",
                })}
              </p>

              <div className="space-y-2">
                {dataProvider.map((entry, index) => (
                  <div
                    key={entry._id}
                    className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700"
                  >
                    <TextInput
                      value={entry.key}
                      onChange={(e) =>
                        updateDataEntry(index, "key", e.target.value)
                      }
                      placeholder={tr("dashboard.settings.key", dictionary)}
                      sizing="sm"
                      className="flex-1"
                    />
                    <TextInput
                      value={entry.value}
                      onChange={(e) =>
                        updateDataEntry(index, "value", e.target.value)
                      }
                      placeholder={tr("common.value", dictionary)}
                      sizing="sm"
                      className="flex-1"
                    />
                    <Button
                      size="xs"
                      color="failure"
                      onClick={() => removeDataEntry(index)}
                      onMouseDown={handleMouseDown}
                      className="no-drag shrink-0"
                    >
                      ✕
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                size="xs"
                color="light"
                onClick={addDataEntry}
                onMouseDown={handleMouseDown}
                className="no-drag w-full"
              >
                {tr("dashboard.settings.addEntry", dictionary)}
              </Button>
            </>
          )}
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          onMouseDown={handleMouseDown}
          size="sm"
          className="w-full"
        >
          {tr("common.save", dictionary)}
        </Button>
      </div>
    </AbsoluteModal>
  );

  return createPortal(modalContent, document.body);
}
