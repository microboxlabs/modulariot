"use client";

import { SettingsSelectField } from "./settings-fields";
import { PgrestSettingsSection } from "./pgrest-settings-section";
import { PlannerVariableSelector } from "./planner-variable-selector";
import type { usePgrestSettingsState } from "./use-pgrest-settings-state";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { buildPgrestContentLabels } from "./pgrest-settings-helpers";

type SimpleDataMode = "static" | "pgrest" | "planner";

interface PgrestDataTabProps {
  id: string;
  dataMode: SimpleDataMode;
  onDataModeChange: (mode: SimpleDataMode) => void;
  pgrest: ReturnType<typeof usePgrestSettingsState>;
  dictionary: I18nRecord;
  plannerVariableName?: string;
  onPlannerVariableNameChange?: (name: string) => void;
}

/**
 * Reusable data-provider tab content for card-style dashlet settings.
 * Renders a static/pgrest/planner mode selector and, when pgrest is selected,
 * the full PgrestSettingsSection.
 */
export function PgrestDataTab({
  id,
  dataMode,
  onDataModeChange,
  pgrest,
  dictionary,
  plannerVariableName,
  onPlannerVariableNameChange,
}: Readonly<PgrestDataTabProps>) {
  const labels = buildPgrestContentLabels(dictionary);

  return (
    <>
      <SettingsSelectField
        id={id}
        label={tr("dashboard.settings.dataSource", dictionary)}
        value={dataMode}
        onChange={(v) => onDataModeChange(v as SimpleDataMode)}
        options={[
          {
            value: "static",
            label: tr("dashboard.settings.staticJson", dictionary),
          },
          {
            value: "pgrest",
            label: tr("dashboard.settings.pgrest", dictionary),
          },
          {
            value: "planner",
            label: "Planner",
          },
        ]}
      />
      {dataMode === "pgrest" && (
        <PgrestSettingsSection pgrest={pgrest} dictionary={dictionary} labels={labels} />
      )}
      {dataMode === "planner" && onPlannerVariableNameChange && (
        <PlannerVariableSelector
          label="Variable"
          value={plannerVariableName ?? ""}
          onChange={onPlannerVariableNameChange}
        />
      )}
    </>
  );
}
