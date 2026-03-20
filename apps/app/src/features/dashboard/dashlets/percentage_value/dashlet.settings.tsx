"use client";

import { createSimpleDashletSettings } from "../common";

export const DashletSettings = createSimpleDashletSettings(
  [
    { id: "pv-title", labelKey: "common.title", state: "title", hbPlaceholder: "{{row.label}}", staticPlaceholder: "Progress" },
    { id: "pv-value", labelKey: "common.value", state: "value", hbPlaceholder: "{{row.current}}", staticPlaceholder: "6" },
    { id: "pv-max", labelKey: "common.max", state: "max", hbPlaceholder: "{{row.total}}", staticPlaceholder: "10" },
  ],
  "pv",
);
