"use client";

import { useState } from "react";
import { Button, TextInput, Label } from "flowbite-react";
import { HiPlus, HiTrash } from "react-icons/hi2";
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
  const [title, setTitle] = useState(typedConfig.title || "Conversion Rate");
  const [value, setValue] = useState(typedConfig.value || 3.24);
  const [unit, setUnit] = useState(typedConfig.unit || "%");
  const [details, setDetails] = useState(
    typedConfig.details || [
      { label: "Visitors", value: "12,847" },
      { label: "Conversions", value: "416" },
    ]
  );

  const handleSave = () => {
    onSave({ title, value, unit, details });
    onClose();
  };

  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

  const addDetail = () => setDetails([...details, { label: "", value: "" }]);
  const removeDetail = (i: number) =>
    setDetails(details.filter((_, idx) => idx !== i));
  const updateDetail = (i: number, field: "label" | "value", val: string) => {
    setDetails(
      details.map((d, idx) => (idx === i ? { ...d, [field]: val } : d))
    );
  };

  if (globalThis.window === undefined) return null;

  return createPortal(
    <AbsoluteModal
      selected={isOpen}
      setSelected={(s) => !s && onClose()}
      className="no-drag w-80 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800"
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Expandable Details</Label>
            <Button
              size="xs"
              color="light"
              onClick={addDetail}
              onMouseDown={handleMouseDown}
              className="no-drag"
            >
              <HiPlus className="mr-1 h-3 w-3" />
              Add
            </Button>
          </div>
          {details.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <TextInput
                value={d.label}
                onChange={(e) => updateDetail(i, "label", e.target.value)}
                placeholder="Label"
                sizing="sm"
                className="flex-1"
              />
              <TextInput
                value={d.value}
                onChange={(e) => updateDetail(i, "value", e.target.value)}
                placeholder="Value"
                sizing="sm"
                className="flex-1"
              />
              <Button
                size="xs"
                color="failure"
                onClick={() => removeDetail(i)}
                onMouseDown={handleMouseDown}
                className="no-drag"
              >
                <HiTrash className="h-3 w-3" />
              </Button>
            </div>
          ))}
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
