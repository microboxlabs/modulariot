"use client";
import { useId, useState } from "react";
import type { DashboardQueryDefinition } from "@microboxlabs/miot-dashboard-contract/document";
import { dashboardQueryDefinitionSchema } from "@microboxlabs/miot-dashboard-contract/schema";

export interface QueryOperationOption {
  readonly id: string;
  readonly label: string;
  readonly schema?: readonly string[];
}
export interface QueryConnectionOption {
  readonly id: string;
  readonly label: string;
  readonly operations: readonly QueryOperationOption[];
}
export interface SavedQueryEditorLabels {
  readonly name: string;
  readonly connection: string;
  readonly operation: string;
  readonly parameters: string;
  readonly parametersHint: string;
  readonly choose: string;
  readonly unavailable: string;
  readonly invalid: string;
  readonly duplicate: string;
  readonly save: string;
}
export interface SavedQueryEditorProps {
  /** Mount with a new React key when switching document, identity or query. */
  readonly value: DashboardQueryDefinition;
  readonly connections: readonly QueryConnectionOption[];
  readonly existingQueries?: readonly Pick<
    DashboardQueryDefinition,
    "id" | "variableName"
  >[];
  readonly labels: SavedQueryEditorLabels;
  readonly onSave: (query: DashboardQueryDefinition) => void;
  /** Explicit host permission is required; server authorization remains authoritative. */
  readonly editable?: boolean;
}
/** A draft editor over approved metadata. It never fetches credentials or executes SQL. */
export function SavedQueryEditor({
  value,
  connections,
  existingQueries = [],
  labels,
  onSave,
  editable = false,
}: SavedQueryEditorProps) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [parameters, setParameters] = useState(() =>
    JSON.stringify(value.parameters, null, 2),
  );
  const [error, setError] = useState<string>();
  const connection = connections.find((item) => item.id === draft.connectionId);
  const operation = connection?.operations.find(
    (item) => item.id === draft.operationId,
  );
  function save() {
    if (!editable) return;
    if (!connection || !operation) {
      setError(labels.unavailable);
      return;
    }
    if (
      existingQueries.some(
        (query) =>
          query.id !== draft.id && query.variableName === draft.variableName,
      )
    ) {
      setError(labels.duplicate);
      return;
    }
    let input: unknown;
    try {
      input = JSON.parse(parameters);
    } catch {
      setError(labels.invalid);
      return;
    }
    const parsed = dashboardQueryDefinitionSchema.safeParse({
      ...draft,
      parameters: input,
    });
    if (!parsed.success) {
      setError(labels.invalid);
      return;
    }
    setError(undefined);
    onSave(parsed.data);
  }
  return (
    <div className="miot-saved-query-editor">
      <fieldset disabled={!editable}>
        <label htmlFor={`${id}-name`}>{labels.name}</label>
        <input
          id={`${id}-name`}
          value={draft.variableName}
          onChange={(event) =>
            setDraft({ ...draft, variableName: event.target.value })
          }
        />
        <label htmlFor={`${id}-connection`}>{labels.connection}</label>
        <select
          id={`${id}-connection`}
          value={draft.connectionId}
          onChange={(event) => {
            setDraft({
              ...draft,
              connectionId: event.target.value,
              operationId: "",
              parameters: {},
              schema: undefined,
            });
            setParameters("{}");
            setError(undefined);
          }}
        >
          <option value="">{labels.choose}</option>
          {!connection && draft.connectionId && (
            <option value={draft.connectionId} disabled>
              {labels.unavailable}
            </option>
          )}
          {connections.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-operation`}>{labels.operation}</label>
        <select
          id={`${id}-operation`}
          value={draft.operationId}
          disabled={!editable || !connection}
          onChange={(event) => {
            const selected = connection?.operations.find(
              (item) => item.id === event.target.value,
            );
            setDraft({
              ...draft,
              operationId: event.target.value,
              parameters: {},
              schema: selected?.schema ? [...selected.schema] : undefined,
            });
            setParameters("{}");
            setError(undefined);
          }}
        >
          <option value="">{labels.choose}</option>
          {!operation && draft.operationId && (
            <option value={draft.operationId} disabled>
              {labels.unavailable}
            </option>
          )}
          {connection?.operations.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-parameters`}>{labels.parameters}</label>
        <textarea
          id={`${id}-parameters`}
          rows={6}
          value={parameters}
          aria-describedby={`${id}-hint`}
          onChange={(event) => setParameters(event.target.value)}
        />
        <p id={`${id}-hint`}>{labels.parametersHint}</p>
        <button type="button" onClick={save}>
          {labels.save}
        </button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
