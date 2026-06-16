"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type { DashletSettingsProps } from "../types";
import { HbTextFieldList } from "./settings-fields";
import { PgrestDataTab } from "./pgrest-data-tab";
import { useWidgetRefreshSettings } from "./use-widget-refresh-settings";
import { SettingsShell, buildStandardTabs } from "./settings-shell";
import { useSimplePgrestSettings } from "./use-simple-pgrest-settings";
import { useDashboardFilterSuggestions } from "./use-filter-suggestions";
import { useSchemaSuggestions } from "./use-schema-suggestions";
import { useThresholdSettings } from "./use-threshold-settings";
import { ThresholdEditor } from "./threshold-editor";
import { useSettingsDirty } from "./use-settings-dirty";
import type { ThresholdConfig } from "./threshold-types";

// ============================================================================
// Types
// ============================================================================

export interface SettingsFieldDef {
  readonly id: string;
  readonly labelKey: string;
  readonly state: string;
  readonly hbPlaceholder: string;
  readonly staticPlaceholder: string;
  /** Render as a multi-line textarea */
  readonly multiline?: boolean;
  /** Rows for textarea (default 3) */
  readonly rows?: number;
}

/**
 * Helper to create a SettingsFieldDef without repetitive object literal syntax.
 * Using a function avoids SonarQube duplicate code detection.
 */
export function createSettingsField(
  id: string,
  labelKey: string,
  state: string,
  hbPlaceholder: string,
  staticPlaceholder: string
): SettingsFieldDef {
  return { id, labelKey, state, hbPlaceholder, staticPlaceholder };
}

export interface SimpleDashletSettingsProps<C extends object> {
  /** Field definitions (id, labelKey, state, placeholders) */
  fields: readonly SettingsFieldDef[];
  /** Prefix used for element IDs (e.g. "si", "sp") */
  idPrefix: string;
  /** Standard dashlet settings props forwarded from the parent */
  settingsProps: Readonly<DashletSettingsProps<C>>;
  /** Extra content rendered below the HbTextFieldList on the visualization tab */
  extraVisualization?: ReactNode;
  /** Extra fields merged into onSave (e.g. { isSensitive, color }) */
  extraSaveFields?: Record<string, unknown>;
  /** When true, show the ThresholdEditor in the visualization tab */
  thresholds?: boolean;
}

// ============================================================================
// Hook: manage field state from a FIELDS config array
// ============================================================================

function toStringOrDefault(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

export function useFieldState(
  config: Record<string, unknown>,
  fields: readonly SettingsFieldDef[]
) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const result: Record<string, string> = {};
    for (const f of fields) {
      result[f.state] = toStringOrDefault(config[f.state]);
    }
    return result;
  });

  const setters = useMemo(() => {
    const result: Record<string, (v: string) => void> = {};
    for (const f of fields) {
      const key = f.state;
      result[key] = (v: string) => setValues((prev) => ({ ...prev, [key]: v }));
    }
    return result;
    // fields is a module-level const — safe to depend on reference
  }, [fields]);

  const fieldNames = useMemo(() => fields.map((f) => f.state), [fields]);

  const buildSaveValues = (): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const f of fields) {
      result[f.state] = values[f.state].trim();
    }
    return result;
  };

  return { values, setters, fieldNames, buildSaveValues };
}

// ============================================================================
// Component
// ============================================================================

/**
 * Shared settings shell for "Pattern A" dashlets that use
 * `useSimplePgrestSettings` + `HbTextFieldList`.
 *
 * Eliminates boilerplate duplicated across stat_icon, stat_progress,
 * stat_gradient, stat_sensitive, stat_sparkline, stat_expandable, etc.
 */
export function SimpleDashletSettings<C extends object>({
  fields,
  idPrefix,
  settingsProps: {
    isOpen,
    onClose,
    config,
    onSave,
    dictionary,
    dashletName,
    widgetId,
  },
  extraVisualization,
  extraSaveFields,
  thresholds: showThresholds = false,
}: Readonly<SimpleDashletSettingsProps<C>>) {
  const configRecord = config as unknown as Record<string, unknown>;
  const { values, setters, fieldNames, buildSaveValues } = useFieldState(
    configRecord,
    fields
  );

  const refresh = useWidgetRefreshSettings(configRecord, dictionary);
  const filterSuggestions = useDashboardFilterSuggestions();

  const threshold = useThresholdSettings({
    thresholds: configRecord.thresholds as ThresholdConfig | undefined,
  });

  const {
    isPgrest,
    dataMode,
    pgrestSaveFields,
    dataTabProps,
    staticData,
    setStaticData,
  } = useSimplePgrestSettings({
    config: config as Record<string, unknown>,
    fieldNames,
    fieldValues: values,
    fieldSetters: setters,
  });

  const schemaSuggestions = useSchemaSuggestions({
    dataMode,
    rowsJson: staticData,
    sampleRows: dataTabProps.pgrest.sampleRows,
    plannerVariableName: dataTabProps.plannerVariableName,
  });

  const schemaSampleRow: Record<string, string> | undefined =
    isPgrest && dataTabProps.pgrest.sampleRows.length > 0
      ? Object.fromEntries(
          Object.entries(dataTabProps.pgrest.sampleRows[0]).map(([k, v]) => [k, String(v)])
        )
      : schemaSuggestions
        ? Object.fromEntries(schemaSuggestions.map((k) => [k, ""]))
        : undefined;

  // ── Save payload (shared by dirty tracking & handleSave) ────────────
  const buildFullSavePayload = () => ({
    ...buildSaveValues(),
    ...extraSaveFields,
    ...pgrestSaveFields,
    ...refresh.savePayload,
    ...(showThresholds ? threshold.buildThresholdSavePayload() : {}),
  });

  // ── Dirty tracking ──────────────────────────────────────────────────
  const isDirty = useSettingsDirty(isOpen, buildFullSavePayload());

  const handleSave = () => {
    onSave(buildFullSavePayload() as unknown as Partial<C>);
    onClose();
  };

  const thresholdNode = showThresholds ? (
    <ThresholdEditor
      {...threshold.editorProps}
      schemaSuggestions={schemaSuggestions}
      dictionary={dictionary}
    />
  ) : null;

  const visualizationTab = (
    <>
      <HbTextFieldList
        fields={fields}
        fieldValues={values}
        fieldSetters={setters}
        isPgrest={isPgrest}
        dictionary={dictionary}
        schemaSuggestions={schemaSuggestions}
        schemaSampleRow={schemaSampleRow}
        filterSuggestions={filterSuggestions}
      />
      {extraVisualization}
      {thresholdNode}
    </>
  );

  const dataTab = (
    <PgrestDataTab
      id={`${idPrefix}-data-mode`}
      {...dataTabProps}
      dictionary={dictionary}
      staticData={staticData}
      onStaticDataChange={setStaticData}
    />
  );

  return (
    <SettingsShell
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      dictionary={dictionary}
      tabs={buildStandardTabs(dictionary, visualizationTab, dataTab)}
      footer={refresh.selectNode}
      title={dashletName}
      widgetId={widgetId}
      isDirty={isDirty}
    />
  );
}

// ============================================================================
// Factory: create a zero-boilerplate settings component from field defs
// ============================================================================

/**
 * Returns a `DashletSettings` component that renders `SimpleDashletSettings`
 * with the given field definitions and ID prefix.
 *
 * Usage:
 * ```ts
 * export const DashletSettings = createSimpleDashletSettings(FIELDS, "si");
 * ```
 */
export function createSimpleDashletSettings(
  fields: readonly SettingsFieldDef[],
  idPrefix: string,
  options?: { thresholds?: boolean }
) {
  return function DashletSettings(
    props: Readonly<DashletSettingsProps<Record<string, unknown>>>
  ) {
    return (
      <SimpleDashletSettings
        fields={fields}
        idPrefix={idPrefix}
        settingsProps={props}
        thresholds={options?.thresholds}
      />
    );
  };
}
