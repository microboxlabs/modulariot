"use client";

import { createSimpleDashletSettings } from "../common";

export const DashletSettings = createSimpleDashletSettings(
  [
    { id: "sd-title", labelKey: "common.title", state: "title", hbPlaceholder: "{{row.label}}", staticPlaceholder: "Monthly Revenue" },
    { id: "sd-value", labelKey: "common.value", state: "value", hbPlaceholder: "{{row.current}}", staticPlaceholder: "84500" },
    { id: "sd-prev", labelKey: "common.previousValue", state: "previousValue", hbPlaceholder: "{{row.previous}}", staticPlaceholder: "72000" },
    { id: "sd-unit", labelKey: "common.unit", state: "unit", hbPlaceholder: "{{row.unit}}", staticPlaceholder: "$" },
    { id: "sd-desc", labelKey: "common.description", state: "description", hbPlaceholder: "{{row.description}}", staticPlaceholder: "Total monthly revenue across all products" },
    { id: "sd-target", labelKey: "common.target", state: "target", hbPlaceholder: "{{row.target}}", staticPlaceholder: "100000" },
  ],
  "sd",
  { thresholds: true },
);
