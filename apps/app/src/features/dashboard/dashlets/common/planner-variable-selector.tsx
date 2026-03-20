"use client";

import { Select, Label } from "flowbite-react";
import { usePlannerContext } from "../../context/planner-context";

interface PlannerVariableSelectorProps {
  id?: string;
  label: string;
  value: string;
  onChange: (variableName: string) => void;
  noDefinitionsHint?: string;
}

/**
 * Dropdown for selecting a planner variable in dashlet settings.
 * Reads available definitions from PlannerContext.
 * Shows the schema (available columns) of the selected variable.
 */
export function PlannerVariableSelector({
  id = "planner-variable",
  label,
  value,
  onChange,
  noDefinitionsHint = "No planner variables defined",
}: Readonly<PlannerVariableSelectorProps>) {
  const { definitions, schemas } = usePlannerContext();
  const schemaKeys = value ? schemas.get(value) ?? [] : [];

  return (
    <div>
      <Label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </Label>
      <Select
        id={id}
        sizing="sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">
          {definitions.length === 0
            ? noDefinitionsHint
            : "Select variable..."}
        </option>
        {definitions.map((def) => (
          <option key={def.id} value={def.variableName}>
            {def.variableName}
          </option>
        ))}
      </Select>
      {value && schemaKeys.length > 0 && (
        <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700">
          <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
            Available columns:
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
            Use <code className="rounded bg-gray-200 px-1 dark:bg-gray-600">{"{{row.<column>}}"}</code> in fields
          </p>
        </div>
      )}
    </div>
  );
}
