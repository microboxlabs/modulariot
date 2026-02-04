"use client";

import { useState } from "react";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  TextInput,
  Textarea,
  Label,
  Select,
} from "flowbite-react";
import { createPortal } from "react-dom";
import type { DashletSettingsProps } from "../types";
import {
  type DashletConfig,
  type ContainerVariant,
  type LabelBorderColor,
  LABEL_BORDER_COLORS,
  BORDER_COLOR_CLASSES,
  defaultConfig,
} from "./dashlet";

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
    <Modal
      show={isOpen}
      onClose={onClose}
      size="md"
      onMouseDown={handleMouseDown}
    >
      <ModalHeader>Container Settings</ModalHeader>
      <ModalBody>
        <div className="space-y-6">
          {/* Variant Toggle */}
          <div>
            <Label className="mb-2 block font-medium">Container Type</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVariant("bento-box")}
                onMouseDown={handleMouseDown}
                className={`flex-1 rounded-lg border-2 px-4 py-3 text-center transition-all ${
                  variant === "bento-box"
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-gray-500"
                }`}
              >
                <div className="font-medium">Bento Box</div>
                <div className="mt-1 text-xs opacity-70">
                  Card with header & description
                </div>
              </button>
              <button
                type="button"
                onClick={() => setVariant("labeled-group")}
                onMouseDown={handleMouseDown}
                className={`flex-1 rounded-lg border-2 px-4 py-3 text-center transition-all ${
                  variant === "labeled-group"
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-gray-500"
                }`}
              >
                <div className="font-medium">Labeled Group</div>
                <div className="mt-1 text-xs opacity-70">
                  Bordered group with label
                </div>
              </button>
            </div>
          </div>

          {/* Conditional Fields based on variant */}
          {variant === "bento-box" ? (
            <>
              {/* Bento Box Fields */}
              <div>
                <Label htmlFor="name" className="mb-2 block">
                  Name
                </Label>
                <TextInput
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter name..."
                />
              </div>

              <div>
                <Label htmlFor="description" className="mb-2 block">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter description..."
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="verMasUrl" className="mb-2 block">
                  "Ver más" Link URL
                </Label>
                <TextInput
                  id="verMasUrl"
                  value={verMasUrl}
                  onChange={(e) => setVerMasUrl(e.target.value)}
                  placeholder="https://example.com"
                  type="url"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Leave empty to hide the "Ver más" button
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Labeled Group Fields */}
              <div>
                <Label htmlFor="label" className="mb-2 block">
                  Label
                </Label>
                <TextInput
                  id="label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Enter label..."
                />
              </div>

              <div>
                <Label htmlFor="borderColor" className="mb-2 block">
                  Border Color
                </Label>
                <Select
                  id="borderColor"
                  value={borderColor}
                  onChange={(e) =>
                    setBorderColor(e.target.value as LabelBorderColor)
                  }
                >
                  {LABEL_BORDER_COLORS.map((color) => (
                    <option key={color} value={color}>
                      {color.charAt(0).toUpperCase() + color.slice(1)}
                    </option>
                  ))}
                </Select>
                {/* Color preview */}
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Preview:
                  </span>
                  <div
                    className={`h-4 w-16 rounded border-2 ${BORDER_COLOR_CLASSES[borderColor]}`}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <div className="flex w-full justify-end gap-2">
          <Button
            color="gray"
            onClick={onClose}
            className="no-drag"
            onMouseDown={handleMouseDown}
          >
            Cancel
          </Button>
          <Button
            color="blue"
            onClick={handleSave}
            className="no-drag"
            onMouseDown={handleMouseDown}
          >
            Save
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );

  return createPortal(modalContent, document.body);
}
