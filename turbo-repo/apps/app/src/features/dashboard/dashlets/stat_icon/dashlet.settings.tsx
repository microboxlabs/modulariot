"use client";

import { createSimpleDashletSettings } from "../common";

export const DashletSettings = createSimpleDashletSettings(
  [
    { id: "si-title", labelKey: "common.title", state: "title", hbPlaceholder: "{{row.label}}", staticPlaceholder: "Orders" },
    { id: "si-value", labelKey: "common.value", state: "value", hbPlaceholder: "{{row.count}}", staticPlaceholder: "156" },
    { id: "si-unit", labelKey: "common.unit", state: "unit", hbPlaceholder: "{{row.unit}}", staticPlaceholder: "" },
    { id: "si-subtitle", labelKey: "common.subtitle", state: "subtitle", hbPlaceholder: "{{row.subtitle}}", staticPlaceholder: "Last 24 hours" },
  ],
  "si",
  { thresholds: true },
);
