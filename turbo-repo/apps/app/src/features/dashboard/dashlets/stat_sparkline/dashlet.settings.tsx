"use client";

import { useState } from "react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import { SimpleDashletSettings, SettingsTextField } from "../common";
import { tr } from "@/features/i18n/tr.service";

const FIELDS = [
  { id: "sk-title", labelKey: "common.title", state: "title", hbPlaceholder: "{{row.label}}", staticPlaceholder: "Page Views" },
  { id: "sk-value", labelKey: "common.value", state: "value", hbPlaceholder: "{{row.count}}", staticPlaceholder: "24567" },
  { id: "sk-unit", labelKey: "common.unit", state: "unit", hbPlaceholder: "{{row.unit}}", staticPlaceholder: "" },
] as const;

const DEFAULT_SPARKLINE = [30, 45, 35, 50, 40, 60, 55, 70, 65, 80, 75, 90];

export function DashletSettings(
  props: Readonly<DashletSettingsProps<DashletConfig>>,
) {
  const { config, dictionary } = props;
  const [sparklineText, setSparklineText] = useState(
    (config.sparkline || DEFAULT_SPARKLINE).join(", "),
  );

  const sparkline = sparklineText
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n));

  return (
    <SimpleDashletSettings
      fields={FIELDS}
      idPrefix="sk"
      settingsProps={props}
      thresholds
      extraSaveFields={{
        sparkline: sparkline.length > 0 ? sparkline : [50, 50],
      }}
      extraVisualization={
        <SettingsTextField
          id="sparkline"
          label={tr("dashboard.settings.sparklineData", dictionary)}
          value={sparklineText}
          onChange={setSparklineText}
          placeholder="30, 45, 50, 60..."
        />
      }
    />
  );
}
