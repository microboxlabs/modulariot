"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Select,
  Spinner,
  TextInput,
  ToggleSwitch,
} from "flowbite-react";
import { HiPlus } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { checkTemplate } from "@/features/shipping/components/lane/review-template-validation";
import { TemplateInput } from "@/features/common/templating/template-input";
import {
  deleteBinding,
  EnrichmentRequestError,
  fetchBindingsByEvent,
  fetchEnrichmentTargets,
  upsertBinding,
} from "../enrichment/enrichment-data-service";
import type { EnrichmentTarget } from "../enrichment/enrichment.types";
import {
  DISPATCH_EVENT_TYPE,
  DISPATCH_NAMESPACES,
  DISPATCH_TEMPLATE_ROOTS,
  type DispatchBinding,
} from "./dispatch.types";
import {
  buildDispatchUpsert,
  conditionRowsOf,
  dispatchFormProblems,
  type ConditionRow,
  type DispatchFormProblem,
} from "./dispatch-upsert";

interface CalendarDispatchSectionProps {
  /** Mirrors the drawer's `show` — reload on every open, like the enrichment section. */
  readonly active: boolean;
  readonly orgSlug: string | null;
  readonly calendarId: string;
  readonly dict: I18nRecord;
}

type View = { kind: "list" } | { kind: "edit"; binding: DispatchBinding | null };

/**
 * Calendar › settings drawer, second advanced section: the resource-assignment
 * dispatch binding — which partner endpoint hears about (un)assignments made
 * through this calendar's workflow, over the same bindings API the enrichment
 * section administers.
 *
 * Beyond the enrichment form it edits the two dispatch-only columns: a
 * stand-in default per field (what an unassignment's empty context renders —
 * the partner's placeholder tuple, as operator data) and the success/retry
 * response conditions for partners that answer HTTP 200 with a body verdict.
 */
export function CalendarDispatchSection({
  active,
  orgSlug,
  calendarId,
  dict,
}: Readonly<CalendarDispatchSectionProps>) {
  const [bindings, setBindings] = useState<DispatchBinding[] | null>(null);
  const [targets, setTargets] = useState<EnrichmentTarget[]>([]);
  const [view, setView] = useState<View>({ kind: "list" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!orgSlug) return;
    const [loadedBindings, loadedTargets] = await Promise.all([
      fetchBindingsByEvent<DispatchBinding>(orgSlug, DISPATCH_EVENT_TYPE),
      fetchEnrichmentTargets(orgSlug),
    ]);
    // This calendar's view: global bindings plus the ones scoped to it.
    setBindings(
      loadedBindings.filter(
        (binding) => !binding.scopeKey || binding.scopeKey === calendarId
      )
    );
    setTargets(loadedTargets);
  }, [orgSlug, calendarId]);

  const describeFailure = useCallback(
    (failure: unknown): string => {
      if (failure instanceof EnrichmentRequestError && failure.status === 403) {
        return tr("pages.calendar.dispatch.forbidden", dict);
      }
      return (failure as Error).message;
    },
    [dict]
  );

  useEffect(() => {
    if (!active) return;
    setView({ kind: "list" });
    setError(null);
    setBindings(null);
    reload().catch((failure: unknown) => {
      setBindings([]);
      setError(describeFailure(failure));
    });
  }, [active, reload, describeFailure]);

  async function handleDelete(binding: DispatchBinding) {
    if (!orgSlug) return;
    setError(null);
    try {
      await deleteBinding(orgSlug, binding.id);
      await reload();
    } catch (failure) {
      setError(describeFailure(failure));
    }
  }

  async function handleSave(binding: ReturnType<typeof buildDispatchUpsert>) {
    if (!orgSlug) return;
    setSaving(true);
    setError(null);
    try {
      await upsertBinding(orgSlug, binding);
      setView({ kind: "list" });
      await reload();
    } catch (failure) {
      setError(describeFailure(failure));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        {tr("pages.calendar.dispatch.title", dict)}
      </h3>
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        {tr("pages.calendar.dispatch.description", dict)}
      </p>

      {view.kind === "list" && (
        <DispatchList
          bindings={bindings}
          error={error}
          dict={dict}
          onAdd={() => setView({ kind: "edit", binding: null })}
          onEdit={(binding) => setView({ kind: "edit", binding })}
          onDelete={handleDelete}
        />
      )}

      {view.kind === "edit" && (
        <DispatchForm
          targets={targets}
          editing={view.binding}
          calendarId={calendarId}
          saving={saving}
          error={error}
          dict={dict}
          onCancel={() => {
            setError(null);
            setView({ kind: "list" });
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ list */

interface DispatchListProps {
  readonly bindings: DispatchBinding[] | null;
  readonly error: string | null;
  readonly dict: I18nRecord;
  readonly onAdd: () => void;
  readonly onEdit: (binding: DispatchBinding) => void;
  readonly onDelete: (binding: DispatchBinding) => void | Promise<void>;
}

function DispatchList({
  bindings,
  error,
  dict,
  onAdd,
  onEdit,
  onDelete,
}: Readonly<DispatchListProps>) {
  return (
    <div className="flex flex-col gap-3">
      <Button color="blue" size="sm" onClick={onAdd}>
        <HiPlus className="mr-1 h-4 w-4" />
        {tr("pages.calendar.dispatch.add", dict)}
      </Button>

      {bindings === null && !error && <Spinner size="sm" />}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}
      {bindings?.length === 0 && !error && (
        <p className="rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
          {tr("pages.calendar.dispatch.empty", dict)}
        </p>
      )}

      {bindings?.map((binding) => (
        <div
          key={binding.id}
          className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
        >
          <div className="flex items-center gap-2">
            <Badge color={binding.enabled ? "success" : "gray"} size="xs">
              {binding.enabled
                ? tr("pages.calendar.dispatch.on", dict)
                : tr("pages.calendar.dispatch.off", dict)}
            </Badge>
            {binding.inherited && (
              <Badge color="indigo" size="xs">
                {tr("pages.calendar.dispatch.inherited", dict)}
              </Badge>
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {binding.scopeKey
                ? tr("pages.calendar.dispatch.thisCalendar", dict)
                : tr("pages.calendar.dispatch.allCalendars", dict)}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {Object.keys(binding.fieldTemplates).length}{" "}
            {tr("pages.calendar.dispatch.mappedFields", dict)} ·{" "}
            {Object.keys(binding.fieldDefaults ?? {}).length}{" "}
            {tr("pages.calendar.dispatch.standInValues", dict)}
          </p>
          {!binding.inherited && (
            <div className="mt-2 flex gap-2">
              <Button color="light" size="xs" onClick={() => onEdit(binding)}>
                {tr("pages.calendar.dispatch.edit", dict)}
              </Button>
              <Button color="light" size="xs" onClick={() => onDelete(binding)}>
                {tr("pages.calendar.dispatch.delete", dict)}
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ form */

interface DispatchFormProps {
  readonly targets: readonly EnrichmentTarget[];
  readonly editing: DispatchBinding | null;
  readonly calendarId: string;
  readonly saving: boolean;
  readonly error: string | null;
  readonly dict: I18nRecord;
  readonly onCancel: () => void;
  readonly onSave: (
    binding: ReturnType<typeof buildDispatchUpsert>
  ) => void | Promise<void>;
}

function DispatchForm({
  targets,
  editing,
  calendarId,
  saving,
  error,
  dict,
  onCancel,
  onSave,
}: Readonly<DispatchFormProps>) {
  const isEdit = editing !== null;
  const [targetKey, setTargetKey] = useState(
    editing ? `${editing.connectionId}:${editing.operationId ?? ""}` : ""
  );
  // Dispatch is org-wide by default — the partner hears about every calendar's
  // assignments unless the operator narrows it; a scoped row beats the global
  // one, so this stays the per-calendar override lever.
  const [scopeThisCalendar, setScopeThisCalendar] = useState(
    editing ? Boolean(editing.scopeKey) : false
  );
  const [enabled, setEnabled] = useState(editing?.enabled ?? true);
  const [templates, setTemplates] = useState<Record<string, string>>(
    editing ? { ...editing.fieldTemplates } : {}
  );
  const [defaults, setDefaults] = useState<Record<string, string>>(
    editing ? { ...editing.fieldDefaults } : {}
  );
  const [successRows, setSuccessRows] = useState<ConditionRow[]>(
    editing
      ? conditionRowsOf(editing.responseConditions, "success")
      : [["response.", ""]]
  );
  const [retryRows, setRetryRows] = useState<ConditionRow[]>(
    editing ? conditionRowsOf(editing.responseConditions, "retry") : []
  );

  const target = useMemo(
    () =>
      targets.find((t) => `${t.connectionId}:${t.operationId}` === targetKey),
    [targets, targetKey]
  );
  const targetMissing = isEdit && targetKey !== "" && !target;

  const fieldIds = target
    ? target.fields.map((field) => field.id)
    : Object.keys(templates);

  const formState = {
    connectionId: target?.connectionId ?? "",
    operationId: target?.operationId ?? "",
    scopeCalendarId: scopeThisCalendar ? calendarId : null,
    fieldTemplates: templates,
    fieldDefaults: defaults,
    successRows,
    retryRows,
    enabled,
  };
  const problems = dispatchFormProblems(formState);

  const templatesValid = Object.values(templates).every(
    (template) =>
      checkTemplate(template, DISPATCH_TEMPLATE_ROOTS).status !== "invalid"
  );
  const canSave =
    Boolean(target) && templatesValid && problems.length === 0 && !saving;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label
          htmlFor="cal-dispatch-target"
          className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {tr("pages.calendar.dispatch.connection", dict)}
        </label>
        <Select
          id="cal-dispatch-target"
          value={targetKey}
          onChange={(event) => setTargetKey(event.target.value)}
        >
          <option value="">
            {tr("pages.calendar.dispatch.connectionPlaceholder", dict)}
          </option>
          {targets.map((t) => (
            <option
              key={`${t.connectionId}:${t.operationId}`}
              value={`${t.connectionId}:${t.operationId}`}
            >
              {t.connectionName} · {t.operationName}
            </option>
          ))}
        </Select>
        {target && (
          <p className="mt-1 font-mono text-xs text-gray-500 dark:text-gray-400">
            {target.method} {target.path}
          </p>
        )}
        {targetMissing && (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            {tr("pages.calendar.dispatch.targetMissing", dict)}
          </p>
        )}
      </div>

      <ToggleSwitch
        checked={scopeThisCalendar}
        label={tr("pages.calendar.dispatch.onlyThisCalendar", dict)}
        onChange={setScopeThisCalendar}
      />

      {target && (
        <fieldset className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <legend className="px-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            {tr("pages.calendar.dispatch.requestMapping", dict)}
          </legend>
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            {tr("pages.calendar.dispatch.requestMappingHelp", dict)}
          </p>
          <div className="flex flex-col gap-3">
            {fieldIds.map((fieldId) => {
              const template = templates[fieldId] ?? "";
              const check = checkTemplate(template, DISPATCH_TEMPLATE_ROOTS);
              const orphanDefault = problems.some(
                (p) => p.code === "defaultWithoutTemplate" && p.fieldId === fieldId
              );
              return (
                <div key={fieldId}>
                  <code className="text-xs text-gray-700 dark:text-gray-300">
                    {fieldId}
                    {target.fields.find((f) => f.id === fieldId)?.required &&
                      " *"}
                  </code>
                  <div className="mt-0.5 grid grid-cols-2 gap-2">
                    <TemplateInput
                      value={template}
                      onChange={(next) =>
                        setTemplates((rows) => ({ ...rows, [fieldId]: next }))
                      }
                      namespaces={DISPATCH_NAMESPACES}
                      color={
                        { invalid: "failure", valid: "success", none: "gray" }[
                          check.status
                        ] as "gray" | "success" | "failure"
                      }
                    />
                    <TextInput
                      sizing="sm"
                      className="font-mono [&_input]:text-xs"
                      value={defaults[fieldId] ?? ""}
                      placeholder={tr(
                        "pages.calendar.dispatch.standInPlaceholder",
                        dict
                      )}
                      color={orphanDefault ? "failure" : "gray"}
                      onChange={(event) =>
                        setDefaults((rows) => ({
                          ...rows,
                          [fieldId]: event.target.value,
                        }))
                      }
                    />
                  </div>
                  {check.status === "invalid" && (
                    <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                      {tr("pages.calendar.dispatch.invalidTemplate", dict)} (
                      {check.problem?.code})
                    </p>
                  )}
                  {orphanDefault && (
                    <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                      {tr("pages.calendar.dispatch.defaultWithoutTemplate", dict)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
      )}

      <ConditionsFieldset
        legend={tr("pages.calendar.dispatch.successConditions", dict)}
        help={tr("pages.calendar.dispatch.successConditionsHelp", dict)}
        rows={successRows}
        onChange={setSuccessRows}
        dict={dict}
      />
      <ConditionsFieldset
        legend={tr("pages.calendar.dispatch.retryConditions", dict)}
        help={tr("pages.calendar.dispatch.retryConditionsHelp", dict)}
        rows={retryRows}
        onChange={setRetryRows}
        dict={dict}
      />
      {problems.some((p) => p.code === "retryWithoutSuccess") && (
        <p className="text-xs text-red-600 dark:text-red-400">
          {tr("pages.calendar.dispatch.retryWithoutSuccess", dict)}
        </p>
      )}
      {problems.some((p) => p.code === "conditionPathOutsideResponse") && (
        <p className="text-xs text-red-600 dark:text-red-400">
          {tr("pages.calendar.dispatch.conditionPathOutsideResponse", dict)}
        </p>
      )}

      <ToggleSwitch
        checked={enabled}
        label={tr("pages.calendar.dispatch.enabled", dict)}
        onChange={setEnabled}
      />

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button color="gray" size="sm" onClick={onCancel} disabled={saving}>
          {tr("pages.calendar.dispatch.cancel", dict)}
        </Button>
        <Button
          color="blue"
          size="sm"
          onClick={() => onSave(buildDispatchUpsert(formState))}
          disabled={!canSave}
        >
          {saving
            ? tr("pages.calendar.dispatch.saving", dict)
            : tr("pages.calendar.dispatch.save", dict)}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- conditions */

interface ConditionsFieldsetProps {
  readonly legend: string;
  readonly help: string;
  readonly rows: readonly ConditionRow[];
  readonly onChange: (rows: ConditionRow[]) => void;
  readonly dict: I18nRecord;
}

/**
 * One conditions block (success or retry): rows of `response.<path>` =
 * expected value. Blank rows are dropped on save; an all-blank success block
 * keeps the server's HTTP-status-only classification.
 */
function ConditionsFieldset({
  legend,
  help,
  rows,
  onChange,
  dict,
}: Readonly<ConditionsFieldsetProps>) {
  return (
    <fieldset className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <legend className="px-1 text-sm font-medium text-gray-700 dark:text-gray-300">
        {legend}
      </legend>
      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{help}</p>
      <div className="flex flex-col gap-2">
        {rows.map(([path, value], index) => (
          <div key={index} className="grid grid-cols-2 gap-2">
            <TextInput
              sizing="sm"
              className="font-mono [&_input]:text-xs"
              value={path}
              placeholder="response.…"
              onChange={(event) =>
                onChange(
                  rows.map((row, i) =>
                    i === index ? [event.target.value, row[1]] : row
                  )
                )
              }
            />
            <TextInput
              sizing="sm"
              className="font-mono [&_input]:text-xs"
              value={value}
              placeholder={tr("pages.calendar.dispatch.expectedValue", dict)}
              onChange={(event) =>
                onChange(
                  rows.map((row, i) =>
                    i === index ? [row[0], event.target.value] : row
                  )
                )
              }
            />
          </div>
        ))}
        <Button
          color="light"
          size="xs"
          className="self-start"
          onClick={() => onChange([...rows, ["response.", ""]])}
        >
          <HiPlus className="mr-1 h-3 w-3" />
          {tr("pages.calendar.dispatch.addCondition", dict)}
        </Button>
      </div>
    </fieldset>
  );
}
