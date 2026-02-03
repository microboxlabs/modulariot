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
} from "flowbite-react";
import { createPortal } from "react-dom";
import type { DashletSettingsProps } from "../types";
import type { LabeledContainerConfig } from "./labeled-container";

/**
 * Settings modal for Labeled Container
 * Allows editing the label text
 */
export function LabeledContainerSettings({
  isOpen,
  onClose,
  config,
  onSave,
}: DashletSettingsProps) {
  const typedConfig = config as unknown as LabeledContainerConfig;
  const [label, setLabel] = useState(typedConfig.label || "Group");

  const handleSave = () => {
    onSave({ label: label.trim() || "Group" });
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
      size="sm"
      onMouseDown={handleMouseDown}
    >
      <ModalHeader>Group Settings</ModalHeader>
      <ModalBody>
        <div className="space-y-4">
          <div>
            <Label htmlFor="label" className="mb-2 block">
              Label
            </Label>
            <TextInput
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Enter label..."
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") onClose();
              }}
            />
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
