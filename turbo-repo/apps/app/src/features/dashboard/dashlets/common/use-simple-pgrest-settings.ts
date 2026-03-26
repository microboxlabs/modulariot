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

interface PgrestConfigFields {
  dataMode?: string;
  dataSourceId?: string;
  pgrestFunctionName?: string;
  pgrestParams?: PgrestParam[];
  pgrestHttpMethod?: PgrestHttpMethod;
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
  isPgrest: boolean;
  activeProviders: { id: string; name: string }[];
  pg: ReturnType<typeof usePgrestSettingsState>;
  handleDataModeChange: (mode: SimpleDataMode) => void;
  /** Spread into onSave to include all pgrest-related config fields */
  pgrestSaveFields: {
    dataMode: SimpleDataMode;
    pgrestFunctionName: string;
    pgrestParams: PgrestParam[];
    pgrestHttpMethod: PgrestHttpMethod;
    dataSourceId: string | undefined;
  };
  /** Setter for dataSourceId state */
  setDataSourceId: (id: string) => void;
  /** Pre-built fieldValues record for HbTextFieldList */
  fieldValues: Record<F, string>;
  /** Pre-built fieldSetters record for HbTextFieldList */
  fieldSetters: Record<F, (v: string) => void>;
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

  // Snapshot of field values when entering pgrest mode
  const staticSnapshot = useRef({ ...fieldValues });

  const isRemoteMode = (m: SimpleDataMode) => m === "pgrest" || m === "planner";

  const handleDataModeChange = (mode: SimpleDataMode) => {
    if (isRemoteMode(mode) && dataMode === "static") {
      staticSnapshot.current = { ...fieldValues };
    } else if (mode === "static" && isRemoteMode(dataMode)) {
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

  const isPgrest = isRemoteMode(dataMode);

  const pgrestSaveFields = {
    dataMode,
    pgrestFunctionName: pg.pgrestFunctionName,
    pgrestParams: fromPgrestParamItems(pg.pgrestParams),
    pgrestHttpMethod: pg.pgrestHttpMethod,
    dataSourceId: dataSourceId || undefined,
  };

  return {
    dataMode,
    dataSourceId,
    setDataSourceId,
    isPgrest,
    activeProviders,
    pg,
    handleDataModeChange,
    pgrestSaveFields,
    fieldValues,
    fieldSetters,
  };
}
