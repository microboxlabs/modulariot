"use client";

import { useState } from "react";
import { Label, ToggleSwitch } from "flowbite-react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import { SimpleDashletSettings } from "../common/simple-dashlet-settings";

const FIELDS = [
  { id: "ss-title", labelKey: "common.title", state: "title", hbPlaceholder: "{{row.label}}", staticPlaceholder: "Account Balance" },
  { id: "ss-value", labelKey: "common.value", state: "value", hbPlaceholder: "{{row.balance}}", staticPlaceholder: "125847.32" },
  { id: "ss-unit", labelKey: "common.unit", state: "unit", hbPlaceholder: "{{row.currency}}", staticPlaceholder: "$" },
] as const;

export function DashletSettings(
  props: Readonly<DashletSettingsProps<DashletConfig>>,
) {
  const [isSensitive, setIsSensitive] = useState(
    props.config.isSensitive ?? true,
  );

  return (
    <SimpleDashletSettings
      fields={FIELDS}
      idPrefix="ss"
      settingsProps={props}
      thresholds
      extraSaveFields={{ isSensitive }}
      extraVisualization={
        <div className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700">
          <div>
            <Label className="text-sm font-medium">Hidden by default</Label>
            <p className="text-xs text-gray-500">User must click to reveal</p>
          </div>
          <ToggleSwitch
            checked={isSensitive}
            onChange={setIsSensitive}
            label=""
          />
        </div>
      }
    />
  );
}
