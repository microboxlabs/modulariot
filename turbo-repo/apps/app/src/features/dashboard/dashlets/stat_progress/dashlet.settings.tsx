"use client";

import { SimpleDashletSettings } from "../common";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import { useBarColorSettings, BarColorRulesEditor } from "./value-color-rules";

const FIELDS = [
  {
    id: "sp-title",
    labelKey: "common.title",
    state: "title",
    hbPlaceholder: "{{row.label}}",
    staticPlaceholder: "Quarterly Goal",
  },
  {
    id: "sp-value",
    labelKey: "common.value",
    state: "value",
    hbPlaceholder: "{{row.current}}",
    staticPlaceholder: "78",
  },
  {
    id: "sp-target",
    labelKey: "common.target",
    state: "target",
    hbPlaceholder: "{{row.target}}",
    staticPlaceholder: "100",
  },
  {
    id: "sp-unit",
    labelKey: "common.unit",
    state: "unit",
    hbPlaceholder: "{{row.unit}}",
    staticPlaceholder: "%",
  },
] as const;

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
