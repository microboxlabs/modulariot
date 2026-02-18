"use client";

import { useState, useRef } from "react";
import { Button, Label, TextInput, Textarea, ToggleSwitch } from "flowbite-react";
import { createPortal } from "react-dom";
import Handlebars from "handlebars";
import { twMerge } from "tailwind-merge";
import type { DashletSettingsProps,DataProviderEntry } from "../types";
import type { DashletConfig, TextAlign } from "./dashlet";
import { tr } from "@/features/i18n/tr.service";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import { SettingsSelectField } from "../common";

// ============================================================================
// Types
// ============================================================================

type SettingsTab = "visualization" | "data";

// ============================================================================
// Handlebars validation helpers
// ============================================================================

type HandlebarsStatus = "valid" | "invalid" | "none";

function findHandlebarsExpressions(text: string): string[] {
  const results: string[] = [];
  let start = text.indexOf("{{");
  while (start !== -1) {
    const end = text.indexOf("}}", start + 2);
    if (end === -1) break;
    results.push(text.substring(start, end + 2));
    start = text.indexOf("{{", end + 2);
  }
  return results;
}

function getHandlebarsStatus(text: string): HandlebarsStatus {
  const matches = findHandlebarsExpressions(text);
  if (matches.length === 0) return "none";
  for (const match of matches) {
    const inner = match.slice(2, -2).trim();
    if (
      !inner ||
      inner.endsWith(".") ||
      inner.startsWith(".") ||
      /\.\./.test(inner) ||
      !/^[\w\s.#/^>@!-]+$/.test(inner)
    ) return "invalid";
  }
  try {
    Handlebars.compile(text);
    return "valid";
  } catch {
    return "invalid";
  }
}

function getFlowbiteColor(s: HandlebarsStatus): "gray" | "success" | "failure" {
  if (s === "valid") return "success";
  if (s === "invalid") return "failure";
  return "gray";
}

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
  const [text, setText] = useState(config.text ?? "Add your text or quote here...");
  const [italic, setItalic] = useState(config.italic ?? true);
  const [align, setAlign] = useState<TextAlign>(config.align ?? "left");

  // Data provider
  const idCounter = useRef(0);
  const assignId = (e: DataProviderEntry): DataProviderEntry => ({
    ...e,
    _id: e._id ?? idCounter.current++,
  });
  const [dataProvider, setDataProvider] = useState<DataProviderEntry[]>(() =>
    (config.dataProvider ?? []).map(assignId)
  );

  const handleSave = () => {
    onSave({
      text,
      italic,
      align,
      dataProvider: dataProvider.map(({ _id, ...rest }) => rest),
    } as DashletConfig);
    onClose();
  };

  const addEntry = () =>
    setDataProvider((prev) => [...prev, assignId({ key: "", value: "" })]);
  const removeEntry = (i: number) =>
    setDataProvider((prev) => prev.filter((_, idx) => idx !== i));
  const updateEntry = (i: number, field: "key" | "value", v: string) =>
    setDataProvider((prev) =>
      prev.map((e, idx) => (idx === i ? { ...e, [field]: v } : e))
    );

  if (globalThis.window === undefined) return null;

  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();
  const textStatus = getHandlebarsStatus(text);

  const modalContent = (
    <AbsoluteModal
      selected={isOpen}
      setSelected={(s) => { if (!s) onClose(); }}
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
              <div>
                <Label htmlFor="tc-text" className="mb-1 block text-sm font-medium">
                  Text
                </Label>
                <Textarea
                  id="tc-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Add your text or quote here..."
                  rows={4}
                  className="text-sm"
                  color={getFlowbiteColor(textStatus)}
                />
              </div>
              <SettingsSelectField
                id="tc-align"
                label="Alignment"
                value={align}
                onChange={(v) => setAlign(v as TextAlign)}
                options={[
                  { value: "left", label: "Left" },
                  { value: "center", label: "Center" },
                  { value: "right", label: "Right" },
                ]}
              />
              <div className="flex items-center justify-between">
                <Label className="text-sm">Italic</Label>
                <ToggleSwitch
                  checked={italic}
                  onChange={setItalic}
                  label=""
                />
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {tr("dashboard.settings.defineVariablesHint", dictionary, {
                  code: "{{data_provider.key}}",
                })}
              </p>
              <div className="space-y-2">
                {dataProvider.map((entry, i) => (
                  <div
                    key={entry._id}
                    className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700"
                  >
                    <TextInput
                      value={entry.key}
                      onChange={(e) => updateEntry(i, "key", e.target.value)}
                      placeholder={tr("dashboard.settings.key", dictionary)}
                      sizing="sm"
                      className="flex-1"
                    />
                    <TextInput
                      value={entry.value}
                      onChange={(e) => updateEntry(i, "value", e.target.value)}
                      placeholder={tr("common.value", dictionary)}
                      sizing="sm"
                      className="flex-1"
                    />
                    <Button
                      size="xs"
                      color="failure"
                      onClick={() => removeEntry(i)}
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
                onClick={addEntry}
                onMouseDown={handleMouseDown}
                className="no-drag w-full"
              >
                {tr("dashboard.settings.addEntry", dictionary)}
              </Button>
            </>
          )}
        </div>

        {/* Save */}
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
