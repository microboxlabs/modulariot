"use client";

import { useState, useEffect } from "react";
import { Button, Label } from "flowbite-react";
import { createPortal } from "react-dom";
import type { DashletSettingsProps } from "../types";
import {
  type DashletConfig,
  type ContainerVariant,
  type LabelBorderColor,
  defaultConfig,
} from "./dashlet";
import {
  ColorPickerDropdown,
  type ColorOption,
} from "@/features/common/components/color-picker-dropdown";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import {
  SettingsTextField,
  SettingsTextareaField,
  SettingsPickerItem,
} from "../common";
import { tr } from "@/features/i18n/tr.service";

/** Color options for labeled-group border using ColorPickerDropdown */
const BORDER_COLOR_OPTIONS: ColorOption<LabelBorderColor>[] = [
  { value: "gray", label: "Gray", dotClass: "bg-gray-400" },
  { value: "red", label: "Red", dotClass: "bg-red-400" },
  { value: "orange", label: "Orange", dotClass: "bg-orange-400" },
  { value: "yellow", label: "Yellow", dotClass: "bg-yellow-400" },
  { value: "green", label: "Green", dotClass: "bg-green-400" },
  { value: "teal", label: "Teal", dotClass: "bg-teal-400" },
  { value: "blue", label: "Blue", dotClass: "bg-blue-400" },
  { value: "indigo", label: "Indigo", dotClass: "bg-indigo-400" },
  { value: "purple", label: "Purple", dotClass: "bg-purple-400" },
  { value: "pink", label: "Pink", dotClass: "bg-pink-400" },
];

/**
 * Settings modal for Container dashlet
 * Supports both bento-box and labeled-group variants with variant toggle
 */
export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  // Initialize state with current config or defaults
  const [variant, setVariant] = useState<ContainerVariant>(
    config.variant ?? defaultConfig.variant
  );
  const [name, setName] = useState(config.name ?? defaultConfig.name);
  const [description, setDescription] = useState(
    config.description ?? defaultConfig.description
  );
  const [verMasUrl, setVerMasUrl] = useState(
    config.verMasUrl ?? defaultConfig.verMasUrl
  );
  const [label, setLabel] = useState(config.label ?? defaultConfig.label);
  const [borderColor, setBorderColor] = useState<LabelBorderColor>(
    config.borderColor ?? defaultConfig.borderColor ?? "gray"
  );

  // Sync state when config changes (component may stay mounted across open/close cycles)
  useEffect(() => {
    setVariant(config.variant ?? defaultConfig.variant);
    setName(config.name ?? defaultConfig.name);
    setDescription(config.description ?? defaultConfig.description);
    setVerMasUrl(config.verMasUrl ?? defaultConfig.verMasUrl);
    setLabel(config.label ?? defaultConfig.label);
    setBorderColor(config.borderColor ?? defaultConfig.borderColor ?? "gray");
  }, [config]);

  const handleSave = () => {
    // Save ALL fields regardless of current variant (silent preservation)
    const newConfig: DashletConfig = {
      variant,
      name: name?.trim() || tr("dashboard.defaults.untitled", dictionary),
      description: description?.trim() || "",
      verMasUrl: verMasUrl?.trim() || "",
      label: label?.trim() || tr("dashboard.defaults.group", dictionary),
      borderColor,
    };
    onSave(newConfig as unknown as Record<string, unknown>);
    onClose();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
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
        {/* Variant Toggle */}
        <div>
          <Label className="mb-1 block text-sm">
            {tr("dashboard.settings.containerType", dictionary)}
          </Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setVariant("bento-box")}
              onMouseDown={handleMouseDown}
              className={`flex-1 rounded-lg border px-3 py-1.5 text-center text-xs transition-all ${
                variant === "bento-box"
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              <div className="font-medium">
                {tr("dashboard.settings.bentoBox", dictionary)}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setVariant("labeled-group")}
              onMouseDown={handleMouseDown}
              className={`flex-1 rounded-lg border px-3 py-1.5 text-center text-xs transition-all ${
                variant === "labeled-group"
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              <div className="font-medium">
                {tr("dashboard.settings.labeledGroup", dictionary)}
              </div>
            </button>
          </div>
        </div>

        {/* Conditional Fields based on variant */}
        {variant === "bento-box" ? (
          <>
            <SettingsTextField
              id="name"
              label={tr("dashboard.settings.name", dictionary)}
              value={name ?? ""}
              onChange={setName}
              placeholder={tr("dashboard.settings.enterName", dictionary)}
            />
            <SettingsTextareaField
              id="description"
              label={tr("dashboard.settings.description", dictionary)}
              value={description ?? ""}
              onChange={setDescription}
              placeholder={tr("dashboard.settings.enterDescription", dictionary)}
              rows={2}
            />
            <SettingsTextField
              id="verMasUrl"
              label={tr("dashboard.settings.seeMoreUrl", dictionary)}
              value={verMasUrl ?? ""}
              onChange={setVerMasUrl}
              placeholder="https://example.com"
            />
          </>
        ) : (
          <>
            <SettingsTextField
              id="label"
              label={tr("dashboard.settings.label", dictionary)}
              value={label ?? ""}
              onChange={setLabel}
              placeholder={tr("dashboard.settings.enterLabel", dictionary)}
            />
            <SettingsPickerItem label={tr("dashboard.settings.borderColor", dictionary)}>
              <ColorPickerDropdown
                value={borderColor}
                onChange={setBorderColor}
                options={BORDER_COLOR_OPTIONS}
                title={tr("dashboard.settings.selectBorderColor", dictionary)}
              />
            </SettingsPickerItem>
          </>
        )}

        {/* Save Button */}
        <Button onClick={handleSave} size="sm" className="w-full">
          {tr("common.save", dictionary)}
        </Button>
      </div>
    </AbsoluteModal>
  );

  return createPortal(modalContent, document.body);
}
