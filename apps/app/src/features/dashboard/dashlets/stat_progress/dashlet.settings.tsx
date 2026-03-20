"use client";

import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import { SimpleDashletSettings } from "../common";

const FIELDS = [
  { id: "sp-title", labelKey: "common.title", state: "title", hbPlaceholder: "{{row.label}}", staticPlaceholder: "Quarterly Goal" },
  { id: "sp-value", labelKey: "common.value", state: "value", hbPlaceholder: "{{row.current}}", staticPlaceholder: "78" },
  { id: "sp-target", labelKey: "common.target", state: "target", hbPlaceholder: "{{row.target}}", staticPlaceholder: "100" },
  { id: "sp-unit", labelKey: "common.unit", state: "unit", hbPlaceholder: "{{row.unit}}", staticPlaceholder: "%" },
] as const;

export function DashletSettings(
  props: Readonly<DashletSettingsProps<DashletConfig>>,
) {
  return (
    <SimpleDashletSettings
      fields={FIELDS}
      idPrefix="sp"
      settingsProps={props}
    />
  );
}
