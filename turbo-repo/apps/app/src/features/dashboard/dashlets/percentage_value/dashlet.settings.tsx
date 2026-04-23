"use client";

import { useState } from "react";
import { Label } from "flowbite-react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import { SimpleDashletSettings } from "../common";
import { AdvancedColorPicker } from "@/features/common/components/advanced-color-picker";
import { tr } from "@/features/i18n/tr.service";
import {
  useProgressBarColorSettings,
  ProgressBarColorRulesEditor,
} from "./progress-bar-color-rules";

/** Field config for the three percentage_value text fields */
const PERCENTAGE_FIELDS = [
  {
    id: "pv-title",
    labelKey: "common.title",
    state: "title",
    hbPlaceholder: "{{row.label}}",
    staticPlaceholder: "Progress",
  },
  {
    id: "pv-value",
    labelKey: "common.value",
    state: "value",
    hbPlaceholder: "{{row.current}}",
    staticPlaceholder: "6",
  },
  {
    id: "pv-max",
    labelKey: "common.max",
    state: "max",
    hbPlaceholder: "{{row.total}}",
    staticPlaceholder: "10",
  },
] as const;

/**
 * Settings Modal for Percentage Value Dashlet
 */
export function DashletSettings(
  props: Readonly<DashletSettingsProps<DashletConfig>>
) {
  const { config, dictionary } = props;
  const [barColor, setBarColor] = useState(config.barColor ?? "2563eb");
  const barColorRules = useProgressBarColorSettings(config);

  return (
    <SimpleDashletSettings
      fields={PERCENTAGE_FIELDS}
      idPrefix="pv"
      settingsProps={props}
      extraSaveFields={{
        barColor,
        ...barColorRules.buildSavePayload(),
      }}
      extraVisualization={
        <>
          <div className="mt-3 flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700">
            <Label className="text-sm font-medium">
              {tr("dashboard.settings.barColor", dictionary)}
            </Label>
            <AdvancedColorPicker
              value={barColor}
              onChange={setBarColor}
              title={tr("dashboard.settings.selectColor", dictionary)}
            />
          </div>
          <ProgressBarColorRulesEditor
            evalMode={barColorRules.evalMode}
            onEvalModeChange={barColorRules.setEvalMode}
            rules={barColorRules.rules}
            onAdd={barColorRules.addRule}
            onRemove={barColorRules.removeRule}
            onUpdate={barColorRules.updateRule}
            dictionary={dictionary}
          />
        </>
      }
    />
  );
}
