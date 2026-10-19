"use client";
import { QueryBindingSelector } from "@microboxlabs/miot-dashboard-ui/react";
import { usePlannerContext } from "../../context/planner-context";
interface PlannerVariableSelectorProps {
  id?: string;
  label: string;
  value: string;
  onChange: (variableName: string) => void;
  onSchemaDetected?: (keys: string[]) => void;
  noDefinitionsHint?: string;
}

export function PlannerVariableSelector({
  id,
  label,
  value,
  onChange,
  onSchemaDetected,
  noDefinitionsHint = "No planner variables defined",
}: Readonly<PlannerVariableSelectorProps>) {
  const { definitions, schemas } = usePlannerContext();
  return (
    <QueryBindingSelector
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      onSchemaDetected={onSchemaDetected}
      options={definitions.map((def) => ({
        id: def.id,
        variableName: def.variableName,
        schema: schemas.get(def.variableName),
      }))}
      placeholder="Select variable..."
      emptyLabel={noDefinitionsHint}
      columnsLabel="Available columns:"
      unavailableLabel="Unavailable variable"
      schemaHint={
        <p>
          Use <code>{"{{row.<column>}}"}</code> in fields
        </p>
      }
    />
  );
}
