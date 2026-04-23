"use client";

import { SimpleDashletSettings, createSettingsField } from "../common/simple-dashlet-settings";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import {
  useValueColorSettings,
  ValueColorRulesEditor,
} from "./value-color-rules";

const FIELDS = [
  createSettingsField(
    "sd-title",
    "common.title",
    "title",
    "{{row.label}}",
    "Monthly Revenue"
  ),
  createSettingsField(
    "sd-value",
    "common.value",
    "value",
    "{{row.current}}",
    "84500"
  ),
  createSettingsField(
    "sd-prev",
    "common.previousValue",
    "previousValue",
    "{{row.previous}}",
    "72000"
  ),
  createSettingsField("sd-unit", "common.unit", "unit", "{{row.unit}}", "$"),
  createSettingsField(
    "sd-desc",
    "common.description",
    "description",
    "{{row.description}}",
    "Total monthly revenue across all products"
  ),
  createSettingsField(
    "sd-target",
    "common.target",
    "target",
    "{{row.target}}",
    "100000"
  ),
];

export function DashletSettings(
  props: Readonly<DashletSettingsProps<DashletConfig>>
) {
  const valueColorRules = useValueColorSettings(props.config);

  return (
    <SimpleDashletSettings
      fields={FIELDS}
      idPrefix="sd"
      settingsProps={props}
      extraSaveFields={{
        ...valueColorRules.buildSavePayload(),
      }}
      extraVisualization={
        <ValueColorRulesEditor
          rules={valueColorRules.rules}
          dictionary={props.dictionary}
          onAdd={valueColorRules.addRule}
          onRemove={valueColorRules.removeRule}
          onUpdate={valueColorRules.updateRule}
          onToggleTarget={valueColorRules.toggleTarget}
        />
      }
    />
  );
}
