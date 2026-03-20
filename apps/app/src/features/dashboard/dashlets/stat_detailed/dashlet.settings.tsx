"use client";

import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import { SimpleDashletSettings } from "../common";

const FIELDS = [
  { id: "sd-title", labelKey: "common.title", state: "title", hbPlaceholder: "{{row.label}}", staticPlaceholder: "Monthly Revenue" },
  { id: "sd-value", labelKey: "common.value", state: "value", hbPlaceholder: "{{row.current}}", staticPlaceholder: "84500" },
  { id: "sd-prev", labelKey: "common.previousValue", state: "previousValue", hbPlaceholder: "{{row.previous}}", staticPlaceholder: "72000" },
  { id: "sd-unit", labelKey: "common.unit", state: "unit", hbPlaceholder: "{{row.unit}}", staticPlaceholder: "$" },
  { id: "sd-desc", labelKey: "common.description", state: "description", hbPlaceholder: "{{row.description}}", staticPlaceholder: "Total monthly revenue across all products" },
  { id: "sd-target", labelKey: "common.target", state: "target", hbPlaceholder: "{{row.target}}", staticPlaceholder: "100000" },
] as const;

export function DashletSettings(
  props: Readonly<DashletSettingsProps<DashletConfig>>,
) {
  return (
    <SimpleDashletSettings
      fields={FIELDS}
      idPrefix="sd"
      settingsProps={props}
    />
  );
}
