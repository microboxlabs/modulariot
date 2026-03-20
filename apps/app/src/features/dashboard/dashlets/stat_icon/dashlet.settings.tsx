"use client";

import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import { SimpleDashletSettings } from "../common";

const FIELDS = [
  { id: "si-title", labelKey: "common.title", state: "title", hbPlaceholder: "{{row.label}}", staticPlaceholder: "Orders" },
  { id: "si-value", labelKey: "common.value", state: "value", hbPlaceholder: "{{row.count}}", staticPlaceholder: "156" },
  { id: "si-unit", labelKey: "common.unit", state: "unit", hbPlaceholder: "{{row.unit}}", staticPlaceholder: "" },
  { id: "si-subtitle", labelKey: "common.subtitle", state: "subtitle", hbPlaceholder: "{{row.subtitle}}", staticPlaceholder: "Last 24 hours" },
] as const;

export function DashletSettings(
  props: Readonly<DashletSettingsProps<DashletConfig>>,
) {
  return (
    <SimpleDashletSettings
      fields={FIELDS}
      idPrefix="si"
      settingsProps={props}
    />
  );
}
