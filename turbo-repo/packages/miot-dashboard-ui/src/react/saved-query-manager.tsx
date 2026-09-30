"use client";
import { useState } from "react";
import type { DashboardQueryDefinition } from "@microboxlabs/miot-dashboard-contract/document";
import {
  SavedQueryEditor,
  type SavedQueryEditorLabels,
  type QueryConnectionOption,
} from "./saved-query-editor";

export interface SavedQueryManagerProps {
  readonly queries: readonly DashboardQueryDefinition[];
  readonly connections: readonly QueryConnectionOption[];
  /** Pass the controlled document's validated setQueries callback. */
  readonly onChange: (queries: readonly DashboardQueryDefinition[]) => boolean;
  readonly editable?: boolean;
  readonly labels: SavedQueryEditorLabels & {
    readonly add: string;
    readonly close: string;
    readonly remove: string;
    readonly confirmRemove: string;
    readonly cancel: string;
    readonly empty: string;
    readonly rejected: string;
  };
  /** Mount with a host session/document key to discard drafts on identity changes. */
  readonly createId?: () => string;
}

export function SavedQueryManager({
  queries,
  connections,
  onChange,
  editable = false,
  labels,
  createId = () => crypto.randomUUID(),
}: SavedQueryManagerProps) {
  const [draft, setDraft] = useState<DashboardQueryDefinition>();
  const [creating, setCreating] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<string>();
  const [error, setError] = useState(false);
  function close() {
    setDraft(undefined);
    setCreating(false);
    setPendingRemove(undefined);
    setError(false);
  }
  function add() {
    if (!editable || queries.length >= 50) return;
    setDraft({
      id: createId(),
      variableName: "",
      connectionId: "",
      operationId: "",
      parameters: {},
    });
    setCreating(true);
    setPendingRemove(undefined);
    setError(false);
  }
  function save(query: DashboardQueryDefinition) {
    if (!editable) return;
    if (
      (creating && queries.some((item) => item.id === query.id)) ||
      (!creating && !queries.some((item) => item.id === query.id))
    ) {
      setError(true);
      return;
    }
    const next = creating
      ? [...queries, query]
      : queries.map((item) => (item.id === query.id ? query : item));
    if (onChange(next)) close();
    else setError(true);
  }
  function remove() {
    if (!editable || !pendingRemove) return;
    if (onChange(queries.filter((query) => query.id !== pendingRemove)))
      close();
    else setError(true);
  }
  return (
    <div className="miot-query-manager">
      {queries.length === 0 && <p>{labels.empty}</p>}
      <ul>
        {queries.map((query) => (
          <li key={query.id}>
            <button
              type="button"
              onClick={() => {
                setDraft(query);
                setCreating(false);
                setPendingRemove(undefined);
                setError(false);
              }}
            >
              {query.variableName}
            </button>
            {editable && (
              <button
                type="button"
                aria-label={`${labels.remove}: ${query.variableName}`}
                onClick={() => {
                  setPendingRemove(query.id);
                  setError(false);
                }}
              >
                {labels.remove}
              </button>
            )}
          </li>
        ))}
      </ul>
      {editable && (
        <button type="button" disabled={queries.length >= 50} onClick={add}>
          {labels.add}
        </button>
      )}
      {pendingRemove && editable && (
        <div role="group" aria-label={labels.confirmRemove}>
          <p>{labels.confirmRemove}</p>
          <button type="button" onClick={remove}>
            {labels.confirmRemove}
          </button>
          <button type="button" onClick={() => setPendingRemove(undefined)}>
            {labels.cancel}
          </button>
        </div>
      )}
      {draft && (
        <section>
          <SavedQueryEditor
            key={draft.id}
            value={draft}
            connections={connections}
            existingQueries={queries}
            editable={editable}
            labels={labels}
            onSave={save}
          />
          <button type="button" onClick={close}>
            {labels.close}
          </button>
        </section>
      )}
      {error && <p role="alert">{labels.rejected}</p>}
    </div>
  );
}
