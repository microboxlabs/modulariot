"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  QueryEstimate,
  QueryPlan,
  QueryPlanDraft,
  QueryPreview,
  QuerySource,
  SourceSchema,
} from "@microboxlabs/miot-dashboard-contract/authoring";
import { QueryAuthoringError, type QueryAuthoringClient } from "./client";
import {
  DEFAULT_QUERY_WORKBENCH_LABELS,
  fill,
  formatBytes,
  type QueryWorkbenchLabels,
} from "./labels";
import { PlanSettings } from "./plan-settings";
import { ResultsTable } from "./results-table";
import { SchemaExplorer } from "./schema-explorer";
import { SqlEditor, type SqlEditorHandle } from "./sql-editor";

export interface QueryWorkbenchProps {
  readonly client: QueryAuthoringClient;
  /** The open source; omit it and the component shows a source picker. */
  readonly sourceId?: string;
  readonly onSourceChange?: (sourceId: string) => void;
  /** The open saved query, so a host can keep it in its URL. */
  readonly planId?: string | null;
  readonly onPlanChange?: (planId: string | null) => void;
  /** Save, duplicate and delete. Reading and running need only the server's permission. */
  readonly canWrite: boolean;
  readonly labels?: Partial<QueryWorkbenchLabels>;
  /** Number and byte formatting. */
  readonly locale?: string;
  /** Default read limit of a new query; 1 GB. */
  readonly defaultMaximumBytesBilled?: number;
}

const PROJECT_ID = /^[a-z][a-z0-9-]{4,61}[a-z0-9]$/;
const NEW = "new:";

function draftOf(plan: QueryPlan): QueryPlanDraft {
  return {
    name: plan.name,
    ...(plan.description ? { description: plan.description } : {}),
    projectId: plan.projectId,
    location: plan.location,
    sql: plan.sql,
    maximumBytesBilled: plan.maximumBytesBilled,
    parameters: plan.parameters,
  };
}

function sameDraft(a: QueryPlanDraft, b: QueryPlanDraft): boolean {
  return (
    a.name === b.name &&
    (a.description ?? "") === (b.description ?? "") &&
    a.projectId === b.projectId &&
    a.location === b.location &&
    a.sql === b.sql &&
    a.maximumBytesBilled === b.maximumBytesBilled &&
    JSON.stringify(a.parameters) === JSON.stringify(b.parameters)
  );
}

function messageOf(error: unknown, labels: QueryWorkbenchLabels): string {
  if (error instanceof QueryAuthoringError) {
    if (error.status === 409) return labels.conflict;
    return error.detail ?? `${labels.failed} (${error.status})`;
  }
  return labels.failed;
}

const aborted = (error: unknown) =>
  error instanceof Error && error.name === "AbortError";

/**
 * Write, test and save SQL queries against a query source: schema explorer,
 * saved queries, SQL editor with completion, dry-run estimate and results.
 */
export function QueryWorkbench({
  client,
  sourceId: controlledSource,
  onSourceChange,
  planId,
  onPlanChange,
  canWrite,
  labels: labelOverrides,
  locale,
  defaultMaximumBytesBilled = 1_000_000_000,
}: QueryWorkbenchProps) {
  const labels = useMemo(
    () => ({ ...DEFAULT_QUERY_WORKBENCH_LABELS, ...labelOverrides }),
    [labelOverrides],
  );
  const editor = useRef<SqlEditorHandle>(null);
  const [sources, setSources] = useState<QuerySource[] | null>(null);
  const [ownSource, setOwnSource] = useState<string | null>(null);
  const sourceId = controlledSource ?? ownSource;
  const source = sources?.find((item) => item.id === sourceId) ?? null;

  const [plans, setPlans] = useState<QueryPlan[]>([]);
  const [newKeys, setNewKeys] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, QueryPlanDraft>>({});
  const [activeKey, setActiveKey] = useState<string | null>(planId ?? null);
  const newCount = useRef(0);

  const [schemas, setSchemas] = useState<Record<string, SourceSchema>>({});
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<QueryEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [preview, setPreview] = useState<QueryPreview | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const run = useRef<AbortController | null>(null);

  const emptyDraft = useCallback(
    (): QueryPlanDraft => ({
      name: labels.untitled,
      projectId: source?.defaultProjectId ?? "",
      location: source?.defaultLocation ?? "US",
      sql: "",
      maximumBytesBilled: defaultMaximumBytesBilled,
      parameters: [],
    }),
    [labels.untitled, source, defaultMaximumBytesBilled],
  );
  const savedPlan = (key: string | null) =>
    key === null ? null : (plans.find((plan) => plan.id === key) ?? null);
  const baseline = (key: string): QueryPlanDraft => {
    const plan = savedPlan(key);
    return plan ? draftOf(plan) : emptyDraft();
  };
  const isDirty = (key: string) =>
    key.startsWith(NEW) ||
    (drafts[key] !== undefined && !sameDraft(drafts[key], baseline(key)));
  const activePlan = savedPlan(activeKey);
  const draft: QueryPlanDraft | null =
    activeKey === null ? null : (drafts[activeKey] ?? baseline(activeKey));

  useEffect(() => {
    const controller = new AbortController();
    client
      .listSources(controller.signal)
      .then((list) => {
        setSources(list);
        if (controlledSource === undefined && list[0])
          setOwnSource((current) => current ?? list[0]!.id);
      })
      .catch((reason: unknown) => {
        if (!aborted(reason)) setError(messageOf(reason, labels));
      });
    return () => controller.abort();
    // Sources are read once per client.
  }, [client]);

  useEffect(() => {
    if (!sourceId) return;
    const controller = new AbortController();
    setPlans([]);
    setNewKeys([]);
    setDrafts({});
    setPreview(null);
    client
      .listPlans(sourceId, controller.signal)
      .then(setPlans)
      .catch((reason: unknown) => {
        if (!aborted(reason)) setError(messageOf(reason, labels));
      });
    return () => controller.abort();
  }, [client, sourceId]);

  useEffect(() => {
    if (planId !== undefined) setActiveKey(planId);
  }, [planId]);

  const projectId = draft?.projectId ?? source?.defaultProjectId ?? "";
  const schemaKey = `${sourceId}|${projectId}`;
  const schema = schemas[schemaKey] ?? null;

  const loadSchema = useCallback(
    (refresh: boolean, signal?: AbortSignal) => {
      if (!sourceId || !PROJECT_ID.test(projectId)) return;
      setSchemaLoading(true);
      setSchemaError(null);
      client
        .schema(sourceId, projectId, { refresh, ...(signal ? { signal } : {}) })
        .then((loaded) =>
          setSchemas((current) => ({ ...current, [schemaKey]: loaded })),
        )
        .catch((reason: unknown) => {
          if (!aborted(reason)) setSchemaError(messageOf(reason, labels));
        })
        .finally(() => setSchemaLoading(false));
    },
    [client, sourceId, projectId, schemaKey, labels],
  );

  useEffect(() => {
    if (schemas[schemaKey]) return;
    const controller = new AbortController();
    const timer = setTimeout(() => loadSchema(false, controller.signal), 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [schemaKey]);

  const draftKey = draft ? JSON.stringify(draft) : "";
  useEffect(() => {
    setEstimate(null);
    setEstimateError(null);
    if (!sourceId || !draft || !draft.sql.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setEstimating(true);
      client
        .estimate(sourceId, draft, controller.signal)
        .then(setEstimate)
        .catch((reason: unknown) => {
          if (!aborted(reason)) setEstimateError(messageOf(reason, labels));
        })
        .finally(() => setEstimating(false));
    }, 600);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `draftKey` stands for the draft's content.
  }, [client, sourceId, draftKey]);

  function open(key: string | null) {
    run.current?.abort();
    setActiveKey(key);
    setPreview(null);
    setConfirmRemove(false);
    setError(null);
    setNotice(null);
    onPlanChange?.(key === null || key.startsWith(NEW) ? null : key);
  }

  function change(update: Partial<QueryPlanDraft>) {
    if (!activeKey || !draft) return;
    setDrafts((current) => ({
      ...current,
      [activeKey]: { ...draft, ...update },
    }));
  }

  function createNew(from?: QueryPlanDraft) {
    const key = `${NEW}${++newCount.current}`;
    setNewKeys((current) => [...current, key]);
    setDrafts((current) => ({ ...current, [key]: from ?? emptyDraft() }));
    open(key);
  }

  async function runPreview() {
    if (!sourceId || !draft || running) return;
    run.current?.abort();
    const controller = new AbortController();
    run.current = controller;
    setRunning(true);
    setError(null);
    try {
      setPreview(await client.preview(sourceId, draft, controller.signal));
    } catch (reason) {
      if (!aborted(reason)) setError(messageOf(reason, labels));
    } finally {
      if (run.current === controller) setRunning(false);
    }
  }

  async function save() {
    if (!sourceId || !draft || !activeKey || saving || !canWrite) return;
    setSaving(true);
    setError(null);
    try {
      const saved = activePlan
        ? await client.updatePlan(sourceId, activePlan, draft)
        : await client.createPlan(sourceId, draft);
      setPlans((current) =>
        [...current.filter((plan) => plan.id !== saved.id), saved].sort(
          (a, b) => a.name.localeCompare(b.name, locale),
        ),
      );
      setDrafts((current) => {
        const next = { ...current };
        delete next[activeKey];
        return next;
      });
      setNewKeys((current) => current.filter((key) => key !== activeKey));
      open(saved.id);
    } catch (reason) {
      setError(messageOf(reason, labels));
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    if (!activeKey) return;
    if (activeKey.startsWith(NEW)) {
      setNewKeys((current) => current.filter((key) => key !== activeKey));
      open(null);
    }
    setDrafts((current) => {
      const next = { ...current };
      delete next[activeKey];
      return next;
    });
  }

  async function remove() {
    if (!sourceId || !activePlan || !canWrite) return;
    try {
      await client.removePlan(sourceId, activePlan.id);
      setPlans((current) =>
        current.filter((plan) => plan.id !== activePlan.id),
      );
      open(null);
    } catch (reason) {
      setError(messageOf(reason, labels));
    }
  }

  function copy(text: string) {
    void navigator.clipboard
      ?.writeText(text)
      .then(() => setNotice(labels.copied))
      .catch(() => setError(labels.failed));
  }

  const entries = [
    ...plans.map((plan) => ({
      key: plan.id,
      name: drafts[plan.id]?.name ?? plan.name,
    })),
    ...newKeys.map((key) => ({
      key,
      name: drafts[key]?.name ?? labels.untitled,
    })),
  ];
  const problem = estimate?.problem ?? preview?.problem ?? null;
  const overLimit =
    estimate?.ok &&
    draft &&
    (estimate.totalBytesProcessed ?? 0) > draft.maximumBytesBilled;

  if (sources !== null && sources.length === 0)
    return (
      <div className="miot-qw">
        <p className="miot-qw-muted">{labels.noSources}</p>
      </div>
    );

  return (
    <div className="miot-qw">
      <aside className="miot-qw-side">
        {controlledSource === undefined && sources && (
          <label className="miot-qw-field">
            <span>{labels.source}</span>
            <select
              className="miot-qw-input"
              value={sourceId ?? ""}
              onChange={(event) => {
                setOwnSource(event.target.value);
                onSourceChange?.(event.target.value);
                open(null);
              }}
            >
              {sources.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <section className="miot-qw-panel" aria-label={labels.queries}>
          <header className="miot-qw-panel__header">
            <h3>{labels.queries}</h3>
            <button
              type="button"
              className="miot-qw-button"
              disabled={!sourceId}
              onClick={() => createNew()}
            >
              + {labels.newQuery}
            </button>
          </header>
          {entries.length === 0 && (
            <p className="miot-qw-muted">{labels.noQueries}</p>
          )}
          <ul className="miot-qw-list">
            {entries.map((entry) => (
              <li key={entry.key}>
                <button
                  type="button"
                  className="miot-qw-list__item"
                  aria-current={entry.key === activeKey || undefined}
                  onClick={() => open(entry.key)}
                >
                  <span>{entry.name}</span>
                  {isDirty(entry.key) && (
                    <span
                      className="miot-qw-dot"
                      role="img"
                      aria-label={labels.unsaved}
                      title={labels.unsaved}
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
        <SchemaExplorer
          schema={schema}
          loading={schemaLoading}
          error={schemaError}
          labels={labels}
          onInsert={(text) => editor.current?.insert(text)}
          onRefresh={() => loadSchema(true)}
        />
      </aside>

      <main className="miot-qw-main">
        {draft && activeKey ? (
          <>
            <div className="miot-qw-toolbar" role="toolbar">
              <button
                type="button"
                className="miot-qw-button miot-qw-button--primary"
                disabled={running || !draft.sql.trim()}
                onClick={() => void runPreview()}
                title="⌘↵"
              >
                ▶ {running ? labels.running : labels.run}
              </button>
              {canWrite && (
                <button
                  type="button"
                  className="miot-qw-button"
                  disabled={saving || !isDirty(activeKey)}
                  onClick={() => void save()}
                >
                  {saving ? labels.saving : labels.save}
                </button>
              )}
              <button
                type="button"
                className="miot-qw-button"
                disabled={!isDirty(activeKey)}
                onClick={discard}
              >
                {labels.discard}
              </button>
              <button
                type="button"
                className="miot-qw-button"
                onClick={() => copy(draft.sql)}
              >
                {labels.copySql}
              </button>
              {canWrite && (
                <button
                  type="button"
                  className="miot-qw-button"
                  onClick={() =>
                    createNew({
                      ...draft,
                      name: `${draft.name} ${labels.duplicateSuffix}`,
                    })
                  }
                >
                  {labels.duplicate}
                </button>
              )}
              {canWrite && activePlan && (
                <button
                  type="button"
                  className="miot-qw-button miot-qw-button--danger"
                  onClick={() => setConfirmRemove(true)}
                >
                  {labels.remove}
                </button>
              )}
              {notice && <span className="miot-qw-muted">{notice}</span>}
            </div>
            {confirmRemove && (
              <div className="miot-qw-confirm" role="alertdialog">
                <p>{labels.confirmRemove}</p>
                <button
                  type="button"
                  className="miot-qw-button miot-qw-button--danger"
                  onClick={() => void remove()}
                >
                  {labels.remove}
                </button>
                <button
                  type="button"
                  className="miot-qw-button"
                  onClick={() => setConfirmRemove(false)}
                >
                  {labels.cancel}
                </button>
              </div>
            )}
            {error && (
              <p className="miot-qw-error" role="alert">
                {error}
              </p>
            )}
            <SqlEditor
              key={`${sourceId}|${activeKey}`}
              ref={editor}
              id="miot-qw-sql"
              ariaLabel="SQL"
              value={draft.sql}
              schema={schema}
              problemLine={problem?.line ?? null}
              placeholder={labels.sqlPlaceholder}
              onChange={(sql) => change({ sql })}
              onRun={() => void runPreview()}
            />
            <p className="miot-qw-estimate" aria-live="polite">
              {estimating && labels.estimating}
              {!estimating && estimateError && (
                <span className="miot-qw-error">{estimateError}</span>
              )}
              {!estimating && problem && (
                <span className="miot-qw-error">
                  {problem.message}
                  {problem.line !== undefined &&
                    ` · ${fill(labels.atLine, { line: problem.line })}`}
                </span>
              )}
              {!estimating && estimate?.ok && !overLimit && (
                <span>
                  {fill(labels.willRead, {
                    bytes: formatBytes(
                      estimate.totalBytesProcessed ?? 0,
                      locale,
                    ),
                  })}
                </span>
              )}
              {!estimating && overLimit && (
                <span className="miot-qw-error">
                  {fill(labels.overLimit, {
                    bytes: formatBytes(
                      estimate?.totalBytesProcessed ?? 0,
                      locale,
                    ),
                    limit: formatBytes(draft.maximumBytesBilled, locale),
                  })}
                </span>
              )}
            </p>
            <PlanSettings
              draft={draft}
              labels={labels}
              disabled={false}
              onChange={change}
            />
            <ResultsTable
              preview={preview}
              labels={labels}
              locale={locale}
              onCopy={copy}
            />
          </>
        ) : (
          <p className="miot-qw-muted miot-qw-empty">{labels.pickQuery}</p>
        )}
      </main>
    </div>
  );
}
