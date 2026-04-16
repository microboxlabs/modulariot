"use client";

import { useState } from "react";
import { Button, TextInput, Label } from "flowbite-react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import { SettingsDrawer } from "../common/settings-drawer";

/**
 * Settings Modal
 */
export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  widgetId,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  // Add state for each config field
  const [title, setTitle] = useState(config.title || "");

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

  return (
    <SettingsDrawer open={isOpen} onClose={onClose} widgetId={widgetId}>
      <div className="flex h-full flex-col gap-3">
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
    </SettingsDrawer>
  );
}
