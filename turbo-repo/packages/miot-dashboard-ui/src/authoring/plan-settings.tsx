"use client";
import { useEffect, useRef, useState } from "react";
import {
  QUERY_PARAMETER_TYPES,
  sqlParameterNames,
  type QueryParameterType,
  type QueryPlanDraft,
  type QueryPlanParameter,
} from "@microboxlabs/miot-dashboard-contract/authoring";
import type { QueryWorkbenchLabels } from "./labels";

export interface PlanSettingsProps {
  readonly draft: QueryPlanDraft;
  readonly labels: QueryWorkbenchLabels;
  readonly disabled: boolean;
  readonly onChange: (change: Partial<QueryPlanDraft>) => void;
}

/** Name, project, location, read limit and parameters of the open query. */
export function PlanSettings({
  draft,
  labels,
  disabled,
  onChange,
}: PlanSettingsProps) {
  const nextId = useRef(draft.parameters.length);
  const [rows, setRows] = useState(() =>
    draft.parameters.map((parameter, id) => ({ id, parameter })),
  );
  const currentRows = useRef(rows);
  const lastParameters = useRef(draft.parameters);
  useEffect(() => {
    if (draft.parameters === lastParameters.current) return;
    const used = new Set<number>();
    const next = draft.parameters.map((parameter) => {
      const existing = currentRows.current.find(
        (row) =>
          !used.has(row.id) &&
          (row.parameter === parameter ||
            row.parameter.name === parameter.name),
      );
      const id = existing?.id ?? nextId.current++;
      used.add(id);
      return { id, parameter };
    });
    lastParameters.current = draft.parameters;
    currentRows.current = next;
    setRows(next);
  }, [draft.parameters]);
  function updateRows(next: typeof rows) {
    currentRows.current = next;
    setRows(next);
    const parameters = next.map((row) => row.parameter);
    lastParameters.current = parameters;
    onChange({ parameters });
  }
  const declared = new Set(
    draft.parameters.map((parameter) => parameter.name.toLowerCase()),
  );
  const undeclared = sqlParameterNames(draft.sql).filter(
    (name) => !declared.has(name.toLowerCase()),
  );
  function setParameter(id: number, change: Partial<QueryPlanParameter>) {
    if (disabled) return;
    updateRows(
      currentRows.current.map((row) =>
        row.id === id
          ? { id, parameter: { ...row.parameter, ...change } }
          : row,
      ),
    );
  }
  function addParameter(name: string) {
    if (disabled || currentRows.current.length >= 100) return;
    updateRows([
      ...currentRows.current,
      {
        id: nextId.current++,
        parameter: { name, type: "STRING", sample: null },
      },
    ]);
  }
  function removeParameter(id: number) {
    if (!disabled)
      updateRows(currentRows.current.filter((row) => row.id !== id));
  }
  function nextParameterName() {
    let number = 1;
    while (declared.has(`param_${number}`)) number++;
    return `param_${number}`;
  }

  return (
    <details className="miot-qw-settings" open>
      <summary>{labels.settings}</summary>
      <div className="miot-qw-settings__grid">
        <label className="miot-qw-field">
          <span>{labels.name}</span>
          <input
            className="miot-qw-input"
            value={draft.name}
            maxLength={128}
            disabled={disabled}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </label>
        <label className="miot-qw-field">
          <span>{labels.projectId}</span>
          <input
            className="miot-qw-input"
            value={draft.projectId}
            disabled={disabled}
            spellCheck={false}
            onChange={(event) => onChange({ projectId: event.target.value })}
          />
        </label>
        <label className="miot-qw-field">
          <span>{labels.location}</span>
          <input
            className="miot-qw-input"
            value={draft.location}
            disabled={disabled}
            spellCheck={false}
            onChange={(event) => onChange({ location: event.target.value })}
          />
        </label>
        <label className="miot-qw-field">
          <span>{labels.maximumBytesBilled}</span>
          <input
            className="miot-qw-input"
            type="number"
            min={1}
            step={1}
            value={draft.maximumBytesBilled}
            disabled={disabled}
            onChange={(event) =>
              onChange({ maximumBytesBilled: Number(event.target.value) })
            }
          />
        </label>
        <label className="miot-qw-field miot-qw-field--wide">
          <span>{labels.description}</span>
          <input
            className="miot-qw-input"
            value={draft.description ?? ""}
            maxLength={1024}
            disabled={disabled}
            onChange={(event) =>
              onChange({ description: event.target.value || undefined })
            }
          />
        </label>
      </div>
      <fieldset className="miot-qw-parameters" disabled={disabled}>
        <legend>{labels.parameters}</legend>
        {draft.parameters.length > 0 && (
          <table className="miot-qw-table">
            <thead>
              <tr>
                <th scope="col">{labels.parameterName}</th>
                <th scope="col">{labels.parameterType}</th>
                <th scope="col">{labels.parameterSample}</th>
                <th scope="col" aria-label={labels.removeParameter} />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ parameter, id }) => (
                <tr key={id}>
                  <td>
                    <input
                      className="miot-qw-input"
                      aria-label={labels.parameterName}
                      value={parameter.name}
                      spellCheck={false}
                      onChange={(event) =>
                        setParameter(id, { name: event.target.value })
                      }
                    />
                  </td>
                  <td>
                    <select
                      className="miot-qw-input"
                      aria-label={labels.parameterType}
                      value={parameter.type}
                      onChange={(event) =>
                        setParameter(id, {
                          type: event.target.value as QueryParameterType,
                        })
                      }
                    >
                      {QUERY_PARAMETER_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="miot-qw-input"
                      aria-label={labels.parameterSample}
                      value={parameter.sample ?? ""}
                      onChange={(event) =>
                        setParameter(id, {
                          sample:
                            event.target.value === ""
                              ? null
                              : event.target.value,
                        })
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="miot-qw-icon-button"
                      aria-label={`${labels.removeParameter} @${parameter.name}`}
                      onClick={() => removeParameter(id)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="miot-qw-parameters__actions">
          {undeclared.map((name) => (
            <button
              key={name}
              type="button"
              className="miot-qw-chip"
              onClick={() => addParameter(name)}
            >
              {labels.addUndeclared} @{name}
            </button>
          ))}
          <button
            type="button"
            className="miot-qw-button"
            disabled={rows.length >= 100}
            onClick={() => addParameter(nextParameterName())}
          >
            {labels.addParameter}
          </button>
        </div>
      </fieldset>
    </details>
  );
}
