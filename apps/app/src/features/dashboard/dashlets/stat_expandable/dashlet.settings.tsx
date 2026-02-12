"use client";

import { useState } from "react";
import { Button, TextInput, Label } from "flowbite-react";
import { HiPlus, HiTrash } from "react-icons/hi2";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import { DashletSettingsWrapper, SettingsTitleValueUnit } from "../common";

interface DetailWithId {
  id: string;
  label: string;
  value: string;
}

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const [title, setTitle] = useState(config.title || "Conversion Rate");
  const [value, setValue] = useState(config.value || 3.24);
  const [unit, setUnit] = useState(config.unit || "%");

  // Initialize details with unique IDs
  const initializeDetails = (): DetailWithId[] => {
    const defaultDetails = [
      { label: "Visitors", value: "12,847" },
      { label: "Conversions", value: "416" },
    ];
    return (config.details || defaultDetails).map((d) => ({
      ...d,
      id: crypto.randomUUID(),
    }));
  };

  const [details, setDetails] = useState(initializeDetails);

  const handleSave = () => {
    const detailsToSave = details.map(({ label, value }) => ({ label, value }));
    onSave({ title, value, unit, details: detailsToSave });
    onClose();
  };

  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

  const addDetail = () =>
    setDetails([...details, { id: crypto.randomUUID(), label: "", value: "" }]);

  const removeDetail = (id: string) =>
    setDetails(details.filter((d) => d.id !== id));

  const updateDetail = (id: string, field: "label" | "value", val: string) => {
    setDetails(details.map((d) => (d.id === id ? { ...d, [field]: val } : d)));
  };

  return (
    <DashletSettingsWrapper
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      width="w-80"
      scrollable
      dictionary={dictionary}
    >
      <SettingsTitleValueUnit
        title={title}
        onTitleChange={setTitle}
        value={value}
        onValueChange={setValue}
        unit={unit}
        onUnitChange={setUnit}
        valueStep="0.01"
        dictionary={dictionary}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Expandable Details</Label>
          <Button
            size="xs"
            color="light"
            onClick={addDetail}
            onMouseDown={handleMouseDown}
            className="no-drag"
          >
            <HiPlus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>
        {details.map((d) => (
          <div key={d.id} className="flex items-center gap-2">
            <TextInput
              value={d.label}
              onChange={(e) => updateDetail(d.id, "label", e.target.value)}
              placeholder="Label"
              sizing="sm"
              className="flex-1"
            />
            <TextInput
              value={d.value}
              onChange={(e) => updateDetail(d.id, "value", e.target.value)}
              placeholder="Value"
              sizing="sm"
              className="flex-1"
            />
            <Button
              size="xs"
              color="failure"
              onClick={() => removeDetail(d.id)}
              onMouseDown={handleMouseDown}
              className="no-drag"
            >
              <HiTrash className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </DashletSettingsWrapper>
  );
}
