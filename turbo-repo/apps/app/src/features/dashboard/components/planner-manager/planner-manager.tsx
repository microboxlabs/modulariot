"use client";

import { useState, useCallback } from "react";
import { Button, TextInput, Label, Select } from "flowbite-react";
import { HiPlus, HiTrash, HiChevronDown, HiChevronRight } from "react-icons/hi2";
import type { PlannerRequestDefinition, PlannerParam, PlannerPathMode } from "../../types/dashboard.types";
import { useDashboard } from "../../context/dashboard-context";
import { PgrestFunctionAutocomplete } from "../../dashlets/common/pgrest-function-autocomplete";
import { SettingsSelectField } from "../../dashlets/common/settings-fields";
import { HbParamValueInput } from "../../dashlets/common/hb-param-value-input";
import { useFilterSuggestions } from "../../dashlets/common/use-filter-suggestions";
import { buildDataSourceParams } from "../../dashlets/common/pgrest-utils";
import { useDataSources } from "@/features/data-sources/hooks/use-data-sources";
import { usePlannerContext } from "../../context/planner-context";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { z } from "zod";

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

// ============================================================================
// Introspection helper (mirrors use-pgrest-settings-state logic)
// ============================================================================

interface IntrospectionResult {
  method: "POST" | "GET";
  params: PlannerParam[];
  paramHints: Record<string, string>;
}

const introspectionSchema = z.object({
  methods: z.array(z.string()),
  parameters: z.array(
    z.object({
      name: z.string().optional(),
      type: z.string().optional(),
      format: z.string().optional(),
    }),
  ),
});

async function introspectFunction(
  functionName: string,
  dataSourceId?: string,
  pathMode: PlannerPathMode = "rpc",
): Promise<IntrospectionResult> {
  const fn = functionName.trim();
  if (!fn) throw new Error("Function name is empty");

  const qs = buildDataSourceParams(dataSourceId);
  qs.set("fn", fn);
  if (pathMode === "table") qs.set("mode", "table");
  const res = await fetch(`/app/api/dashboard/pgrest/openapi?${qs.toString()}`);
  if (!res.ok) throw new Error(`Introspection failed (${res.status})`);

  const data = await introspectionSchema.parseAsync(await res.json());

  const firstMethod = data.methods[0];
  const method: "POST" | "GET" =
    firstMethod === "POST" || firstMethod === "GET" ? firstMethod : "POST";

  const params: PlannerParam[] = data.parameters
    .filter((p): p is typeof p & { name: string } => !!p.name)
    .map((p) => ({ key: p.name, value: "" }));

  const paramHints: Record<string, string> = {};
  for (const p of data.parameters) {
    if (p.name && p.format) {
      paramHints[p.name] = p.format;
    }
  }

  return { method, params, paramHints };
}

// ============================================================================
// Data Source Option type
// ============================================================================

interface DataSourceOption {
  id: string;
  name: string;
}

// ============================================================================
// Single Request Editor
// ============================================================================

interface RequestEditorProps {
  def: PlannerRequestDefinition;
  existingNames: string[];
  dictionary: I18nRecord;
  activeProviders: DataSourceOption[];
  schemaKeys: string[];
  filterSuggestions: string[];
  onUpdate: (id: string, partial: Partial<PlannerRequestDefinition>) => void;
  onRemove: (id: string) => void;
}

function RequestEditor({
  def,
  existingNames,
  dictionary,
  activeProviders,
  schemaKeys,
  filterSuggestions,
  onUpdate,
  onRemove,
}: Readonly<RequestEditorProps>) {
  const [expanded, setExpanded] = useState(false);
  const [introspecting, setIntrospecting] = useState(false);
  const [paramHints, setParamHints] = useState<Record<string, string>>({});
  const [introspectionError, setIntrospectionError] = useState<string | null>(null);

  const nameError = (() => {
    if (!def.variableName) return tr("dashboard.settings.plannerVarRequired", dictionary);
    if (!/^[a-zA-Z_]\w*$/.test(def.variableName)) return tr("dashboard.settings.plannerVarInvalidChars", dictionary);
    if (existingNames.filter((n) => n === def.variableName).length > 1) return tr("dashboard.settings.plannerVarDuplicate", dictionary);
    return null;
  })();

  const handleFunctionSelect = useCallback(
    async (fn: string) => {
      setIntrospecting(true);
      setIntrospectionError(null);
      try {
        const result = await introspectFunction(fn, def.dataSourceId, def.pgrestPathMode);
        onUpdate(def.id, {
          pgrestFunctionName: fn,
          pgrestHttpMethod: result.method,
          pgrestParams: result.params,
        });
        setParamHints(result.paramHints);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Introspection failed:", err);
        setIntrospectionError(message);
      } finally {
        setIntrospecting(false);
      }
    },
    [def.id, def.dataSourceId, def.pgrestPathMode, onUpdate],
  );

  const handleDataSourceChange = useCallback(
    (dsId: string) => {
      onUpdate(def.id, {
        dataSourceId: dsId || undefined,
        pgrestFunctionName: "",
        pgrestHttpMethod: "POST",
        pgrestParams: [],
      });
      setParamHints({});
      setIntrospectionError(null);
    },
    [def.id, onUpdate],
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700">
      <div className="flex w-full items-center justify-between p-3 text-sm">
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={`Toggle ${def.variableName || "Unnamed"}`}
          onClick={() => setExpanded((e) => !e)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {expanded ? (
            <HiChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
          ) : (
            <HiChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
          )}
          <span className="truncate font-medium text-gray-900 dark:text-white">
            {def.variableName || "Unnamed"}
          </span>
          {def.pgrestFunctionName && (
            <span className="truncate text-xs text-gray-500 dark:text-gray-400">
              → {def.pgrestFunctionName}
            </span>
          )}
          {introspecting && (
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500 dark:border-gray-600 dark:border-t-blue-400" />
          )}
        </button>
        <button
          type="button"
          aria-label={`Remove ${def.variableName || "request"}`}
          onClick={() => onRemove(def.id)}
          className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
        >
          <HiTrash className="h-4 w-4" />
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-gray-200 p-3 dark:border-gray-600">
          {/* Variable Name */}
          <div>
            <Label htmlFor={`planner-var-${def.id}`} className="mb-1 block text-xs font-medium">
              {tr("dashboard.settings.plannerVariableName", dictionary)}
            </Label>
            <TextInput
              id={`planner-var-${def.id}`}
              sizing="sm"
              value={def.variableName}
              onChange={(e) => onUpdate(def.id, { variableName: e.target.value })}
              placeholder="e.g. fleet_stats"
              color={nameError ? "failure" : undefined}
            />
            {nameError && (
              <p className="mt-0.5 text-xs text-red-500">{nameError}</p>
            )}
          </div>

          {/* Resource Type */}
          <SettingsSelectField
            id={`planner-mode-${def.id}`}
            label={tr("dashboard.settings.resourceType", dictionary)}
            value={def.pgrestPathMode ?? "rpc"}
            onChange={(v) => {
              onUpdate(def.id, {
                pgrestPathMode: v as PlannerPathMode,
                pgrestFunctionName: "",
                pgrestHttpMethod: v === "table" ? "GET" : "POST",
                pgrestParams: [],
              });
              setParamHints({});
              setIntrospectionError(null);
            }}
            options={[
              { value: "rpc", label: tr("dashboard.settings.pathModeRpc", dictionary) },
              { value: "table", label: tr("dashboard.settings.pathModeTable", dictionary) },
            ]}
          />

          {/* Data Source Provider */}
          <div>
            <Label
              htmlFor={`planner-ds-${def.id}`}
              className="mb-1 block text-xs font-medium"
            >
              {tr("dashboard.settings.dataSourceProvider", dictionary)}
            </Label>
            <Select
              id={`planner-ds-${def.id}`}
              sizing="sm"
              value={def.dataSourceId ?? ""}
              onChange={(e) => handleDataSourceChange(e.target.value)}
            >
              <option value="">
                {activeProviders.length === 0
                  ? tr("dashboard.settings.noActiveProviders", dictionary)
                  : tr("dashboard.settings.selectProvider", dictionary)}
              </option>
              {activeProviders.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Function / Table Name (autocomplete) */}
          <div>
            <Label htmlFor={`planner-fn-${def.id}`} className="mb-1 block text-xs font-medium">
              {def.pgrestPathMode === "table"
                ? tr("dashboard.settings.tableName", dictionary)
                : tr("dashboard.settings.plannerFunctionName", dictionary)}
            </Label>
            <PgrestFunctionAutocomplete
              id={`planner-fn-${def.id}`}
              value={def.pgrestFunctionName}
              onChange={(v) => onUpdate(def.id, { pgrestFunctionName: v })}
              onSelect={handleFunctionSelect}
              dictionary={dictionary}
              dataSourceId={def.dataSourceId}
              loading={introspecting}
              pathMode={def.pgrestPathMode}
            />
            {introspectionError && (
              <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                {tr("dashboard.settings.plannerIntrospectionFailed", dictionary)} {introspectionError}
              </p>
            )}
          </div>

          {/* HTTP Method (auto-detected, still editable) */}
          <SettingsSelectField
            id={`planner-method-${def.id}`}
            label={tr("dashboard.settings.plannerHttpMethod", dictionary)}
            value={def.pgrestHttpMethod}
            onChange={(v) => onUpdate(def.id, { pgrestHttpMethod: v as "POST" | "GET" })}
            options={[
              { value: "POST", label: "POST" },
              { value: "GET", label: "GET" },
            ]}
          />

          {/* Parameters (auto-populated with hints) */}
          <div>
            <Label className="mb-1 block text-xs font-medium">{tr("dashboard.settings.plannerParameters", dictionary)}</Label>
            <div className="space-y-1">
              {def.pgrestParams.map((p, i) => (
                <div key={`${def.id}-p-${i}`} className="flex items-center gap-1">
                  <TextInput
                    sizing="sm"
                    placeholder={tr("dashboard.settings.plannerKey", dictionary)}
                    value={p.key}
                    onChange={(e) => {
                      const params = [...def.pgrestParams];
                      params[i] = { ...params[i], key: e.target.value };
                      onUpdate(def.id, { pgrestParams: params });
                    }}
                    className="flex-1"
                  />
                  <HbParamValueInput
                    placeholder={paramHints[p.key] ?? tr("dashboard.settings.plannerValue", dictionary)}
                    value={p.value}
                    onChange={(v) => {
                      const params = [...def.pgrestParams];
                      params[i] = { ...params[i], value: v };
                      onUpdate(def.id, { pgrestParams: params });
                    }}
                    filterSuggestions={filterSuggestions}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    aria-label={`Remove parameter ${p.key || "#" + (i + 1)}`}
                    onClick={() => {
                      const params = def.pgrestParams.filter((_, j) => j !== i);
                      onUpdate(def.id, { pgrestParams: params });
                    }}
                    onMouseDown={stopPropagation}
                    className="shrink-0 rounded p-1 text-gray-400 hover:text-red-500"
                  >
                    <HiTrash className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <Button
              color="light"
              size="xs"
              onClick={() =>
                onUpdate(def.id, {
                  pgrestParams: [...def.pgrestParams, { key: "", value: "" }],
                })
              }
              onMouseDown={stopPropagation}
              className="no-drag mt-1"
            >
              <HiPlus className="mr-1 h-3 w-3" />
              {tr("dashboard.settings.plannerAddParameter", dictionary)}
            </Button>
          </div>

          {/* Schema Preview */}
          {schemaKeys.length > 0 && (
            <div className="rounded border border-gray-200 bg-white p-2 dark:border-gray-600 dark:bg-gray-800">
              <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                {tr("dashboard.settings.plannerResponseColumns", dictionary)}
              </p>
              <div className="flex flex-wrap gap-1">
                {schemaKeys.map((key) => (
                  <span
                    key={key}
                    className="inline-block rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                  >
                    {key}
                  </span>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                {tr("dashboard.settings.plannerSchemaHint", dictionary)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Planner Manager Form
// ============================================================================

export function PlannerManagerForm() {
  const {
    plannerDefinitions,
    addPlannerRequest,
    updatePlannerRequest,
    removePlannerRequest,
    dictionary,
    siteId,
    filters,
  } = useDashboard();

  const { dataSources } = useDataSources(siteId ?? undefined);
  const { schemas } = usePlannerContext();

  const filterSuggestions = useFilterSuggestions(filters);

  const activeProviders = dataSources.filter(
    (ds) => ds.isActive === true && ds.lastTestResult === true,
  );

  const existingNames = plannerDefinitions.map((d) => d.variableName);

  const handleAdd = () => {
    addPlannerRequest({
      variableName: "",
      pgrestFunctionName: "",
      pgrestHttpMethod: "POST",
      pgrestParams: [],
    });
  };

  return (
    <div className="p-4 space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Define shared data queries. Each variable can be referenced by any dashlet.
      </p>

      {plannerDefinitions.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">
          No requests defined yet.
        </p>
      )}

      <div className="space-y-2">
        {plannerDefinitions.map((def) => (
          <RequestEditor
            key={def.id}
            def={def}
            existingNames={existingNames}
            dictionary={dictionary}
            activeProviders={activeProviders}
            schemaKeys={schemas.get(def.variableName) ?? []}
            filterSuggestions={filterSuggestions}
            onUpdate={updatePlannerRequest}
            onRemove={removePlannerRequest}
          />
        ))}
      </div>

      <Button
        color="light"
        size="sm"
        onClick={handleAdd}
        onMouseDown={stopPropagation}
        className="no-drag w-full"
      >
        <HiPlus className="mr-1 h-4 w-4" />
        {tr("dashboard.settings.plannerAddRequest", dictionary)}
      </Button>
    </div>
  );
}
