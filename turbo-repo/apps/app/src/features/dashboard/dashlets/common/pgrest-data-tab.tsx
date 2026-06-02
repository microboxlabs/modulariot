"use client";

import { useMemo } from "react";
import { Label, Textarea } from "flowbite-react";
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
  onPlannerSchemaDetected?: (keys: string[]) => void;
  dataSourceId?: string;
  onDataSourceIdChange?: (id: string) => void;
  activeProviders?: DataSourceOption[];
  staticData?: string;
  onStaticDataChange?: (v: string) => void;
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
  onPlannerSchemaDetected,
  dataSourceId,
  onDataSourceIdChange,
  activeProviders,
  staticData = "",
  onStaticDataChange,
}: Readonly<PgrestDataTabProps>) {
  const labels = buildPgrestContentLabels(dictionary);

  const jsonError = useMemo(() => {
    if (!staticData.trim()) return null;
    try { JSON.parse(staticData); return null; }
    catch { return "Invalid JSON"; }
  }, [staticData]);

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
      {dataMode === "static" && onStaticDataChange && (
        <div>
          <Label className="mb-1 block text-xs font-normal text-gray-500 dark:text-gray-400">
            Static JSON
          </Label>
          <Textarea
            value={staticData}
            onChange={(e) => onStaticDataChange(e.target.value)}
            placeholder={'{\n  "value": "156",\n  "label": "Orders"\n}'}
            rows={6}
            className="font-mono text-xs"
            color={jsonError ? "failure" : "gray"}
          />
          {jsonError && (
            <p className="mt-1 text-xs text-red-500">{jsonError}</p>
          )}
          {!jsonError && staticData.trim() && (
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Use <span className="font-mono">{"{{row.key}}"}</span> in fields to reference values.
            </p>
          )}
        </div>
      )}
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
          onSchemaDetected={onPlannerSchemaDetected}
        />
      )}
    </>
  );
}
