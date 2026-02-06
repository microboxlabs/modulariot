"use client";

import { useState } from "react";
import { Button, TextInput, Label } from "flowbite-react";
import { createPortal } from "react-dom";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";

/**
 * Settings Modal for Percentage Value Dashlet
 */
export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
}: DashletSettingsProps) {
  const typedConfig = config as unknown as DashletConfig;
  const [title, setTitle] = useState(typedConfig.title || "Progress");
  const [value, setValue] = useState(typedConfig.value ?? 6);
  const [max, setMax] = useState(typedConfig.max ?? 10);

  const handleSave = () => {
    onSave({
      title: title.trim() || "Progress",
      value: Number(value) || 0,
      max: Number(max) || 10,
    });
    onClose();
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
        {/* Title */}
        <div>
          <Label htmlFor="dashlet-title" className="mb-1 block text-sm">
            Title
          </Label>
          <TextInput
            id="dashlet-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Progress"
            sizing="sm"
          />
        </div>

        {/* Value and Max in a row */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="dashlet-value" className="mb-1 block text-sm">
              Value
            </Label>
            <TextInput
              id="dashlet-value"
              type="number"
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              placeholder="6"
              sizing="sm"
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="dashlet-max" className="mb-1 block text-sm">
              Max
            </Label>
            <TextInput
              id="dashlet-max"
              type="number"
              value={max}
              onChange={(e) => setMax(Number(e.target.value))}
              placeholder="10"
              sizing="sm"
            />
          </div>
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
