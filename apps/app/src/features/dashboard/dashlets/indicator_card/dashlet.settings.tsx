"use client";

import { useState } from "react";
import { Button, TextInput, Label, Textarea } from "flowbite-react";
import { HiPlus, HiTrash } from "react-icons/hi2";
import { createPortal } from "react-dom";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig, ColorThreshold, ThresholdColor } from "./dashlet";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import {
  ColorPickerDropdown,
  type ColorOption,
} from "@/features/common/components/color-picker-dropdown";

/** Color options for threshold color picker */
const THRESHOLD_COLOR_OPTIONS: ColorOption<ThresholdColor>[] = [
  { value: "green", label: "Green", dotClass: "bg-green-500" },
  { value: "yellow", label: "Yellow", dotClass: "bg-yellow-500" },
  { value: "red", label: "Red", dotClass: "bg-red-500" },
  { value: "blue", label: "Blue", dotClass: "bg-blue-500" },
  { value: "gray", label: "Gray", dotClass: "bg-gray-500" },
];

/** Default threshold for new entries */
const DEFAULT_THRESHOLD: ColorThreshold = {
  min: 0,
  max: 100,
  color: "green",
};

/**
 * Settings Modal for Indicator Card
 */
export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
}: DashletSettingsProps) {
  const typedConfig = config as unknown as DashletConfig;

  // Form state
  const [title, setTitle] = useState(typedConfig.title || "Indicator");
  const [description, setDescription] = useState(typedConfig.description || "");
  const [apiUrl, setApiUrl] = useState(typedConfig.apiUrl || "");
  const [valueKey, setValueKey] = useState(typedConfig.valueKey || "value");
  const [unit, setUnit] = useState(typedConfig.unit || "%");
  const [thresholds, setThresholds] = useState<ColorThreshold[]>(
    typedConfig.thresholds || [
      { min: 0, max: 25, color: "red" },
      { min: 25, max: 75, color: "yellow" },
      { min: 75, max: 100, color: "green" },
    ]
  );

  const handleSave = () => {
    onSave({
      title: title.trim() || "Indicator",
      description: description.trim(),
      apiUrl: apiUrl.trim(),
      valueKey: valueKey.trim() || "value",
      unit: unit.trim(),
      thresholds,
    });
    onClose();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Threshold management
  const addThreshold = () => {
    setThresholds([...thresholds, { ...DEFAULT_THRESHOLD }]);
  };

  const removeThreshold = (index: number) => {
    setThresholds(thresholds.filter((_, i) => i !== index));
  };

  const updateThreshold = (
    index: number,
    field: keyof ColorThreshold,
    value: number | ThresholdColor
  ) => {
    setThresholds(
      thresholds.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    );
  };

  if (typeof globalThis.window === "undefined") return null;

  const modalContent = (
    <AbsoluteModal
      selected={isOpen}
      setSelected={(selected) => {
        if (!selected) onClose();
      }}
      className="no-drag w-80 gap-4 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex max-h-[70vh] w-full flex-col gap-3 overflow-y-auto">
        {/* Title */}
        <div>
          <Label htmlFor="indicator-title" className="mb-1 block text-sm">
            Title
          </Label>
          <TextInput
            id="indicator-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter title..."
            sizing="sm"
          />
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="indicator-description" className="mb-1 block text-sm">
            Description
          </Label>
          <Textarea
            id="indicator-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter description..."
            rows={2}
            className="text-sm"
          />
        </div>

        {/* API URL */}
        <div>
          <Label htmlFor="indicator-api-url" className="mb-1 block text-sm">
            API URL
          </Label>
          <TextInput
            id="indicator-api-url"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://api.example.com/data"
            sizing="sm"
          />
        </div>

        {/* Value Key */}
        <div>
          <Label htmlFor="indicator-value-key" className="mb-1 block text-sm">
            Value Key (JSON path)
          </Label>
          <TextInput
            id="indicator-value-key"
            value={valueKey}
            onChange={(e) => setValueKey(e.target.value)}
            placeholder="data.percentage"
            sizing="sm"
          />
        </div>

        {/* Unit */}
        <div>
          <Label htmlFor="indicator-unit" className="mb-1 block text-sm">
            Unit
          </Label>
          <TextInput
            id="indicator-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="%"
            sizing="sm"
          />
        </div>

        {/* Thresholds Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Color Thresholds</Label>
            <Button
              size="xs"
              color="light"
              onClick={addThreshold}
              onMouseDown={handleMouseDown}
              className="no-drag"
            >
              <HiPlus className="mr-1 h-3 w-3" />
              Add
            </Button>
          </div>

          {thresholds.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No thresholds defined. Add one to enable color coding.
            </p>
          ) : (
            <div className="space-y-2">
              {thresholds.map((threshold, index) => (
                <ThresholdRow
                  key={index}
                  threshold={threshold}
                  index={index}
                  onUpdate={updateThreshold}
                  onRemove={removeThreshold}
                  onMouseDown={handleMouseDown}
                />
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex w-full justify-end gap-2 pt-2">
          <Button
            color="gray"
            onClick={onClose}
            className="no-drag w-full"
            onMouseDown={handleMouseDown}
            size="sm"
          >
            Cancel
          </Button>
          <Button
            color="blue"
            onClick={handleSave}
            className="no-drag w-full"
            onMouseDown={handleMouseDown}
            size="sm"
          >
            Save
          </Button>
        </div>
      </div>
    </AbsoluteModal>
  );

  return createPortal(modalContent, document.body);
}

// ============================================================================
// Extracted Components
// ============================================================================

interface ThresholdRowProps {
  threshold: ColorThreshold;
  index: number;
  onUpdate: (
    index: number,
    field: keyof ColorThreshold,
    value: number | ThresholdColor
  ) => void;
  onRemove: (index: number) => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

function ThresholdRow({
  threshold,
  index,
  onUpdate,
  onRemove,
  onMouseDown,
}: Readonly<ThresholdRowProps>) {
  return (
    <div className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700">
      <div className="flex flex-1 items-center gap-1">
        <TextInput
          type="number"
          value={threshold.min}
          onChange={(e) => onUpdate(index, "min", parseFloat(e.target.value) || 0)}
          placeholder="Min"
          sizing="sm"
          className="w-16"
        />
        <span className="text-xs text-gray-500">to</span>
        <TextInput
          type="number"
          value={threshold.max}
          onChange={(e) => onUpdate(index, "max", parseFloat(e.target.value) || 0)}
          placeholder="Max"
          sizing="sm"
          className="w-16"
        />
      </div>
      <ColorPickerDropdown
        options={THRESHOLD_COLOR_OPTIONS}
        value={threshold.color}
        onChange={(color) => onUpdate(index, "color", color)}
        title="Select color"
      />
      <Button
        size="xs"
        color="failure"
        onClick={() => onRemove(index)}
        onMouseDown={onMouseDown}
        className="no-drag"
      >
        <HiTrash className="h-3 w-3" />
      </Button>
    </div>
  );
}
