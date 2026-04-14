"use client";

import { useState } from "react";
import { Label } from "flowbite-react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import { SimpleDashletSettings } from "../common";
import { AdvancedColorPicker } from "@/features/common/components/advanced-color-picker";
import { tr } from "@/features/i18n/tr.service";

const FIELDS = [
  { id: "sd-title", labelKey: "common.title", state: "title", hbPlaceholder: "{{row.label}}", staticPlaceholder: "Monthly Revenue" },
  { id: "sd-value", labelKey: "common.value", state: "value", hbPlaceholder: "{{row.current}}", staticPlaceholder: "84500" },
  { id: "sd-prev", labelKey: "common.previousValue", state: "previousValue", hbPlaceholder: "{{row.previous}}", staticPlaceholder: "72000" },
  { id: "sd-unit", labelKey: "common.unit", state: "unit", hbPlaceholder: "{{row.unit}}", staticPlaceholder: "$" },
  { id: "sd-desc", labelKey: "common.description", state: "description", hbPlaceholder: "{{row.description}}", staticPlaceholder: "Total monthly revenue across all products" },
  { id: "sd-target", labelKey: "common.target", state: "target", hbPlaceholder: "{{row.target}}", staticPlaceholder: "100000" },
] as const;

export function DashletSettings(props: Readonly<DashletSettingsProps<DashletConfig>>) {
  const { config, dictionary } = props;
  const [valueColor, setValueColor] = useState(config.valueColor ?? "");

  return (
    <SimpleDashletSettings
      fields={FIELDS}
      idPrefix="sd"
      settingsProps={props}
      thresholds
      extraSaveFields={{ valueColor }}
      extraVisualization={
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
      }
    />
  );
}
