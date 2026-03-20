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
 */
export function PlannerVariableSelector({
  id = "planner-variable",
  label,
  value,
  onChange,
  noDefinitionsHint = "No planner variables defined",
}: Readonly<PlannerVariableSelectorProps>) {
  const { definitions } = usePlannerContext();

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
    </div>
  );
}
