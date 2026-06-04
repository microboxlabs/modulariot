"use client";

import { useState, useEffect } from "react";
import { Label } from "flowbite-react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig, FlexLayout } from "./dashlet";
import { defaultConfig } from "./dashlet";
import { SettingsTextField, SettingsTextareaField } from "../common/settings-fields";
import { SettingsShell } from "../common/settings-shell";
import { useSettingsDirty } from "../common/use-settings-dirty";
import { tr, trDynamic } from "@/features/i18n/tr.service";

const LAYOUT_OPTIONS: { value: FlexLayout; labelKey: string; hintKey: string }[] = [
  { value: "row", labelKey: "dashboard.dashlets.flex_container.layoutRow", hintKey: "dashboard.dashlets.flex_container.layoutRowHint" },
  { value: "column", labelKey: "dashboard.dashlets.flex_container.layoutColumn", hintKey: "dashboard.dashlets.flex_container.layoutColumnHint" },
  { value: "grid", labelKey: "dashboard.dashlets.flex_container.layoutGrid", hintKey: "dashboard.dashlets.flex_container.layoutGridHint" },
];

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
  dashletName,
  widgetId,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const [layout, setLayout] = useState<FlexLayout>(config.layout ?? defaultConfig.layout);
  const [title, setTitle] = useState(config.title ?? defaultConfig.title ?? "");
  const [description, setDescription] = useState(config.description ?? defaultConfig.description ?? "");

  useEffect(() => {
    if (!isOpen) return;
    setLayout(config.layout ?? defaultConfig.layout);
    setTitle(config.title ?? defaultConfig.title ?? "");
    setDescription(config.description ?? defaultConfig.description ?? "");
  }, [config, isOpen]);

  const isDirty = useSettingsDirty(isOpen, { layout, title, description });

  const handleSave = () => {
    onSave({
      layout,
      title: title.trim() || "Untitled",
      description: description.trim() || "",
    });
    onClose();
  };

  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

  const content = (
    <div className="flex w-full flex-col gap-4">
      <div>
        <Label className="mb-1.5 block text-xs font-normal text-gray-500 dark:text-gray-400">
          {trDynamic("dashboard.dashlets.flex_container.layout", dictionary)}
        </Label>
        <div className="flex gap-2">
          {LAYOUT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setLayout(opt.value)}
              onMouseDown={handleMouseDown}
              className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-xs transition-all ${
                layout === opt.value
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              <div className="font-medium">{trDynamic(opt.labelKey, dictionary)}</div>
              <div className="mt-0.5 text-[10px] opacity-60">{trDynamic(opt.hintKey, dictionary)}</div>
            </button>
          ))}
        </div>
      </div>

      <SettingsTextField
        id="flex-title"
        label={tr("dashboard.settings.name", dictionary)}
        value={title}
        onChange={setTitle}
        placeholder={tr("dashboard.settings.enterName", dictionary)}
      />

      <SettingsTextareaField
        id="flex-description"
        label={tr("dashboard.settings.description", dictionary)}
        value={description}
        onChange={setDescription}
        placeholder={tr("dashboard.settings.enterDescription", dictionary)}
        rows={2}
      />
    </div>
  );

  return (
    <SettingsShell
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      dictionary={dictionary}
      title={dashletName}
      widgetId={widgetId}
      isDirty={isDirty}
    >
      {content}
    </SettingsShell>
  );
}
