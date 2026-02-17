"use client";

import { useState, useMemo, useRef } from "react";
import { Button, Label, TextInput, Textarea } from "flowbite-react";
import { createPortal } from "react-dom";
import Handlebars from "handlebars";
import { twMerge } from "tailwind-merge";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig, InfoCardIcon, DataProviderEntry } from "./dashlet";
import { ICON_OPTIONS } from "./dashlet";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import {
  IconPickerDropdown,
  type IconOption,
} from "@/features/common/components/icon-picker-dropdown";
import { SettingsPickerRow, SettingsPickerItem } from "../common";

// ============================================================================
// Types
// ============================================================================

type SettingsTab = "visualization" | "data";

// ============================================================================
// Handlebars Validation
// ============================================================================

type HandlebarsStatus = "valid" | "invalid" | "none";

function getHandlebarsStatus(text: string): HandlebarsStatus {
  // Check if text contains handlebars expressions
  const handlebarsMatches = text.match(/\{\{(.*?)\}\}/g);
  if (!handlebarsMatches || handlebarsMatches.length === 0) return "none";

  // Validate each handlebars expression
  for (const match of handlebarsMatches) {
    const inner = match.slice(2, -2).trim();

    // Check for invalid patterns:
    // - Empty: {{}}
    // - Trailing dot: {{data_provider.}}
    // - Leading dot: {{.something}}
    // - Double dots: {{data..provider}}
    // - Only spaces: {{   }}
    if (
      !inner ||
      inner.endsWith(".") ||
      inner.startsWith(".") ||
      /\.\./.test(inner) ||
      !/^[\w\s.#/^>@!-]+$/.test(inner)
    ) {
      return "invalid";
    }
  }

  // Try to compile to catch any other syntax errors
  try {
    Handlebars.compile(text);
    return "valid";
  } catch {
    return "invalid";
  }
}

function getFlowbiteColor(
  status: HandlebarsStatus
): "gray" | "success" | "failure" {
  switch (status) {
    case "valid":
      return "success";
    case "invalid":
      return "failure";
    default:
      return "gray";
  }
}

// ============================================================================
// Handlebars-aware Input Components
// ============================================================================

interface HandlebarsTextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function HandlebarsTextField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: Readonly<HandlebarsTextFieldProps>) {
  const status = useMemo(() => getHandlebarsStatus(value), [value]);

  return (
    <div>
      <Label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </Label>
      <TextInput
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        sizing="sm"
        color={getFlowbiteColor(status)}
      />
    </div>
  );
}

interface HandlebarsTextareaFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

function HandlebarsTextareaField({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows = 2,
}: Readonly<HandlebarsTextareaFieldProps>) {
  const status = useMemo(() => getHandlebarsStatus(value), [value]);

  return (
    <div>
      <Label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </Label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="text-sm"
        color={getFlowbiteColor(status)}
      />
    </div>
  );
}

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
            Visualization
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
            Data Provider
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {activeTab === "visualization" ? (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Use{" "}
                <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">
                  {"{{data_provider.key}}"}
                </code>{" "}
                syntax for dynamic values
              </p>

              <HandlebarsTextField
                id="title"
                label="Title"
                value={title}
                onChange={setTitle}
                placeholder="Card title or {{data_provider.title}}"
              />

              <SettingsPickerRow>
                <SettingsPickerItem label="Icon">
                  <IconPickerDropdown
                    options={ICON_PICKER_OPTIONS}
                    value={icon}
                    onChange={setIcon}
                    title="Select icon"
                  />
                </SettingsPickerItem>
              </SettingsPickerRow>

              <HandlebarsTextField
                id="value"
                label="Value"
                value={value}
                onChange={setValue}
                placeholder="e.g., {{data_provider.value}}%"
              />

              <HandlebarsTextareaField
                id="descriptor"
                label="Descriptor"
                value={descriptor}
                onChange={setDescriptor}
                placeholder="Description or {{data_provider.descriptor}}"
                rows={2}
              />

              <HandlebarsTextareaField
                id="aiPlaceholder"
                label="AI Placeholder"
                value={aiPlaceholder}
                onChange={setAiPlaceholder}
                placeholder="Placeholder text for AI summary"
                rows={2}
              />

              <HandlebarsTextField
                id="viewMoreUrl"
                label="View More URL (optional)"
                value={viewMoreUrl}
                onChange={setViewMoreUrl}
                placeholder="https://example.com/details"
              />
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Define variables accessible via{" "}
                <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">
                  {"{{data_provider.key}}"}
                </code>
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
                      placeholder="Key"
                      sizing="sm"
                      className="flex-1"
                    />
                    <TextInput
                      value={entry.value}
                      onChange={(e) =>
                        updateDataEntry(index, "value", e.target.value)
                      }
                      placeholder="Value"
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
                + Add Entry
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
          Save
        </Button>
      </div>
    </AbsoluteModal>
  );

  return createPortal(modalContent, document.body);
}
