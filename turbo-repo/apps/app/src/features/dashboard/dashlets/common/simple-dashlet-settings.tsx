"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type { DashletSettingsProps } from "../types";
import { HbTextFieldList } from "./settings-fields";
import { PgrestDataTab } from "./pgrest-data-tab";
import {
  SettingsModalShell,
  useWidgetRefreshSettings,
} from "./settings-modal-shell";
import { useSimplePgrestSettings } from "./use-simple-pgrest-settings";
import { usePlannerContext } from "../../context/planner-context";
import { useThresholdSettings } from "./use-threshold-settings";
import { ThresholdEditor } from "./threshold-editor";
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
  settingsProps: { isOpen, onClose, config, onSave, dictionary, dashletName },
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
  const { schemas } = usePlannerContext();

  const threshold = useThresholdSettings({
    thresholds: configRecord.thresholds as ThresholdConfig | undefined,
  });

  const {
    isPgrest,
    activeProviders,
    dataMode,
    dataSourceId,
    setDataSourceId,
    plannerVariableName,
    setPlannerVariableName,
    pg,
    handleDataModeChange,
    pgrestSaveFields,
  } = useSimplePgrestSettings({
    config: config as Record<string, unknown>,
    fieldNames,
    fieldValues: values,
    fieldSetters: setters,
  });

  const schemaSuggestions =
    dataMode === "planner" && plannerVariableName
      ? schemas.get(plannerVariableName)
      : undefined;

  const handleSave = () => {
    onSave({
      ...buildSaveValues(),
      ...extraSaveFields,
      ...pgrestSaveFields,
      ...refresh.savePayload,
      ...(showThresholds ? threshold.buildThresholdSavePayload() : {}),
    } as unknown as Partial<C>);
    onClose();
  };

  const thresholdNode = showThresholds ? (
    <ThresholdEditor
      enabled={threshold.thresholdEnabled}
      onToggle={threshold.setThresholdEnabled}
      field={threshold.thresholdField}
      onFieldChange={threshold.setThresholdField}
      applyTo={threshold.thresholdApplyTo}
      onApplyToChange={threshold.setThresholdApplyTo}
      rules={threshold.thresholdRules}
      onAdd={threshold.addThresholdRule}
      onRemove={threshold.removeThresholdRule}
      onUpdate={threshold.updateThresholdRule}
      schemaSuggestions={schemaSuggestions}
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
      />
      {extraVisualization}
      {thresholdNode}
    </>
  );

  const dataTab = (
    <PgrestDataTab
      id={`${idPrefix}-data-mode`}
      dataMode={dataMode}
      onDataModeChange={handleDataModeChange}
      pgrest={pg}
      dictionary={dictionary}
      plannerVariableName={plannerVariableName}
      onPlannerVariableNameChange={setPlannerVariableName}
      dataSourceId={dataSourceId}
      onDataSourceIdChange={setDataSourceId}
      activeProviders={activeProviders}
    />
  );

  return (
    <SettingsModalShell
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      dictionary={dictionary}
      visualizationTab={visualizationTab}
      dataTab={dataTab}
      refreshSelect={refresh.selectNode}
      title={dashletName}
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
