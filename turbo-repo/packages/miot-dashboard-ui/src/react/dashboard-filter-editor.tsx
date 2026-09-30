"use client";
import { useId, useState } from "react";
import type {
  DashboardFilterParam,
  DashboardFilterOption,
} from "@microboxlabs/miot-dashboard-contract/document";
import { filterDefinitionsSchema } from "./filter-definitions-value";
export interface DashboardFilterEditorLabels {
  key: string;
  label: string;
  type: string;
  unique: string;
  add: string;
  remove: string;
  optionLabel: string;
  optionValue: string;
  addOption: string;
  removeOption: string;
  apply: string;
  invalid: string;
  rejected: string;
  empty: string;
  types: Record<DashboardFilterParam["type"], string>;
}
export interface DashboardFilterEditorProps {
  /** Remount with a new key when switching document, session or replacing its draft. */
  readonly value: readonly DashboardFilterParam[];
  readonly editable?: boolean;
  readonly labels: DashboardFilterEditorLabels;
  readonly onApply: (value: DashboardFilterParam[]) => boolean;
}
function Options({
  options,
  labels,
  onChange,
}: Readonly<{
  options: readonly DashboardFilterOption[];
  labels: DashboardFilterEditorLabels;
  onChange: (options: DashboardFilterOption[]) => void;
}>) {
  const id = useId();
  function update(index: number, patch: Partial<DashboardFilterOption>) {
    onChange(
      options.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }
  return (
    <div className="miot-filter-editor__options">
      {options.map((option, index) => (
        <div key={`${id}-${index}`}>
          <label htmlFor={`${id}-label-${index}`}>{labels.optionLabel}</label>
          <input
            id={`${id}-label-${index}`}
            value={option.label}
            maxLength={256}
            onChange={(event) => update(index, { label: event.target.value })}
          />
          <label htmlFor={`${id}-value-${index}`}>{labels.optionValue}</label>
          <input
            id={`${id}-value-${index}`}
            value={option.value}
            maxLength={1024}
            onChange={(event) => update(index, { value: event.target.value })}
          />
          <button
            type="button"
            onClick={() => onChange(options.filter((_, i) => i !== index))}
          >
            {labels.removeOption}
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={options.length >= 500}
        onClick={() => onChange([...options, { label: "", value: "" }])}
      >
        {labels.addOption}
      </button>
    </div>
  );
}
function FilterFields({
  value,
  labels,
  onChange,
  onRemove,
}: Readonly<{
  value: DashboardFilterParam;
  labels: DashboardFilterEditorLabels;
  onChange: (value: DashboardFilterParam) => void;
  onRemove: () => void;
}>) {
  const id = useId();
  return (
    <fieldset className="miot-filter-editor__item">
      <label htmlFor={`${id}-key`}>{labels.key}</label>
      <input
        id={`${id}-key`}
        value={value.key}
        maxLength={128}
        onChange={(event) => onChange({ ...value, key: event.target.value })}
      />
      <label htmlFor={`${id}-label`}>{labels.label}</label>
      <input
        id={`${id}-label`}
        value={value.label}
        maxLength={256}
        onChange={(event) => onChange({ ...value, label: event.target.value })}
      />
      <label htmlFor={`${id}-type`}>{labels.type}</label>
      <select
        id={`${id}-type`}
        value={value.type}
        onChange={(event) => {
          const type = event.target.value;
          if (type === "text" || type === "date_range" || type === "select")
            onChange({ ...value, type });
        }}
      >
        {(["text", "date_range", "select"] as const).map((type) => (
          <option key={type} value={type}>
            {labels.types[type]}
          </option>
        ))}
      </select>
      <label>
        <input
          type="checkbox"
          checked={value.unique ?? false}
          onChange={(event) =>
            onChange({ ...value, unique: event.target.checked })
          }
        />
        {labels.unique}
      </label>
      {value.type === "select" && (
        <Options
          options={value.options ?? []}
          labels={labels}
          onChange={(options) => onChange({ ...value, options })}
        />
      )}
      <button type="button" onClick={onRemove}>
        {labels.remove}
      </button>
    </fieldset>
  );
}
/** Edits filter definitions and static options. Dynamic option providers remain host-owned. */
export function DashboardFilterEditor({
  value,
  editable = false,
  labels,
  onApply,
}: DashboardFilterEditorProps) {
  const id = useId();
  const [draft, setDraft] = useState<readonly DashboardFilterParam[]>(value);
  const [error, setError] = useState<string>();
  function apply() {
    if (!editable) return;
    const parsed = filterDefinitionsSchema.safeParse(draft);
    if (!parsed.success) {
      setError(labels.invalid);
      return;
    }
    setError(onApply(parsed.data) ? undefined : labels.rejected);
  }
  function change(index: number, value: DashboardFilterParam) {
    setDraft((current) =>
      current.map((item, i) => (i === index ? value : item)),
    );
  }
  function remove(index: number) {
    setDraft((current) => current.filter((_, i) => i !== index));
  }
  function add() {
    setDraft((current) => [...current, { key: "", label: "", type: "text" }]);
  }
  return (
    <div className="miot-general-settings miot-filter-editor">
      <fieldset disabled={!editable}>
        {draft.length === 0 && <p>{labels.empty}</p>}
        {draft.map((filter, index) => (
          <FilterFields
            key={`${id}-${index}`}
            value={filter}
            labels={labels}
            onChange={(next) => change(index, next)}
            onRemove={() => remove(index)}
          />
        ))}
        <button type="button" disabled={draft.length >= 100} onClick={add}>
          {labels.add}
        </button>
        <button type="button" onClick={apply}>
          {labels.apply}
        </button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
