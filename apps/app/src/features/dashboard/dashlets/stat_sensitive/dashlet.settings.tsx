"use client";

import { useState } from "react";
import { Button, TextInput, Label, ToggleSwitch } from "flowbite-react";
import { createPortal } from "react-dom";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
}: DashletSettingsProps) {
  const typedConfig = config as unknown as DashletConfig;
  const [title, setTitle] = useState(typedConfig.title || "Account Balance");
  const [value, setValue] = useState(typedConfig.value || 125847.32);
  const [unit, setUnit] = useState(typedConfig.unit || "$");
  const [isSensitive, setIsSensitive] = useState(
    typedConfig.isSensitive ?? true
  );

  const handleSave = () => {
    onSave({ title, value, unit, isSensitive });
    onClose();
  };

  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

  if (typeof globalThis.window === "undefined") return null;

  return createPortal(
    <AbsoluteModal
      selected={isOpen}
      setSelected={(s) => !s && onClose()}
      className="no-drag w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex flex-col gap-3">
        <div>
          <Label htmlFor="title" className="mb-1 block text-sm">
            Title
          </Label>
          <TextInput
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            sizing="sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="value" className="mb-1 block text-sm">
              Value
            </Label>
            <TextInput
              id="value"
              type="number"
              step="0.01"
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              sizing="sm"
            />
          </div>
          <div>
            <Label htmlFor="unit" className="mb-1 block text-sm">
              Unit
            </Label>
            <TextInput
              id="unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              sizing="sm"
            />
          </div>
        </div>
        <div className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700">
          <div>
            <Label className="text-sm font-medium">Hidden by default</Label>
            <p className="text-xs text-gray-500">User must click to reveal</p>
          </div>
          <ToggleSwitch
            checked={isSensitive}
            onChange={setIsSensitive}
            label=""
          />
        </div>
        <div className="flex gap-2 pt-2">
          <Button
            color="gray"
            onClick={onClose}
            onMouseDown={handleMouseDown}
            size="sm"
            className="no-drag w-full"
          >
            Cancel
          </Button>
          <Button
            color="blue"
            onClick={handleSave}
            onMouseDown={handleMouseDown}
            size="sm"
            className="no-drag w-full"
          >
            Save
          </Button>
        </div>
      </div>
    </AbsoluteModal>,
    document.body
  );
}
