"use client";

import { useState } from "react";
import { Button, TextInput, Label, Select } from "flowbite-react";
import { HiPlus, HiTrash, HiChevronDown, HiChevronRight } from "react-icons/hi2";
import type { PlannerRequestDefinition } from "../../types/dashboard.types";
import { useDashboard } from "../../context/dashboard-context";
import { PgrestFunctionAutocomplete } from "../../dashlets/common/pgrest-function-autocomplete";
import { SettingsSelectField } from "../../dashlets/common/settings-fields";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

// ============================================================================
// Single Request Editor
// ============================================================================

interface RequestEditorProps {
  def: PlannerRequestDefinition;
  existingNames: string[];
  dictionary: I18nRecord;
  onUpdate: (id: string, partial: Partial<PlannerRequestDefinition>) => void;
  onRemove: (id: string) => void;
}

function RequestEditor({ def, existingNames, dictionary, onUpdate, onRemove }: Readonly<RequestEditorProps>) {
  const [expanded, setExpanded] = useState(false);

  const nameError = (() => {
    if (!def.variableName) return "Required";
    if (!/^[a-zA-Z_]\w*$/.test(def.variableName)) return "Alphanumeric + underscore only";
    if (existingNames.filter((n) => n === def.variableName).length > 1) return "Must be unique";
    return null;
  })();

  return (
    <div className="rounded border border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between p-2 text-left text-sm"
      >
        <div className="flex items-center gap-2 min-w-0">
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
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(def.id);
          }}
          onMouseDown={stopPropagation}
          className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
        >
          <HiTrash className="h-4 w-4" />
        </button>
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-gray-200 p-2 dark:border-gray-600">
          <div>
            <Label htmlFor={`planner-var-${def.id}`} className="mb-1 block text-xs font-medium">
              Variable Name
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

          <div>
            <Label htmlFor={`planner-fn-${def.id}`} className="mb-1 block text-xs font-medium">
              Function Name
            </Label>
            <PgrestFunctionAutocomplete
              id={`planner-fn-${def.id}`}
              value={def.pgrestFunctionName}
              onChange={(v) => onUpdate(def.id, { pgrestFunctionName: v })}
              onSelect={(fn) => onUpdate(def.id, { pgrestFunctionName: fn })}
              dictionary={dictionary}
              dataSourceId={def.dataSourceId}
            />
          </div>

          <SettingsSelectField
            id={`planner-method-${def.id}`}
            label="HTTP Method"
            value={def.pgrestHttpMethod}
            onChange={(v) => onUpdate(def.id, { pgrestHttpMethod: v as "POST" | "GET" })}
            options={[
              { value: "POST", label: "POST" },
              { value: "GET", label: "GET" },
            ]}
          />

          <div>
            <Label className="mb-1 block text-xs font-medium">Parameters</Label>
            <div className="space-y-1">
              {def.pgrestParams.map((p, i) => (
                <div key={`${def.id}-p-${i}`} className="flex items-center gap-1">
                  <TextInput
                    sizing="sm"
                    placeholder="Key"
                    value={p.key}
                    onChange={(e) => {
                      const params = [...def.pgrestParams];
                      params[i] = { ...params[i], key: e.target.value };
                      onUpdate(def.id, { pgrestParams: params });
                    }}
                    className="flex-1"
                  />
                  <TextInput
                    sizing="sm"
                    placeholder="Value"
                    value={p.value}
                    onChange={(e) => {
                      const params = [...def.pgrestParams];
                      params[i] = { ...params[i], value: e.target.value };
                      onUpdate(def.id, { pgrestParams: params });
                    }}
                    className="flex-1"
                  />
                  <button
                    type="button"
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
              Add Parameter
            </Button>
          </div>
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
  } = useDashboard();

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
        Add Request
      </Button>
    </div>
  );
}
