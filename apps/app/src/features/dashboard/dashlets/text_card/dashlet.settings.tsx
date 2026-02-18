"use client";

import { useState } from "react";
import { Label, Textarea, ToggleSwitch } from "flowbite-react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig, TextAlign } from "./dashlet";
import {
  SettingsSelectField,
  getHandlebarsStatus,
  getFlowbiteColor,
  useDataProvider,
  TabbedSettingsWrapper,
} from "../common";

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const [text, setText] = useState(config.text ?? "Add your text or quote here...");
  const [italic, setItalic] = useState(config.italic ?? true);
  const [align, setAlign] = useState<TextAlign>(config.align ?? "left");

  const dp = useDataProvider(config.dataProvider ?? []);

  const handleSave = () => {
    onSave({
      text,
      italic,
      align,
      dataProvider: dp.getCleanEntries(),
    } as DashletConfig);
    onClose();
  };

  const textStatus = getHandlebarsStatus(text);

  return (
    <TabbedSettingsWrapper
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      dataProvider={dp}
      dictionary={dictionary}
    >
      <div>
        <Label htmlFor="tc-text" className="mb-1 block text-sm font-medium">
          Text
        </Label>
        <Textarea
          id="tc-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add your text or quote here..."
          rows={4}
          className="text-sm"
          color={getFlowbiteColor(textStatus)}
        />
      </div>
      <SettingsSelectField
        id="tc-align"
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
        <ToggleSwitch
          checked={italic}
          onChange={setItalic}
          label=""
        />
      </div>
    </TabbedSettingsWrapper>
  );
}
