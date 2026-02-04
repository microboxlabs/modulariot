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
import type { DashletConfig } from "./dashlet";

/**
 * Settings Modal
 *
 * Edit this component to customize the settings form.
 * The `config` prop contains current values, call `onSave` with new values.
 */
export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
}: DashletSettingsProps) {
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

  if (typeof window === "undefined") return null;

  const modalContent = (
    <Modal
      show={isOpen}
      onClose={onClose}
      size="md"
      onMouseDown={handleMouseDown}
    >
      <ModalHeader>Settings</ModalHeader>
      <ModalBody>
        <div className="space-y-4">
          {/* Add your form fields here */}
          <div>
            <Label htmlFor="dashlet-title" className="mb-2 block">
              Title
            </Label>
            <TextInput
              id="dashlet-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter title..."
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
