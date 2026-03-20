"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type { DashletSettingsProps } from "../types";
import { HbTextFieldList } from "./settings-fields";
import { PgrestDataTab } from "./pgrest-data-tab";
import { SettingsModalShell } from "./settings-modal-shell";
import { useSimplePgrestSettings } from "./use-simple-pgrest-settings";

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
}

// ============================================================================
// Hook: manage field state from a FIELDS config array
// ============================================================================

export function useFieldState(
  config: Record<string, unknown>,
  fields: readonly SettingsFieldDef[],
) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const result: Record<string, string> = {};
    for (const f of fields) {
      const v = config[f.state];
      result[f.state] =
        typeof v === "string"
          ? v
          : typeof v === "number" || typeof v === "boolean"
            ? String(v)
            : f.staticPlaceholder;
    }
    return result;
  });

  const setters = useMemo(() => {
    const result: Record<string, (v: string) => void> = {};
    for (const f of fields) {
      const key = f.state;
      result[key] = (v: string) =>
        setValues((prev) => ({ ...prev, [key]: v }));
    }
    return result;
    // fields is a module-level const — safe to depend on reference
  }, [fields]);

  const fieldNames = useMemo(() => fields.map((f) => f.state), [fields]);

  const buildSaveValues = (): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const f of fields) {
      result[f.state] = values[f.state].trim() || f.staticPlaceholder;
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
  settingsProps: { isOpen, onClose, config, onSave, dictionary },
  extraVisualization,
  extraSaveFields,
}: Readonly<SimpleDashletSettingsProps<C>>) {
  const configRecord = config as unknown as Record<string, unknown>;
  const { values, setters, fieldNames, buildSaveValues } = useFieldState(
    configRecord,
    fields,
  );

  const {
    isPgrest,
    activeProviders,
    dataMode,
    dataSourceId,
    setDataSourceId,
    pg,
    handleDataModeChange,
    pgrestSaveFields,
  } = useSimplePgrestSettings({
    config: config as Record<string, unknown>,
    fieldNames,
    fieldValues: values,
    fieldSetters: setters,
  });

  const handleSave = () => {
    onSave({
      ...buildSaveValues(),
      ...extraSaveFields,
      ...pgrestSaveFields,
    } as unknown as Partial<C>);
    onClose();
  };

  const visualizationTab = extraVisualization ? (
    <>
      <HbTextFieldList
        fields={fields}
        fieldValues={values}
        fieldSetters={setters}
        isPgrest={isPgrest}
        dictionary={dictionary}
      />
      {extraVisualization}
    </>
  ) : (
    <HbTextFieldList
      fields={fields}
      fieldValues={values}
      fieldSetters={setters}
      isPgrest={isPgrest}
      dictionary={dictionary}
    />
  );

  const dataTab = (
    <PgrestDataTab
      id={`${idPrefix}-data-mode`}
      dataMode={dataMode}
      onDataModeChange={handleDataModeChange}
      pgrest={pg}
      dictionary={dictionary}
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
) {
  return function DashletSettings(
    props: Readonly<DashletSettingsProps<Record<string, unknown>>>,
  ) {
    return (
      <SimpleDashletSettings
        fields={fields}
        idPrefix={idPrefix}
        settingsProps={props}
      />
    );
  };
}
