"use client";

import { useState } from "react";
import { Button, TextInput, Label } from "flowbite-react";
import { createPortal } from "react-dom";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";

/**
 * Settings Modal
 */
export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
}: Readonly<DashletSettingsProps>) {
  const typedConfig = config as unknown as DashletConfig;

  // Add state for each config field
  const [title, setTitle] = useState(typedConfig.title || "");

  const handleSave = () => {
    onSave({
      title: title.trim() || "Default Title",
      // Add other fields here
    });
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
    >
      <div className="space-y-3 p-2">
        {/* Add your form fields here */}
        <div>
          <Label htmlFor="dashlet-title" className="mb-1 block text-sm">
            Title
          </Label>
          <TextInput
            id="dashlet-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter title..."
          />
        </div>
        <div className="flex w-full justify-end gap-2">
          <Button
            color="gray"
            onClick={onClose}
            className="no-drag w-full"
            onMouseDown={handleMouseDown}
          >
            Cancel
          </Button>
          <Button
            color="blue"
            onClick={handleSave}
            className="no-drag w-full"
            onMouseDown={handleMouseDown}
          >
            Save
          </Button>
        </div>
      </div>
    </AbsoluteModal>
  );

  return createPortal(modalContent, document.body);
}
