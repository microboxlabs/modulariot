"use client";

import { SettingsSelectField } from "./settings-fields";
import { PgrestSettingsSection } from "./pgrest-settings-section";
import { PlannerVariableSelector } from "./planner-variable-selector";
import type { usePgrestSettingsState } from "./use-pgrest-settings-state";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { buildPgrestContentLabels } from "./pgrest-settings-helpers";
import type { SimpleDataMode } from "./use-simple-pgrest-settings";

interface DataSourceOption {
  id: string;
  name: string;
}

interface PgrestDataTabProps {
  id: string;
  dataMode: SimpleDataMode;
  onDataModeChange: (mode: SimpleDataMode) => void;
  pgrest: ReturnType<typeof usePgrestSettingsState>;
  dictionary: I18nRecord;
  plannerVariableName?: string;
  onPlannerVariableNameChange?: (name: string) => void;
  dataSourceId?: string;
  onDataSourceIdChange?: (id: string) => void;
  activeProviders?: DataSourceOption[];
}

/**
 * Reusable data-provider tab content for card-style dashlet settings.
 * Renders a static/pgrest/planner mode selector and, when pgrest is selected,
 * the full PgrestSettingsSection (including Data Source Provider dropdown).
 */
export function PgrestDataTab({
  id,
  dataMode,
  onDataModeChange,
  pgrest,
  dictionary,
  plannerVariableName,
  onPlannerVariableNameChange,
  dataSourceId,
  onDataSourceIdChange,
  activeProviders,
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
            label: tr("dashboard.settings.planner", dictionary),
          },
        ]}
      />
      {dataMode === "pgrest" && (
        <PgrestSettingsSection
          pgrest={pgrest}
          dictionary={dictionary}
          labels={labels}
          dataSourceId={dataSourceId}
          onDataSourceIdChange={onDataSourceIdChange}
          activeProviders={activeProviders}
        />
      )}
      {dataMode === "planner" && onPlannerVariableNameChange && (
        <PlannerVariableSelector
          label={tr("dashboard.settings.plannerVariable", dictionary)}
          value={plannerVariableName ?? ""}
          onChange={onPlannerVariableNameChange}
        />
      )}
    </>
  );
}
