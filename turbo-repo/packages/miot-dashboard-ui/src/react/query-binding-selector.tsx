"use client";
import { useId, type ReactNode } from "react";
export interface QueryBindingOption {
  readonly id: string;
  readonly variableName: string;
  readonly schema?: readonly string[];
}
export interface QueryBindingSelectorProps {
  readonly id?: string;
  readonly label: string;
  readonly value: string;
  readonly options: readonly QueryBindingOption[];
  readonly onChange: (variableName: string) => void;
  readonly onSchemaDetected?: (keys: string[]) => void;
  readonly placeholder: string;
  readonly emptyLabel: string;
  readonly columnsLabel: string;
  readonly schemaHint?: ReactNode;
  readonly unavailableLabel: string;
  readonly disabled?: boolean;
}
/** Selects an existing named result. Discovery and query execution remain host-owned. */
export function QueryBindingSelector({
  id: suppliedId,
  label,
  value,
  options,
  onChange,
  onSchemaDetected,
  placeholder,
  emptyLabel,
  columnsLabel,
  schemaHint,
  unavailableLabel,
  disabled = false,
}: QueryBindingSelectorProps) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const selected = options.find((option) => option.variableName === value);
  const keys = [...new Set(selected?.schema ?? [])];
  const missing = Boolean(value && !selected);
  return (
    <div className="miot-query-binding">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        aria-describedby={keys.length ? `${id}-schema` : undefined}
        onChange={(event) => {
          const next = event.target.value;
          const option = options.find((item) => item.variableName === next);
          if (next && !option) return;
          onChange(next);
          if (option?.schema?.length) onSchemaDetected?.([...option.schema]);
        }}
      >
        <option value="">{options.length ? placeholder : emptyLabel}</option>
        {missing && (
          <option value={value} disabled>
            {unavailableLabel}: {value}
          </option>
        )}
        {options.map((option) => (
          <option key={option.id} value={option.variableName}>
            {option.variableName}
          </option>
        ))}
      </select>
      {keys.length > 0 && (
        <div id={`${id}-schema`} className="miot-query-binding__schema">
          <p>{columnsLabel}</p>
          <ul>
            {keys.map((key) => (
              <li key={key}>
                <code>{key}</code>
              </li>
            ))}
          </ul>
          {schemaHint}
        </div>
      )}
    </div>
  );
}
