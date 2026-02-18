"use client";

import { useState } from "react";
import { Label, ToggleSwitch } from "flowbite-react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig, TextAlign } from "./dashlet";
import {
  DashletSettingsWrapper,
  SettingsTextareaField,
  SettingsSelectField,
} from "../common";

// ============================================================================
// Settings Component
// ============================================================================

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const [text, setText] = useState(
    config.text ?? "Add your text or quote here..."
  );
  const [italic, setItalic] = useState(config.italic ?? true);
  const [align, setAlign] = useState<TextAlign>(config.align ?? "left");

  const handleSave = () => {
    onSave({ text, italic, align } as DashletConfig);
    onClose();
  };

  return (
    <DashletSettingsWrapper
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      dictionary={dictionary}
    >
      <SettingsTextareaField
        id="text-card-text"
        label="Text"
        value={text}
        onChange={setText}
        placeholder="Add your text or quote here..."
        rows={4}
      />
      <SettingsSelectField
        id="text-card-align"
        label="Alignment"
        value={align}
        onChange={(v) => setAlign(v as TextAlign)}
        options={[
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
          { value: "right", label: "Right" },
        ]}
      />
      <div className="flex items-center justify-between">
        <Label className="text-sm">Italic</Label>
        <ToggleSwitch checked={italic} onChange={setItalic} label="" />
      </div>
    </DashletSettingsWrapper>
  );
}
