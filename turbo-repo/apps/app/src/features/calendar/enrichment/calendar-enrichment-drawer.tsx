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
import { SettingsDrawerShell } from "@/features/common/components/settings-drawer/settings-drawer-shell";
import {
  deleteEnrichmentBinding,
  EnrichmentRequestError,
  fetchEnrichmentBindings,
  fetchEnrichmentTargets,
  upsertEnrichmentBinding,
} from "./enrichment-data-service";
import {
  DEFAULT_RESPONSE_TEMPLATES,
  ENRICHMENT_EVENT_TYPE,
  ENRICHMENT_SCOPE_KIND,
  REQUEST_NAMESPACES,
  REQUEST_TEMPLATE_ROOTS,
  REQUEST_TEMPLATE_SUGGESTIONS,
  RESPONSE_NAMESPACES,
  RESPONSE_TEMPLATE_ROOTS,
  type EnrichmentBinding,
  type EnrichmentTarget,
  type UpsertEnrichmentBinding,
} from "./enrichment.types";

interface CalendarEnrichmentDrawerProps {
  readonly show: boolean;
  readonly onClose: () => void;
  readonly orgSlug: string | null;
  /** The calendar the planner is looking at — scoping default for new bindings. */
  readonly calendarId: string;
  /** The full dictionary — keys are fully qualified `pages.calendar.*` paths. */
  readonly dict: I18nRecord;
}

type View =
  | { kind: "list" }
  | { kind: "edit"; binding: EnrichmentBinding | null };

/**
 * Calendar › settings drawer: the resource-enrichment binding, administered
 * where its effect is felt — the same right-sidebar idiom the kanban uses for
 * its review channels, over the same bindings API.
 *
 * The sidebar swaps between the list and an inline form rather than stacking a
 * modal on top: which connection answers, what to send (request rows from the
 * operation's contract, seeded with the known suggestions), what to write back
 * (booking data keys), scoped to this calendar or all. Server-side validation
 * stays the authority on what is storable.
 */
export function CalendarEnrichmentDrawer({
  show,
  onClose,
  orgSlug,
  calendarId,
  dict,
}: Readonly<CalendarEnrichmentDrawerProps>) {
  const [bindings, setBindings] = useState<EnrichmentBinding[] | null>(null);
  const [targets, setTargets] = useState<EnrichmentTarget[]>([]);
  const [view, setView] = useState<View>({ kind: "list" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!orgSlug) return;
    const [loadedBindings, loadedTargets] = await Promise.all([
      fetchEnrichmentBindings(orgSlug),
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

  // Status-aware: a 403 is "you are not an org admin", localized; anything
  // else keeps the modulith's message, which for 400s is the validation text
  // the operator needs verbatim.
  const describeFailure = useCallback(
    (failure: unknown): string => {
      if (failure instanceof EnrichmentRequestError && failure.status === 403) {
        return tr("pages.calendar.enrichment.forbidden", dict);
      }
      return (failure as Error).message;
    },
    [dict]
  );

  useEffect(() => {
    if (!show) return;
    setView({ kind: "list" });
    setError(null);
    setBindings(null);
    reload().catch((failure: unknown) => {
      setBindings([]);
      setError(describeFailure(failure));
    });
  }, [show, reload, describeFailure]);

  function handleAdd() {
    setView({ kind: "edit", binding: null });
  }

  function handleEdit(binding: EnrichmentBinding) {
    setView({ kind: "edit", binding });
  }

  function handleCancel() {
    setError(null);
    setView({ kind: "list" });
  }

  async function handleDelete(binding: EnrichmentBinding) {
    if (!orgSlug) return;
    setError(null);
    try {
      await deleteEnrichmentBinding(orgSlug, binding.id);
      await reload();
    } catch (failure) {
      // The list stays as-is: a failed delete removed nothing.
      setError(describeFailure(failure));
    }
  }

  async function handleSave(request: UpsertEnrichmentBinding) {
    if (!orgSlug) return;
    setSaving(true);
    setError(null);
    try {
      await upsertEnrichmentBinding(orgSlug, request);
      setView({ kind: "list" });
      await reload();
    } catch (failure) {
      setError(describeFailure(failure));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsDrawerShell
      show={show}
      onClose={onClose}
      title={tr("pages.calendar.advancedSettings.title", dict)}
      subtitle={tr("pages.calendar.advancedSettings.description", dict)}
      closeLabel={tr("pages.calendar.enrichment.close", dict)}
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {/* First (today: only) advanced section — the enrichment binding.
              Future advanced settings join as siblings below it. */}
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {tr("pages.calendar.enrichment.title", dict)}
        </h3>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          {tr("pages.calendar.enrichment.description", dict)}
        </p>
        {view.kind === "list" && (
          <BindingList
            bindings={bindings}
            error={error}
            dict={dict}
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}

        {view.kind === "edit" && (
          <BindingForm
            targets={targets}
            editing={view.binding}
            calendarId={calendarId}
            saving={saving}
            error={error}
            dict={dict}
            onCancel={handleCancel}
            onSave={handleSave}
          />
        )}
      </div>
    </SettingsDrawerShell>
  );
}

/* ------------------------------------------------------------------ list */

interface BindingListProps {
  readonly bindings: EnrichmentBinding[] | null;
  readonly error: string | null;
  readonly dict: I18nRecord;
  readonly onAdd: () => void;
  readonly onEdit: (binding: EnrichmentBinding) => void;
  readonly onDelete: (binding: EnrichmentBinding) => void | Promise<void>;
}

function BindingList({
  bindings,
  error,
  dict,
  onAdd,
  onEdit,
  onDelete,
}: Readonly<BindingListProps>) {
  return (
    <div className="flex flex-col gap-3">
      <Button color="blue" size="sm" onClick={onAdd}>
        <HiPlus className="mr-1 h-4 w-4" />
        {tr("pages.calendar.enrichment.add", dict)}
      </Button>

      {bindings === null && !error && <Spinner size="sm" />}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}
      {bindings?.length === 0 && !error && (
        <p className="rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
          {tr("pages.calendar.enrichment.empty", dict)}
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
                ? tr("pages.calendar.enrichment.on", dict)
                : tr("pages.calendar.enrichment.off", dict)}
            </Badge>
            {binding.inherited && (
              <Badge color="indigo" size="xs">
                {tr("pages.calendar.enrichment.inherited", dict)}
              </Badge>
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {binding.scopeKey
                ? tr("pages.calendar.enrichment.thisCalendar", dict)
                : tr("pages.calendar.enrichment.allCalendars", dict)}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {Object.keys(binding.fieldTemplates).length}→
            {Object.keys(binding.responseTemplates ?? {}).length}{" "}
            {tr("pages.calendar.enrichment.mappedFields", dict)}
          </p>
          {!binding.inherited && (
            <div className="mt-2 flex gap-2">
              <Button color="light" size="xs" onClick={() => onEdit(binding)}>
                {tr("pages.calendar.enrichment.edit", dict)}
              </Button>
              <Button color="light" size="xs" onClick={() => onDelete(binding)}>
                {tr("pages.calendar.enrichment.delete", dict)}
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ form */

interface BindingFormProps {
  readonly targets: readonly EnrichmentTarget[];
  readonly editing: EnrichmentBinding | null;
  readonly calendarId: string;
  readonly saving: boolean;
  readonly error: string | null;
  readonly dict: I18nRecord;
  readonly onCancel: () => void;
  readonly onSave: (request: UpsertEnrichmentBinding) => void | Promise<void>;
}

function BindingForm({
  targets,
  editing,
  calendarId,
  saving,
  error,
  dict,
  onCancel,
  onSave,
}: Readonly<BindingFormProps>) {
  const isEdit = editing !== null;
  const [targetKey, setTargetKey] = useState(
    editing ? `${editing.connectionId}:${editing.operationId ?? ""}` : ""
  );
  // New bindings default to THIS calendar — the planner is standing in it.
  const [scopeThisCalendar, setScopeThisCalendar] = useState(
    editing ? Boolean(editing.scopeKey) : true
  );
  const [enabled, setEnabled] = useState(editing?.enabled ?? true);
  const [requestRows, setRequestRows] = useState<Record<string, string>>(
    editing ? { ...editing.fieldTemplates } : {}
  );
  const [responseRows, setResponseRows] = useState<[string, string][]>(
    editing
      ? Object.entries(editing.responseTemplates ?? {})
      : Object.entries(DEFAULT_RESPONSE_TEMPLATES)
  );

  const target = useMemo(
    () =>
      targets.find((t) => `${t.connectionId}:${t.operationId}` === targetKey),
    [targets, targetKey]
  );

  // An edit whose stored connection/operation no longer appears among the
  // targets (deleted or deactivated). Scope and enabled stay editable; saving
  // needs a re-pick, and silence here would read as an empty selection.
  const targetMissing = isEdit && targetKey !== "" && !target;

  // A newly picked target seeds its parameters with the known suggestions; an
  // edit keeps what the operator stored.
  useEffect(() => {
    if (!target || isEdit) return;
    const seeded: Record<string, string> = {};
    for (const field of target.fields) {
      seeded[field.id] = REQUEST_TEMPLATE_SUGGESTIONS[field.id] ?? "";
    }
    setRequestRows(seeded);
  }, [target, isEdit]);

  const requestFieldIds = target
    ? target.fields.map((field) => field.id)
    : Object.keys(requestRows);

  const allValid =
    Object.values(requestRows).every(
      (template) =>
        checkTemplate(template, REQUEST_TEMPLATE_ROOTS).status !== "invalid"
    ) &&
    responseRows.every(
      ([, template]) =>
        checkTemplate(template, RESPONSE_TEMPLATE_ROOTS).status !== "invalid"
    );

  function save() {
    if (!target) return;
    onSave({
      eventType: ENRICHMENT_EVENT_TYPE,
      scopeKind: scopeThisCalendar ? ENRICHMENT_SCOPE_KIND : null,
      scopeKey: scopeThisCalendar ? calendarId : null,
      connectionId: target.connectionId,
      operationId: target.operationId,
      matchCondition: {},
      fieldTemplates: Object.fromEntries(
        Object.entries(requestRows).filter(([, template]) => template.trim())
      ),
      responseTemplates: Object.fromEntries(
        responseRows.filter(([key, template]) => key.trim() && template.trim())
      ),
      enabled,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label
          htmlFor="cal-enrich-target"
          className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {tr("pages.calendar.enrichment.connection", dict)}
        </label>
        <Select
          id="cal-enrich-target"
          value={targetKey}
          onChange={(event) => setTargetKey(event.target.value)}
        >
          <option value="">
            {tr("pages.calendar.enrichment.connectionPlaceholder", dict)}
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
            {tr("pages.calendar.enrichment.targetMissing", dict)}
          </p>
        )}
      </div>

      <ToggleSwitch
        checked={scopeThisCalendar}
        label={tr("pages.calendar.enrichment.onlyThisCalendar", dict)}
        onChange={setScopeThisCalendar}
      />

      {target && (
        <fieldset className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <legend className="px-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            {tr("pages.calendar.enrichment.requestMapping", dict)}
          </legend>
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            {tr("pages.calendar.enrichment.requestMappingHelp", dict)}
          </p>
          <div className="flex flex-col gap-2">
            {requestFieldIds.map((fieldId) => {
              const template = requestRows[fieldId] ?? "";
              const check = checkTemplate(template, REQUEST_TEMPLATE_ROOTS);
              return (
                <div key={fieldId}>
                  <code className="text-xs text-gray-700 dark:text-gray-300">
                    {fieldId}
                  </code>
                  <div className="mt-0.5">
                    <TemplateInput
                      value={template}
                      onChange={(next) =>
                        setRequestRows((rows) => ({ ...rows, [fieldId]: next }))
                      }
                      namespaces={REQUEST_NAMESPACES}
                      color={
                        { invalid: "failure", valid: "success", none: "gray" }[
                          check.status
                        ] as "gray" | "success" | "failure"
                      }
                    />
                  </div>
                  {check.status === "invalid" && (
                    <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                      {tr("pages.calendar.enrichment.invalidTemplate", dict)} (
                      {check.problem?.code})
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
      )}

      <fieldset className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <legend className="px-1 text-sm font-medium text-gray-700 dark:text-gray-300">
          {tr("pages.calendar.enrichment.responseMapping", dict)}
        </legend>
        <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
          {tr("pages.calendar.enrichment.responseMappingHelp", dict)}
        </p>
        <div className="flex flex-col gap-2">
          {responseRows.map(([key, template], index) => {
            const check = checkTemplate(template, RESPONSE_TEMPLATE_ROOTS);
            return (
              <div key={index}>
                <div className="grid grid-cols-2 gap-2">
                  <TextInput
                    sizing="sm"
                    className="font-mono [&_input]:text-xs"
                    value={key}
                    onChange={(event) =>
                      setResponseRows((rows) =>
                        rows.map((row, i) =>
                          i === index ? [event.target.value, row[1]] : row
                        )
                      )
                    }
                  />
                  <TemplateInput
                    value={template}
                    onChange={(next) =>
                      setResponseRows((rows) =>
                        rows.map((row, i) =>
                          i === index ? [row[0], next] : row
                        )
                      )
                    }
                    namespaces={RESPONSE_NAMESPACES}
                    color={
                      { invalid: "failure", valid: "success", none: "gray" }[
                        check.status
                      ] as "gray" | "success" | "failure"
                    }
                  />
                </div>
                {check.status === "invalid" && (
                  <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                    {tr("pages.calendar.enrichment.invalidTemplate", dict)} (
                    {check.problem?.code})
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </fieldset>

      <ToggleSwitch
        checked={enabled}
        label={tr("pages.calendar.enrichment.enabled", dict)}
        onChange={setEnabled}
      />

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button color="gray" size="sm" onClick={onCancel} disabled={saving}>
          {tr("pages.calendar.enrichment.cancel", dict)}
        </Button>
        <Button
          color="blue"
          size="sm"
          onClick={save}
          disabled={saving || !target || !allValid}
        >
          {saving
            ? tr("pages.calendar.enrichment.saving", dict)
            : tr("pages.calendar.enrichment.save", dict)}
        </Button>
      </div>
    </div>
  );
}
