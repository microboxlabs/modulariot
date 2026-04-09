"use client";

import { createSimpleDashletSettings } from "../common";

export const DashletSettings = createSimpleDashletSettings(
  [
    { id: "sp-title", labelKey: "common.title", state: "title", hbPlaceholder: "{{row.label}}", staticPlaceholder: "Quarterly Goal" },
    { id: "sp-value", labelKey: "common.value", state: "value", hbPlaceholder: "{{row.current}}", staticPlaceholder: "78" },
    { id: "sp-target", labelKey: "common.target", state: "target", hbPlaceholder: "{{row.target}}", staticPlaceholder: "100" },
    { id: "sp-unit", labelKey: "common.unit", state: "unit", hbPlaceholder: "{{row.unit}}", staticPlaceholder: "%" },
  ],
  "sp",
  { thresholds: true },
);
