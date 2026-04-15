"use client";

import { useState } from "react";
import { Button, TextInput, Label } from "flowbite-react";
import { HiPlus } from "react-icons/hi2";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import {
  SimpleDashletSettings,
  getHandlebarsStatus,
  getFlowbiteColor,
  DeleteItemButton,
} from "../common";
import { AdvancedColorPicker } from "@/features/common/components/advanced-color-picker";
import { tr } from "@/features/i18n/tr.service";
import {
  useValueColorSettings,
  ValueColorRulesEditor,
} from "./value-color-rules";

interface DetailWithId {
  id: string;
  label: string;
  value: string;
}

const FIELDS = [
  {
    id: "se-title",
    labelKey: "common.title",
    state: "title",
    hbPlaceholder: "{{row.label}}",
    staticPlaceholder: "Conversion Rate",
  },
  {
    id: "se-value",
    labelKey: "common.value",
    state: "value",
    hbPlaceholder: "{{row.rate}}",
    staticPlaceholder: "3.24",
  },
  {
    id: "se-unit",
    labelKey: "common.unit",
    state: "unit",
    hbPlaceholder: "{{row.unit}}",
    staticPlaceholder: "%",
  },
] as const;

export function DashletSettings(
  props: Readonly<DashletSettingsProps<DashletConfig>>
) {
  const { config, dictionary } = props;

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
  const [valueColor, setValueColor] = useState(config.valueColor ?? "");

  const colorRules = useValueColorSettings({ valueColorRules: config.valueColorRules });

  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

  const addDetail = () =>
    setDetails([...details, { id: crypto.randomUUID(), label: "", value: "" }]);

  const removeDetail = (id: string) =>
    setDetails(details.filter((d) => d.id !== id));

  const updateDetail = (id: string, field: "label" | "value", val: string) => {
    setDetails(details.map((d) => (d.id === id ? { ...d, [field]: val } : d)));
  };

  return (
    <SimpleDashletSettings
      fields={FIELDS}
      idPrefix="se"
      settingsProps={props}
      extraSaveFields={{
        details: details.map(({ label, value }) => ({ label, value })),
        valueColor,
        ...colorRules.buildSavePayload(),
      }}
      extraVisualization={
        <div className="space-y-2">
          {/* Value color picker */}
          <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700">
            <Label className="text-sm font-medium">
              {tr("dashboard.settings.valueColor", dictionary)}
            </Label>
            <AdvancedColorPicker
              value={valueColor}
              onChange={setValueColor}
              title={tr("dashboard.settings.selectColor", dictionary)}
            />
          </div>
          {/* Color rules */}
          <ValueColorRulesEditor
            rules={colorRules.rules}
            dictionary={dictionary}
            onAdd={colorRules.addRule}
            onRemove={colorRules.removeRule}
            onUpdate={colorRules.updateRule}
            onToggleTarget={colorRules.toggleTarget}
          />
          {/* Expandable Details */}
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
                placeholder="{{row.label}}"
                sizing="sm"
                className="flex-1"
                color={getFlowbiteColor(getHandlebarsStatus(d.label))}
              />
              <TextInput
                value={d.value}
                onChange={(e) => updateDetail(d.id, "value", e.target.value)}
                placeholder="{{row.value}}"
                sizing="sm"
                className="flex-1"
                color={getFlowbiteColor(getHandlebarsStatus(d.value))}
              />
              <DeleteItemButton
                onClick={() => removeDetail(d.id)}
                ariaLabel="Delete detail"
              />
            </div>
          ))}
        </div>
      }
    />
  );
}
