"use client";
import { useId } from "react";
import type { DashboardFilterOptionsSource } from "@microboxlabs/miot-dashboard-contract/document";
import {
  QueryBindingSelector,
  type QueryBindingOption,
} from "./query-binding-selector";
export interface FilterSourceConfiguration {
  readonly queries: readonly QueryBindingOption[];
  readonly labels: {
    source: string;
    static: string;
    columns: string;
    unavailable: string;
    valueField: string;
    labelField: string;
    single: string;
  };
}
export interface FilterOptionSourceProps extends FilterSourceConfiguration {
  readonly value?: DashboardFilterOptionsSource;
  readonly onChange: (value: DashboardFilterOptionsSource | undefined) => void;
}
/** References named results only; columns may be typed before their schema is known. */
export function FilterOptionSource({
  value,
  onChange,
  queries,
  labels,
}: FilterOptionSourceProps) {
  const id = useId();
  const columns =
    queries.find((query) => query.variableName === value?.variableName)
      ?.schema ?? [];
  return (
    <div className="miot-filter-editor__options">
      <QueryBindingSelector
        label={labels.source}
        value={value?.variableName ?? ""}
        options={queries}
        onChange={(variableName) =>
          onChange(variableName ? { variableName, valueField: "" } : undefined)
        }
        placeholder={labels.static}
        emptyLabel={labels.static}
        columnsLabel={labels.columns}
        unavailableLabel={labels.unavailable}
      />
      {value && (
        <>
          <label htmlFor={`${id}-value`}>{labels.valueField}</label>
          <input
            id={`${id}-value`}
            list={`${id}-columns`}
            maxLength={128}
            value={value.valueField}
            onChange={(event) =>
              onChange({ ...value, valueField: event.target.value })
            }
          />
          <label htmlFor={`${id}-label`}>{labels.labelField}</label>
          <input
            id={`${id}-label`}
            list={`${id}-columns`}
            maxLength={128}
            value={value.labelField ?? ""}
            onChange={(event) =>
              onChange({
                ...value,
                labelField: event.target.value || undefined,
              })
            }
          />
          <datalist id={`${id}-columns`}>
            {[...new Set(columns)].map((column) => (
              <option key={column} value={column} />
            ))}
          </datalist>
        </>
      )}
    </div>
  );
}
