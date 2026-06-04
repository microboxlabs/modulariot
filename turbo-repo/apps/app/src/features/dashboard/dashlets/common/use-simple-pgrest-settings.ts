"use client";

import { useRef, useState } from "react";
import type { PgrestParam, PgrestHttpMethod } from "./pgrest-types";
import { fromPgrestParamItems } from "./pgrest-types";
import { usePgrestSettingsState } from "./use-pgrest-settings-state";
import { buildSimplePgrestConfig } from "./pgrest-settings-helpers";
import { useActiveProviders } from "./use-active-providers";

// ============================================================================
// Types
// ============================================================================

export type SimpleDataMode = "static" | "pgrest" | "planner";

/** Whether the data mode fetches from a remote source (pgrest or planner). */
export const isRemoteDataMode = (m: SimpleDataMode) => m === "pgrest" || m === "planner";

interface PgrestConfigFields {
  dataMode?: string;
  dataSourceId?: string;
  pgrestFunctionName?: string;
  pgrestParams?: PgrestParam[];
  pgrestHttpMethod?: PgrestHttpMethod;
  plannerVariableName?: string;
  staticData?: string;
}

interface UseSimplePgrestSettingsOptions<F extends string> {
  /** The dashlet config (must include pgrest fields) */
  config: PgrestConfigFields;
  /** Ordered field names that map to state */
  fieldNames: readonly F[];
  /** Current values for each field (keyed by field name) */
  fieldValues: Record<F, string>;
  /** State setters for each field (keyed by field name) */
  fieldSetters: Record<F, (v: string) => void>;
}

interface UseSimplePgrestSettingsReturn<F extends string> {
  dataMode: SimpleDataMode;
  dataSourceId: string;
  plannerVariableName: string;
  setPlannerVariableName: (name: string) => void;
  isPgrest: boolean;
  activeProviders: { id: string; name: string }[];
  pg: ReturnType<typeof usePgrestSettingsState>;
  handleDataModeChange: (mode: SimpleDataMode) => void;
  staticData: string;
  setStaticData: (v: string) => void;
  /** Spread into onSave to include all pgrest-related config fields */
  pgrestSaveFields: {
    dataMode: SimpleDataMode;
    pgrestFunctionName: string;
    pgrestParams: PgrestParam[];
    pgrestHttpMethod: PgrestHttpMethod;
    dataSourceId: string | undefined;
    plannerVariableName: string | undefined;
    staticData: string | undefined;
  };
  /** Setter for dataSourceId state */
  setDataSourceId: (id: string) => void;
  /** Pre-built fieldValues record for HbTextFieldList */
  fieldValues: Record<F, string>;
  /** Pre-built fieldSetters record for HbTextFieldList */
  fieldSetters: Record<F, (v: string) => void>;
  /** Props ready to spread onto <PgrestDataTab> (add id & dictionary). */
  dataTabProps: {
    dataMode: SimpleDataMode;
    onDataModeChange: (mode: SimpleDataMode) => void;
    pgrest: ReturnType<typeof usePgrestSettingsState>;
    plannerVariableName: string;
    onPlannerVariableNameChange: (name: string) => void;
    dataSourceId: string;
    onDataSourceIdChange: (id: string) => void;
    activeProviders: { id: string; name: string }[];
  };
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Consolidates the boilerplate shared by all "Pattern A" dashlet settings:
 * dataMode/dataSourceId state, static snapshot, pgrest settings state,
 * active providers, and the common pgrest save fields.
 */
export function useSimplePgrestSettings<F extends string>({
  config,
  fieldNames,
  fieldValues,
  fieldSetters,
}: UseSimplePgrestSettingsOptions<F>): UseSimplePgrestSettingsReturn<F> {
  const activeProviders = useActiveProviders();

  const [dataMode, setDataMode] = useState<SimpleDataMode>(
    config.dataMode === "static" || config.dataMode === "pgrest" || config.dataMode === "planner"
      ? config.dataMode
      : "static",
  );
  const [dataSourceId, setDataSourceId] = useState<string>(
    config.dataSourceId ?? "",
  );
  const [plannerVariableName, setPlannerVariableName] = useState<string>(
    config.plannerVariableName ?? "",
  );
  const [staticData, setStaticData] = useState<string>(config.staticData ?? "");

  // Snapshot of field values when entering pgrest mode
  const staticSnapshot = useRef({ ...fieldValues });

  const handleDataModeChange = (mode: SimpleDataMode) => {
    if (isRemoteDataMode(mode) && dataMode === "static") {
      staticSnapshot.current = { ...fieldValues };
    } else if (mode === "static" && isRemoteDataMode(dataMode)) {
      for (const key of fieldNames) {
        fieldSetters[key](staticSnapshot.current[key]);
      }
    }
    setDataMode(mode);
  };

  const pg = usePgrestSettingsState({
    ...buildSimplePgrestConfig(
      { ...config, dataSourceId: dataSourceId || undefined },
      (detected) => {
        for (let i = 0; i < fieldNames.length && i < detected.length; i++) {
          fieldSetters[fieldNames[i]](`{{row.${detected[i].key}}}`);
        }
      },
    ),
  });

  const isPgrest = isRemoteDataMode(dataMode);

  const pgrestSaveFields = {
    dataMode,
    pgrestFunctionName: pg.pgrestFunctionName,
    pgrestParams: fromPgrestParamItems(pg.pgrestParams),
    pgrestHttpMethod: pg.pgrestHttpMethod,
    dataSourceId: dataSourceId || undefined,
    plannerVariableName: dataMode === "planner" ? plannerVariableName : undefined,
    staticData: dataMode === "static" ? (staticData || undefined) : undefined,
  };

  /** Props ready to spread onto <PgrestDataTab> (add id & dictionary). */
  const dataTabProps = {
    dataMode,
    onDataModeChange: handleDataModeChange,
    pgrest: pg,
    plannerVariableName,
    onPlannerVariableNameChange: setPlannerVariableName,
    dataSourceId,
    onDataSourceIdChange: setDataSourceId,
    activeProviders,
  };

  return {
    dataMode,
    dataSourceId,
    setDataSourceId,
    plannerVariableName,
    setPlannerVariableName,
    staticData,
    setStaticData,
    isPgrest,
    activeProviders,
    pg,
    handleDataModeChange,
    pgrestSaveFields,
    fieldValues,
    fieldSetters,
    dataTabProps,
  };
}
