"use client";

import { useState } from "react";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  TextInput,
  Label,
  Select,
} from "flowbite-react";
import { createPortal } from "react-dom";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig, CardBackgroundColor, CardIcon } from "./dashlet";

/** Background color options for dropdown */
const BG_COLOR_OPTIONS: { value: CardBackgroundColor; label: string }[] = [
  { value: "white", label: "White" },
  { value: "gray", label: "Gray" },
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
  { value: "yellow", label: "Yellow" },
  { value: "red", label: "Red" },
  { value: "purple", label: "Purple" },
];

/** Icon options for dropdown */
const ICON_OPTIONS: { value: CardIcon; label: string }[] = [
  { value: "chart", label: "📊 Chart" },
  { value: "currency", label: "💰 Currency" },
  { value: "users", label: "👥 Users" },
  { value: "cart", label: "🛒 Cart" },
  { value: "clock", label: "⏰ Clock" },
  { value: "check", label: "✅ Check" },
];

/**
 * Settings Modal
 */
export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
}: DashletSettingsProps) {
  const typedConfig = config as unknown as DashletConfig;
  const [name, setName] = useState(typedConfig.name || "Metric");
  const [value, setValue] = useState(typedConfig.value || "0");
  const [backgroundColor, setBackgroundColor] = useState<CardBackgroundColor>(
    typedConfig.backgroundColor || "white"
  );
  const [icon, setIcon] = useState<CardIcon>(typedConfig.icon || "chart");

  const handleSave = () => {
    onSave({
      name: name.trim() || "Metric",
      value: value.trim() || "0",
      backgroundColor,
      icon,
    });
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
      <ModalHeader>Card Settings</ModalHeader>
      <ModalBody>
        <div className="space-y-4">
          {/* Name */}
          <div>
            <Label htmlFor="card-name" className="mb-2 block">
              Label
            </Label>
            <TextInput
              id="card-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter label..."
            />
          </div>

          {/* Value */}
          <div>
            <Label htmlFor="card-value" className="mb-2 block">
              Value
            </Label>
            <TextInput
              id="card-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter value..."
            />
          </div>

          {/* Icon */}
          <div>
            <Label htmlFor="card-icon" className="mb-2 block">
              Icon
            </Label>
            <Select
              id="card-icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value as CardIcon)}
            >
              {ICON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Background Color */}
          <div>
            <Label htmlFor="card-bg" className="mb-2 block">
              Background Color
            </Label>
            <Select
              id="card-bg"
              value={backgroundColor}
              onChange={(e) =>
                setBackgroundColor(e.target.value as CardBackgroundColor)
              }
            >
              {BG_COLOR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
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
