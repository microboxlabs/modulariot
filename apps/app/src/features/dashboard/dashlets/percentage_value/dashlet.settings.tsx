"use client";

import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import { SimpleDashletSettings } from "../common";

const FIELDS = [
  { id: "pv-title", labelKey: "common.title", state: "title", hbPlaceholder: "{{row.label}}", staticPlaceholder: "Progress" },
  { id: "pv-value", labelKey: "common.value", state: "value", hbPlaceholder: "{{row.current}}", staticPlaceholder: "6" },
  { id: "pv-max", labelKey: "common.max", state: "max", hbPlaceholder: "{{row.total}}", staticPlaceholder: "10" },
] as const;

export function DashletSettings(
  props: Readonly<DashletSettingsProps<DashletConfig>>,
) {
  return (
    <SimpleDashletSettings
      fields={FIELDS}
      idPrefix="pv"
      settingsProps={props}
    />
  );
}
