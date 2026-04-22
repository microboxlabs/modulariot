"use client";

import { useState } from "react";
import { TextInput, Label } from "flowbite-react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import { SettingsShell } from "../common/settings-shell";
import { useSettingsDirty } from "../common/use-settings-dirty";

/**
 * Settings Modal
 */
export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  widgetId,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  // Add state for each config field
  const [title, setTitle] = useState(config.title || "");

  const isDirty = useSettingsDirty(isOpen, { title });

  const handleSave = () => {
    onSave({
      title: title.trim() || "Default Title",
      // Add other fields here
    });
    onClose();
  };

  return (
    <SettingsShell
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      dictionary={dictionary}
      widgetId={widgetId}
      isDirty={isDirty}
    >
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
    </SettingsShell>
  );
}
