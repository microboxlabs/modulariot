"use client";

import { useState } from "react";
import { Button, TextInput, Textarea, Label } from "flowbite-react";
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
}: DashletSettingsProps) {
  const typedConfig = config as unknown as DashletConfig;

  // Initialize state with current config or defaults
  const [variant, setVariant] = useState<ContainerVariant>(
    typedConfig.variant ?? defaultConfig.variant
  );
  const [name, setName] = useState(typedConfig.name ?? defaultConfig.name);
  const [description, setDescription] = useState(
    typedConfig.description ?? defaultConfig.description
  );
  const [verMasUrl, setVerMasUrl] = useState(
    typedConfig.verMasUrl ?? defaultConfig.verMasUrl
  );
  const [label, setLabel] = useState(typedConfig.label ?? defaultConfig.label);
  const [borderColor, setBorderColor] = useState<LabelBorderColor>(
    typedConfig.borderColor ?? defaultConfig.borderColor ?? "gray"
  );

  const handleSave = () => {
    // Save ALL fields regardless of current variant (silent preservation)
    const newConfig: DashletConfig = {
      variant,
      name: name?.trim() || "Untitled",
      description: description?.trim() || "",
      verMasUrl: verMasUrl?.trim() || "",
      label: label?.trim() || "Group",
      borderColor,
    };
    onSave(newConfig as unknown as Record<string, unknown>);
    onClose();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  if (typeof window === "undefined") return null;

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
          <Label className="mb-1 block text-sm">Container Type</Label>
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
              <div className="font-medium">Bento Box</div>
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
              <div className="font-medium">Labeled Group</div>
            </button>
          </div>
        </div>

        {/* Conditional Fields based on variant */}
        {variant === "bento-box" ? (
          <>
            <div>
              <Label htmlFor="name" className="mb-1 block text-sm">
                Name
              </Label>
              <TextInput
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter name..."
                sizing="sm"
              />
            </div>

            <div>
              <Label htmlFor="description" className="mb-1 block text-sm">
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter description..."
                rows={2}
                className="text-sm"
              />
            </div>

            <div>
              <Label htmlFor="verMasUrl" className="mb-1 block text-sm">
                "Ver más" Link URL
              </Label>
              <TextInput
                id="verMasUrl"
                value={verMasUrl}
                onChange={(e) => setVerMasUrl(e.target.value)}
                placeholder="https://example.com"
                type="url"
                sizing="sm"
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <Label htmlFor="label" className="mb-1 block text-sm">
                Label
              </Label>
              <TextInput
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Enter label..."
                sizing="sm"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Label className="text-sm">Border Color</Label>
              <ColorPickerDropdown
                value={borderColor}
                onChange={setBorderColor}
                options={BORDER_COLOR_OPTIONS}
                title="Select border color"
              />
            </div>
          </>
        )}

        {/* Save Button */}
        <Button onClick={handleSave} size="sm" className="w-full">
          Save
        </Button>
      </div>
    </AbsoluteModal>
  );

  return createPortal(modalContent, document.body);
}
