"use client";

import { useState } from "react";
import { Button, TextInput, Label, Textarea } from "flowbite-react";
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
  const [title, setTitle] = useState(typedConfig.title || "Monthly Revenue");
  const [value, setValue] = useState(typedConfig.value || 84500);
  const [previousValue, setPreviousValue] = useState(
    typedConfig.previousValue || 72000
  );
  const [unit, setUnit] = useState(typedConfig.unit || "$");
  const [description, setDescription] = useState(typedConfig.description || "");
  const [target, setTarget] = useState(typedConfig.target || 100000);

  const handleSave = () => {
    onSave({ title, value, previousValue, unit, description, target });
    onClose();
  };

  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

  if (globalThis.window === undefined) return null;

  return createPortal(
    <AbsoluteModal
      selected={isOpen}
      setSelected={(s) => !s && onClose()}
      className="no-drag w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
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
              Current Value
            </Label>
            <TextInput
              id="value"
              type="number"
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              sizing="sm"
            />
          </div>
          <div>
            <Label htmlFor="prev" className="mb-1 block text-sm">
              Previous
            </Label>
            <TextInput
              id="prev"
              type="number"
              value={previousValue}
              onChange={(e) => setPreviousValue(Number(e.target.value))}
              sizing="sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
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
          <div>
            <Label htmlFor="target" className="mb-1 block text-sm">
              Target
            </Label>
            <TextInput
              id="target"
              type="number"
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              sizing="sm"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="description" className="mb-1 block text-sm">
            Description
          </Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="text-sm"
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
