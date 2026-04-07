import { useState, useRef } from "react";
import type {
  PgrestParam,
  PgrestHttpMethod,
  PgrestParamItem,
} from "./pgrest-types";
import {
  toPgrestParamItems,
  fromPgrestParamItems,
} from "./pgrest-types";
import { buildPgrestFetch, buildDataSourceParams, parseRows } from "./pgrest-utils";
import type { ColumnItem } from "./column-helpers";

export interface PgrestSettingsStateConfig {
  pgrestFunctionName: string;
  pgrestParams: PgrestParam[];
  pgrestHttpMethod: PgrestHttpMethod;
  dataSourceId?: string;
  /**
   * Called when columns are detected from a PGREST function call.
   * Return the ColumnItem[] to set. This lets consumers format keys
   * differently (e.g. data_table wraps in `{{row.key}}`).
   */
  onColumnsDetected: (keys: string[]) => ColumnItem[];
  /** Called to replace the current columns state */
  setColumns: (cols: ColumnItem[]) => void;
  /** Called to update filter items when columns change */
  syncFiltersToColumns?: (detectedKeys: Set<string>, labelByKey: Map<string, string>) => void;
  /** Called to update sort columns when columns change */
  syncSortToColumns?: (detectedKeys: Set<string>) => void;
  /** Called after detection completes with the final detected columns */
  onDetectionComplete?: (detected: ColumnItem[]) => void;
}

export function usePgrestSettingsState(cfg: PgrestSettingsStateConfig) {
  // Store callbacks in a ref so async functions always use latest versions
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  const [pgrestFunctionName, setPgrestFunctionName] = useState(
    cfg.pgrestFunctionName ?? "",
  );
  const [pgrestParams, setPgrestParams] = useState<PgrestParamItem[]>(
    toPgrestParamItems(cfg.pgrestParams ?? []),
  );
  const [pgrestHttpMethod, setPgrestHttpMethod] = useState<PgrestHttpMethod>(
    cfg.pgrestHttpMethod ?? "POST",
  );

  // Detect-columns state
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

  // Introspect state
  const [introspecting, setIntrospecting] = useState(false);
  const [introspectError, setIntrospectError] = useState<string | null>(null);
  const [paramHints, setParamHints] = useState<Record<string, string>>({});

  const detectColumns = async (
    fnOverride?: string,
    methodOverride?: PgrestHttpMethod,
    paramsOverride?: PgrestParam[],
  ) => {
    setDetecting(true);
    setDetectError(null);

    try {
      const { url, init } = buildPgrestFetch(
        fnOverride ?? pgrestFunctionName,
        methodOverride ?? pgrestHttpMethod,
        paramsOverride ?? fromPgrestParamItems(pgrestParams),
        cfg.dataSourceId,
      );

      const res = await fetch(url, init);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = parseRows(await res.json());
      if (rows.length === 0) {
        setDetectError("Response returned no rows");
        return;
      }

      const keys = Object.keys(rows[0]);
      const detected = cfgRef.current.onColumnsDetected(keys);
      cfgRef.current.setColumns(detected);

      // Sync filter & sort to detected columns
      const detectedKeys = new Set(detected.map((c) => c.key));
      const labelByKey = new Map(detected.map((c) => [c.key, c.label]));
      cfgRef.current.syncFiltersToColumns?.(detectedKeys, labelByKey);
      cfgRef.current.syncSortToColumns?.(detectedKeys);
      cfgRef.current.onDetectionComplete?.(detected);
    } catch (err: unknown) {
      setDetectError(err instanceof Error ? err.message : "Detection failed");
    } finally {
      setDetecting(false);
    }
  };

  const introspectFunction = async (fnOverride?: string) => {
    const fn = (fnOverride ?? pgrestFunctionName).trim();
    if (!fn) return null;

    setIntrospecting(true);
    setIntrospectError(null);

    try {
      const introspectParams = buildDataSourceParams(cfg.dataSourceId);
      introspectParams.set("fn", fn);
      const res = await fetch(
        `/app/api/dashboard/pgrest/openapi?${introspectParams.toString()}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `HTTP ${res.status}`,
        );
      }

      const data = (await res.json()) as {
        methods: string[];
        parameters: { name: string; type: string; format: string }[];
      };

      // Auto-set HTTP method to first available
      const method =
        (data.methods[0] as PgrestHttpMethod) ?? pgrestHttpMethod;
      if (data.methods.length > 0) {
        setPgrestHttpMethod(method);
      }

      // Replace parameters with introspected ones
      const now = Date.now();
      const newParams: PgrestParamItem[] = data.parameters.map((p, i) => ({
        _id: `pp-${now}-${i}`,
        key: p.name,
        value: "",
      }));
      setPgrestParams(newParams);

      // Store format hints for placeholders
      const hints: Record<string, string> = {};
      for (const p of data.parameters) {
        hints[p.name] = p.format;
      }
      setParamHints(hints);

      return { method, params: fromPgrestParamItems(newParams) };
    } catch (err: unknown) {
      setIntrospectError(
        err instanceof Error ? err.message : "Introspection failed",
      );
      return null;
    } finally {
      setIntrospecting(false);
    }
  };

  const handleFunctionSelect = async (fn: string) => {
    const result = await introspectFunction(fn);
    if (result) {
      await detectColumns(fn, result.method, result.params);
    }
  };

  // ── PGREST param helpers ──────────────────────────────────────────────────

  const addPgrestParam = () => {
    setIntrospectError(null);
    setPgrestParams((prev) => [
      ...prev,
      { _id: `pp-${Date.now()}`, key: "", value: "" },
    ]);
  };

  const removePgrestParam = (id: string) => {
    setIntrospectError(null);
    setPgrestParams((prev) => prev.filter((p) => p._id !== id));
  };

  const updatePgrestParam = (
    id: string,
    field: keyof PgrestParam,
    value: string,
  ) => {
    setIntrospectError(null);
    // Clear hint for this param when its key is manually edited
    if (field === "key") {
      const param = pgrestParams.find((p) => p._id === id);
      if (param && param.key !== value) {
        setParamHints((prev) => {
          const next = { ...prev };
          delete next[param.key];
          return next;
        });
      }
    }
    setPgrestParams((prev) =>
      prev.map((p) => (p._id === id ? { ...p, [field]: value } : p)),
    );
  };

  return {
    pgrestFunctionName,
    setPgrestFunctionName,
    pgrestParams,
    pgrestHttpMethod,
    setPgrestHttpMethod,
    detecting,
    detectColumns,
    detectError,
    introspecting,
    introspectError,
    paramHints,
    handleFunctionSelect,
    addPgrestParam,
    removePgrestParam,
    updatePgrestParam,
    fromPgrestParamItems,
  };
}
