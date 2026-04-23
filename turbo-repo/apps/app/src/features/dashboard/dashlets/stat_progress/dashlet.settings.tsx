"use client";

import { SimpleDashletSettings, createSettingsField } from "../common/simple-dashlet-settings";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import { useBarColorSettings, BarColorRulesEditor } from "./value-color-rules";

const FIELDS = [
  createSettingsField(
    "sp-title",
    "common.title",
    "title",
    "{{row.label}}",
    "Quarterly Goal"
  ),
  createSettingsField(
    "sp-value",
    "common.value",
    "value",
    "{{row.current}}",
    "78"
  ),
  createSettingsField(
    "sp-target",
    "common.target",
    "target",
    "{{row.target}}",
    "100"
  ),
  createSettingsField("sp-unit", "common.unit", "unit", "{{row.unit}}", "%"),
];

export function DashletSettings(
  props: Readonly<DashletSettingsProps<DashletConfig>>
) {
  const barColorRules = useBarColorSettings(props.config);

  return (
    <SimpleDashletSettings
      fields={FIELDS}
      idPrefix="sp"
      settingsProps={props}
      thresholds
      extraSaveFields={{
        ...barColorRules.buildSavePayload(),
      }}
      extraVisualization={
        <BarColorRulesEditor
          rules={barColorRules.rules}
          dictionary={props.dictionary}
          onAdd={barColorRules.addRule}
          onRemove={barColorRules.removeRule}
          onUpdate={barColorRules.updateRule}
        />
      }
    />
  );
}
