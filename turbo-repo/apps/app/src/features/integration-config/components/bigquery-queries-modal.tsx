"use client";

import { useRef, useState } from "react";
import useSWR from "swr";
import {
  Alert,
  Button,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  Select,
  Spinner,
  Textarea,
  TextInput,
} from "flowbite-react";
import { HiPlus, HiTrash } from "react-icons/hi";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  createOperation,
  fetchOperations,
} from "../integration-config-data-service";
import type { IntegrationConnection } from "../integration-config.types";
import {
  BIGQUERY_TYPES,
  DEFAULT_BYTES_BILLED,
  bigQueryFormError,
  bigQueryQueries,
  buildBigQueryOperation,
  type BigQueryQuerySummary,
  type BigQueryType,
} from "../bigquery-query";

interface BigQueryQueriesModalProps {
  readonly orgSlug: string;
  readonly connection: IntegrationConnection;
  /** The credential's project, proposed for new queries. */
  readonly defaultProjectId: string;
  readonly onClose: () => void;
  readonly dict: I18nRecord;
}

interface ParameterRow {
  readonly id: number;
  readonly name: string;
  readonly type: BigQueryType;
}

interface Draft {
  readonly name: string;
  readonly projectId: string;
  readonly location: string;
  readonly sql: string;
  readonly megabytes: string;
  readonly parameters: readonly ParameterRow[];
}

const emptyDraft = (projectId: string): Draft => ({
  name: "",
  projectId,
  location: "US",
  sql: "",
  megabytes: String(DEFAULT_BYTES_BILLED / 1_000_000),
  parameters: [],
});

/**
 * The SQL queries dashboards may run through a BigQuery connection. Each query is saved
 * as a read-only operation; dashboards pick it in their saved queries and pass values
 * for its parameters, never SQL.
 */
export function BigQueryQueriesModal({
  orgSlug,
  connection,
  defaultProjectId,
  onClose,
  dict,
}: Readonly<BigQueryQueriesModalProps>) {
  const { data, error, isLoading, mutate } = useSWR(
    ["connection-operations", orgSlug, connection.id],
    () => fetchOperations(orgSlug, connection.id),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
  const [draft, setDraft] = useState<Draft | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nextParameter = useRef(0);
  const queries = bigQueryQueries(data ?? []);

  function patch(change: Partial<Draft>) {
    setDraft((current) => (current ? { ...current, ...change } : current));
    setProblem(null);
  }

  function addParameter() {
    patch({
      parameters: [
        ...(draft?.parameters ?? []),
        { id: ++nextParameter.current, name: "", type: "STRING" },
      ],
    });
  }

  function updateParameter(id: number, change: Partial<ParameterRow>) {
    patch({
      parameters: (draft?.parameters ?? []).map((row) =>
        row.id === id ? { ...row, ...change } : row
      ),
    });
  }

  function removeParameter(id: number) {
    patch({
      parameters: (draft?.parameters ?? []).filter((row) => row.id !== id),
    });
  }

  async function save() {
    if (!draft || saving) return;
    const form = {
      name: draft.name,
      projectId: draft.projectId.trim(),
      location: draft.location.trim(),
      sql: draft.sql,
      maximumBytesBilled: Math.round(Number(draft.megabytes) * 1_000_000),
      parameters: draft.parameters.map(({ name, type }) => ({ name, type })),
    };
    const invalid = bigQueryFormError(form);
    if (invalid) {
      setProblem(invalid);
      return;
    }
    setSaving(true);
    try {
      await createOperation(
        orgSlug,
        connection.id,
        buildBigQueryOperation(form)
      );
      toast.success(tr("bigquery.saved", dict));
      setDraft(null);
      await mutate();
    } catch (cause) {
      toast.error(
        cause instanceof Error && cause.message
          ? cause.message
          : tr("toast.actionFailed", dict)
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal dismissible show onClose={onClose} size="3xl">
      <div className="flex flex-col items-start p-4 md:p-5">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {tr("bigquery.title", dict, { name: connection.name })}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {tr("bigquery.subtitle", dict)}
        </p>
      </div>
      <ModalBody className="max-h-[65vh] space-y-4 overflow-y-auto">
        {error && (
          <Alert color="failure">
            <span className="text-sm">{tr("bigquery.loadFailed", dict)}</span>
          </Alert>
        )}
        {isLoading && (
          <div className="flex justify-center py-6">
            <Spinner aria-label={tr("list.loading", dict)} />
          </div>
        )}
        {!isLoading && !error && (
          <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
            {queries.map((query) => (
              <QueryRow key={query.id} query={query} />
            ))}
            {queries.length === 0 && (
              <li className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                {tr("bigquery.empty", dict)}
              </li>
            )}
          </ul>
        )}
        {draft ? (
          <fieldset disabled={saving} className="min-w-0">
            <legend className="sr-only">{tr("bigquery.add", dict)}</legend>
            <QueryForm
              draft={draft}
              problem={problem}
              onChange={patch}
              onAddParameter={addParameter}
              onUpdateParameter={updateParameter}
              onRemoveParameter={removeParameter}
              dict={dict}
            />
          </fieldset>
        ) : (
          <Button
            color="light"
            size="sm"
            onClick={() => setDraft(emptyDraft(defaultProjectId))}
          >
            <HiPlus className="mr-1 h-4 w-4" />
            {tr("bigquery.add", dict)}
          </Button>
        )}
      </ModalBody>
      <ModalFooter className="justify-end">
        <Button color="light" onClick={onClose}>
          {tr("common.cancel", dict)}
        </Button>
        {draft && (
          <Button color="blue" disabled={saving} onClick={save}>
            {saving ? <Spinner size="sm" /> : tr("bigquery.save", dict)}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}

function QueryRow({ query }: Readonly<{ query: BigQueryQuerySummary }>) {
  return (
    <li className="p-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {query.name}
        </span>
        <code className="text-xs text-gray-500 dark:text-gray-400">
          {query.projectId} · {query.location}
        </code>
      </div>
      <pre className="mt-1 max-h-24 overflow-hidden whitespace-pre-wrap break-all font-mono text-xs text-gray-600 dark:text-gray-400">
        {query.sql}
      </pre>
      {query.parameters.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {query.parameters.map((parameter) => (
            <code
              key={parameter}
              className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-600 dark:bg-gray-700 dark:text-gray-300"
            >
              {parameter}
            </code>
          ))}
        </div>
      )}
    </li>
  );
}

interface QueryFormProps {
  readonly draft: Draft;
  readonly problem: string | null;
  readonly onChange: (change: Partial<Draft>) => void;
  readonly onAddParameter: () => void;
  readonly onUpdateParameter: (
    id: number,
    change: Partial<ParameterRow>
  ) => void;
  readonly onRemoveParameter: (id: number) => void;
  readonly dict: I18nRecord;
}

function QueryForm({
  draft,
  problem,
  onChange,
  onAddParameter,
  onUpdateParameter,
  onRemoveParameter,
  dict,
}: Readonly<QueryFormProps>) {
  return (
    <div className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <div>
        <Label htmlFor="bq-name">{tr("bigquery.name", dict)}</Label>
        <TextInput
          id="bq-name"
          value={draft.name}
          placeholder={tr("bigquery.namePlaceholder", dict)}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="bq-project">{tr("bigquery.project", dict)}</Label>
          <TextInput
            id="bq-project"
            value={draft.projectId}
            className="font-mono [&_input]:text-sm"
            onChange={(event) => onChange({ projectId: event.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="bq-location">{tr("bigquery.location", dict)}</Label>
          <TextInput
            id="bq-location"
            value={draft.location}
            className="font-mono [&_input]:text-sm"
            onChange={(event) => onChange({ location: event.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="bq-bytes">{tr("bigquery.megabytes", dict)}</Label>
          <TextInput
            id="bq-bytes"
            type="number"
            min={1}
            max={1000}
            value={draft.megabytes}
            onChange={(event) => onChange({ megabytes: event.target.value })}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="bq-sql">{tr("bigquery.sql", dict)}</Label>
        <Textarea
          id="bq-sql"
          rows={6}
          spellCheck={false}
          className="font-mono text-sm"
          placeholder="SELECT service, SUM(cost) AS cost FROM `project.dataset.table` WHERE day >= @since GROUP BY service"
          value={draft.sql}
          onChange={(event) => onChange({ sql: event.target.value })}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {tr("bigquery.sqlHelp", dict)}
        </p>
      </div>
      <div className="space-y-2">
        <Label>{tr("bigquery.parameters", dict)}</Label>
        {draft.parameters.map((row) => (
          <ParameterEditor
            key={row.id}
            row={row}
            onUpdate={onUpdateParameter}
            onRemove={onRemoveParameter}
            dict={dict}
          />
        ))}
        <Button color="light" size="xs" onClick={onAddParameter}>
          <HiPlus className="mr-1 h-3 w-3" />
          {tr("bigquery.addParameter", dict)}
        </Button>
      </div>
      {problem && (
        <p role="alert" className="text-sm text-red-600">
          {trDynamic(problem, dict)}
        </p>
      )}
    </div>
  );
}

function ParameterEditor({
  row,
  onUpdate,
  onRemove,
  dict,
}: Readonly<{
  row: ParameterRow;
  onUpdate: (id: number, change: Partial<ParameterRow>) => void;
  onRemove: (id: number) => void;
  dict: I18nRecord;
}>) {
  return (
    <div className="flex items-center gap-2">
      <TextInput
        aria-label={tr("bigquery.parameterName", dict)}
        placeholder="since"
        value={row.name}
        className="flex-1 font-mono [&_input]:text-sm"
        onChange={(event) => onUpdate(row.id, { name: event.target.value })}
      />
      <Select
        aria-label={tr("bigquery.parameterType", dict)}
        value={row.type}
        onChange={(event) =>
          onUpdate(row.id, { type: event.target.value as BigQueryType })
        }
      >
        {BIGQUERY_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </Select>
      <Button
        color="light"
        size="xs"
        aria-label={tr("common.delete", dict)}
        onClick={() => onRemove(row.id)}
      >
        <HiTrash className="h-4 w-4" />
      </Button>
    </div>
  );
}
