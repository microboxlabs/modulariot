"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  /** The open source; omit it and the first one opens. */
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
    if (error.status === 409) return error.detail || labels.conflict;
    return error.detail ?? `${labels.failed} (${error.status})`;
  }
  return labels.failed;
}

const aborted = (error: unknown) =>
  error instanceof Error && error.name === "AbortError";

/** Query editing state belongs to one client and one source at a time. */
export function QueryWorkbench(props: QueryWorkbenchProps) {
  const [session, setSession] = useState({ client: props.client, version: 0 });
  if (session.client !== props.client) {
    setSession({ client: props.client, version: session.version + 1 });
    return null;
  }
  return <ClientWorkbench key={session.version} {...props} />;
}

function ClientWorkbench(props: QueryWorkbenchProps) {
  const {
    client,
    sourceId: controlledSource,
    onSourceChange,
    onPlanChange,
  } = props;
  const [sources, setSources] = useState<QuerySource[] | null>(null);
  const [ownSource, setOwnSource] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const labels = useMemo(
    () => ({ ...DEFAULT_QUERY_WORKBENCH_LABELS, ...props.labels }),
    [props.labels],
  );
  const currentLabels = useRef(labels);
  useLayoutEffect(() => {
    currentLabels.current = labels;
  }, [labels]);
  useEffect(() => {
    const controller = new AbortController();
    client
      .listSources(controller.signal)
      .then((list) => {
        if (controller.signal.aborted) return;
        setSources(list);
        if (list[0]) setOwnSource((current) => current ?? list[0]!.id);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted && !aborted(reason))
          setLoadError(messageOf(reason, currentLabels.current));
      });
    return () => controller.abort();
  }, [client]);
  const sourceId = controlledSource ?? ownSource ?? undefined;
  function selectSource(value: string) {
    setOwnSource(value);
    onSourceChange?.(value);
    onPlanChange?.(null);
  }
  return (
    <WorkbenchSession
      key={sourceId ?? ""}
      {...props}
      sourceId={sourceId}
      sources={sources}
      labels={labels}
      loadError={loadError}
      onSelectSource={
        controlledSource === undefined || onSourceChange
          ? selectSource
          : undefined
      }
    />
  );
}

type SessionProps = Omit<QueryWorkbenchProps, "labels"> & {
  sources: QuerySource[] | null;
  labels: QueryWorkbenchLabels;
  loadError: string | null;
  onSelectSource?: (sourceId: string) => void;
};

function WorkbenchSession({
  client,
  sourceId,
  sources,
  labels,
  loadError,
  onSelectSource,
  planId,
  onPlanChange,
  canWrite,
  locale,
  defaultMaximumBytesBilled = 1_000_000_000,
}: SessionProps) {
  const editor = useRef<SqlEditorHandle>(null);
  const source = sources?.find((item) => item.id === sourceId) ?? null;
  const [plans, setPlans] = useState<QueryPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const draftsNow = useRef<Record<string, QueryPlanDraft>>({});
  const selected = useRef<string | null>(planId ?? null);
  const expectedEcho = useRef<string | null | undefined>(undefined);
  const mounted = useRef(true);
  const mutation = useRef(false);
  const schemaRequest = useRef<AbortController | null>(null);
  const [removing, setRemoving] = useState(false);
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
  const busy = saving || removing;
  const applySelection = useCallback((key: string | null) => {
    run.current?.abort();
    run.current = null;
    selected.current = key;
    setActiveKey(key);
    setRunning(false);
    setPreview(null);
    setEstimate(null);
    setEstimateError(null);
    setConfirmRemove(false);
    setError(null);
    setNotice(null);
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      run.current?.abort();
      schemaRequest.current?.abort();
    };
  }, []);
  function replaceDrafts(next: Record<string, QueryPlanDraft>) {
    draftsNow.current = next;
    setDrafts(next);
  }

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
    activeKey === null ||
    (!activeKey.startsWith(NEW) && (loadingPlans || activePlan === null))
      ? null
      : (drafts[activeKey] ?? baseline(activeKey));

  const currentLabels = useRef(labels);
  useLayoutEffect(() => {
    currentLabels.current = labels;
  }, [labels]);
  useEffect(() => {
    if (!sourceId) {
      setLoadingPlans(false);
      return;
    }
    const controller = new AbortController();
    client
      .listPlans(sourceId, controller.signal)
      .then((list) => {
        if (!controller.signal.aborted) setPlans(list);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted && !aborted(reason))
          setError(messageOf(reason, currentLabels.current));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingPlans(false);
      });
    return () => controller.abort();
  }, [client, sourceId]);

  useEffect(() => {
    if (planId === undefined) return;
    if (expectedEcho.current !== undefined && expectedEcho.current === planId) {
      expectedEcho.current = undefined;
      return;
    }
    expectedEcho.current = undefined;
    applySelection(planId);
  }, [planId, applySelection]);

  const projectId = draft?.projectId ?? source?.defaultProjectId ?? "";
  const schemaKey = `${sourceId}|${projectId}`;
  const schema = schemas[schemaKey] ?? null;

  const loadSchema = useCallback(
    (refresh: boolean, signal?: AbortSignal) => {
      if (!sourceId || !PROJECT_ID.test(projectId)) return;
      schemaRequest.current?.abort();
      const controller = new AbortController();
      schemaRequest.current = controller;
      const combined = signal
        ? AbortSignal.any([controller.signal, signal])
        : controller.signal;
      const current = () =>
        mounted.current &&
        !combined.aborted &&
        schemaRequest.current === controller;
      setSchemaLoading(true);
      setSchemaError(null);
      client
        .schema(sourceId, projectId, { refresh, signal: combined })
        .then((loaded) => {
          if (!current()) return;
          setSchemas((cache) => ({ ...cache, [schemaKey]: loaded }));
          setSchemaLoading(false);
        })
        .catch((reason: unknown) => {
          if (!current()) return;
          if (!aborted(reason)) setSchemaError(messageOf(reason, labels));
          setSchemaLoading(false);
        });
    },
    [client, sourceId, projectId, schemaKey, labels],
  );
  useEffect(() => {
    if (schema !== null) return;
    const controller = new AbortController();
    const timer = setTimeout(() => loadSchema(false, controller.signal), 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [schemaKey, schema, loadSchema]);

  const draftKey = draft ? JSON.stringify(draft) : "";
  useEffect(() => {
    setEstimate(null);
    setEstimateError(null);
    setEstimating(false);
    if (!sourceId || !draft?.sql.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setEstimating(true);
      client
        .estimate(sourceId, draft, controller.signal)
        .then((value) => {
          if (!controller.signal.aborted && mounted.current) setEstimate(value);
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted && mounted.current && !aborted(reason))
            setEstimateError(messageOf(reason, labels));
        })
        .finally(() => {
          if (!controller.signal.aborted && mounted.current)
            setEstimating(false);
        });
    }, 600);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `draftKey` stands for the draft's content.
  }, [client, sourceId, draftKey]);

  function open(key: string | null) {
    applySelection(key);
    const value = key === null || key.startsWith(NEW) ? null : key;
    expectedEcho.current = value !== planId ? value : undefined;
    onPlanChange?.(value);
  }
  function change(update: Partial<QueryPlanDraft>) {
    if (
      !activeKey ||
      !draft ||
      mutation.current ||
      selected.current !== activeKey
    )
      return;
    const current = draftsNow.current[activeKey] ?? draft;
    replaceDrafts({
      ...draftsNow.current,
      [activeKey]: { ...current, ...update },
    });
    run.current?.abort();
    run.current = null;
    setRunning(false);
    setPreview(null);
    setEstimate(null);
    setEstimateError(null);
    setError(null);
  }
  function createNew(from?: QueryPlanDraft) {
    if (mutation.current || loadingPlans) return;
    const key = `${NEW}${++newCount.current}`;
    setNewKeys((current) => [...current, key]);
    replaceDrafts({ ...draftsNow.current, [key]: from ?? emptyDraft() });
    open(key);
  }
  async function runPreview() {
    const currentDraft = activeKey
      ? (draftsNow.current[activeKey] ?? draft)
      : null;
    if (
      !sourceId ||
      !currentDraft ||
      running ||
      (run.current !== null && !run.current.signal.aborted) ||
      mutation.current
    )
      return;
    run.current?.abort();
    const controller = new AbortController();
    run.current = controller;
    setRunning(true);
    setError(null);
    try {
      const value = await client.preview(
        sourceId,
        currentDraft,
        controller.signal,
      );
      if (
        mounted.current &&
        run.current === controller &&
        !controller.signal.aborted
      )
        setPreview(value);
    } catch (reason) {
      if (
        mounted.current &&
        run.current === controller &&
        !controller.signal.aborted &&
        !aborted(reason)
      )
        setError(messageOf(reason, labels));
    } finally {
      if (mounted.current && run.current === controller) {
        run.current = null;
        setRunning(false);
      }
    }
  }
  async function save() {
    const submitted = activeKey
      ? (draftsNow.current[activeKey] ?? draft)
      : null;
    if (!sourceId || !submitted || !activeKey || mutation.current || !canWrite)
      return;
    const submittedKey = activeKey;
    mutation.current = true;
    setSaving(true);
    setError(null);
    try {
      const saved = activePlan
        ? await client.updatePlan(sourceId, activePlan, submitted)
        : await client.createPlan(sourceId, submitted);
      if (!mounted.current) return;
      setPlans((current) =>
        [...current.filter((plan) => plan.id !== saved.id), saved].sort(
          (a, b) => a.name.localeCompare(b.name, locale),
        ),
      );
      const next = { ...draftsNow.current };
      const latest = next[submittedKey];
      delete next[submittedKey];
      if (latest && !sameDraft(latest, submitted)) next[saved.id] = latest;
      replaceDrafts(next);
      setNewKeys((current) => current.filter((key) => key !== submittedKey));
      if (selected.current === submittedKey) open(saved.id);
    } catch (reason) {
      if (mounted.current) setError(messageOf(reason, labels));
    } finally {
      mutation.current = false;
      if (mounted.current) setSaving(false);
    }
  }
  function discard() {
    if (!activeKey || mutation.current) return;
    if (activeKey.startsWith(NEW)) {
      setNewKeys((current) => current.filter((key) => key !== activeKey));
      open(null);
    }
    const next = { ...draftsNow.current };
    delete next[activeKey];
    replaceDrafts(next);
    setPreview(null);
    setError(null);
  }
  async function remove() {
    if (!sourceId || !activePlan || !canWrite || mutation.current) return;
    mutation.current = true;
    setRemoving(true);
    try {
      await client.removePlan(sourceId, activePlan.id);
      if (!mounted.current) return;
      setPlans((current) =>
        current.filter((plan) => plan.id !== activePlan.id),
      );
      open(null);
    } catch (reason) {
      if (mounted.current) setError(messageOf(reason, labels));
    } finally {
      mutation.current = false;
      if (mounted.current) setRemoving(false);
    }
  }

  function copy(text: string) {
    void navigator.clipboard
      ?.writeText(text)
      .then(() => {
        if (mounted.current) setNotice(labels.copied);
      })
      .catch(() => {
        if (mounted.current) setError(labels.failed);
      });
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
        {sources && sources.length > 0 && (
          <label className="miot-qw-field">
            <span>{labels.source}</span>
            <select
              className="miot-qw-input"
              value={sourceId ?? ""}
              disabled={!onSelectSource}
              onChange={(event) => {
                onSelectSource?.(event.target.value);
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
              disabled={!sourceId || loadingPlans || busy}
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
                  disabled={busy}
                  onClick={() => open(entry.key)}
                >
                  <span>{entry.name}</span>
                  {isDirty(entry.key) && (
                    <svg
                      className="miot-qw-dot"
                      role="img"
                      aria-label={labels.unsaved}
                      viewBox="0 0 8 8"
                    >
                      <title>{labels.unsaved}</title>
                      <circle
                        cx="4"
                        cy="4"
                        r="4"
                        fill="var(--miot-qw-accent)"
                      />
                    </svg>
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
          onInsert={(text) => {
            if (!mutation.current) editor.current?.insert(text);
          }}
          onRefresh={() => loadSchema(true)}
        />
      </aside>

      <main className="miot-qw-main">
        {(loadError ?? error) && (
          <p className="miot-qw-error" role="alert">
            {loadError ?? error}
          </p>
        )}
        {draft && activeKey ? (
          <>
            <div className="miot-qw-toolbar" role="toolbar">
              <button
                type="button"
                className="miot-qw-button miot-qw-button--primary"
                disabled={busy || running || !draft.sql.trim()}
                onClick={() => void runPreview()}
                title="⌘↵"
              >
                ▶ {running ? labels.running : labels.run}
              </button>
              {canWrite && (
                <button
                  type="button"
                  className="miot-qw-button"
                  disabled={busy || !isDirty(activeKey)}
                  onClick={() => void save()}
                >
                  {saving ? labels.saving : labels.save}
                </button>
              )}
              <button
                type="button"
                className="miot-qw-button"
                disabled={busy || !isDirty(activeKey)}
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
                  disabled={busy}
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
                  disabled={busy}
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
                  disabled={busy}
                  onClick={() => void remove()}
                >
                  {labels.remove}
                </button>
                <button
                  type="button"
                  className="miot-qw-button"
                  disabled={busy}
                  onClick={() => setConfirmRemove(false)}
                >
                  {labels.cancel}
                </button>
              </div>
            )}
            <SqlEditor
              key={`${sourceId}|${activeKey}`}
              ref={editor}
              id="miot-qw-sql"
              ariaLabel="SQL"
              readOnly={busy}
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
              key={activeKey}
              draft={draft}
              labels={labels}
              disabled={busy}
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
