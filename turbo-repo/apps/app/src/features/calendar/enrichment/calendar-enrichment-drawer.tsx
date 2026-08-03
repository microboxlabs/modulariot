"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Badge,
  Button,
  Select,
  Spinner,
  TextInput,
  ToggleSwitch,
} from "flowbite-react";
import { HiPlus, HiX } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { checkTemplate } from "@/features/shipping/components/lane/review-template-validation";
import { TemplateInput } from "@/features/common/templating/template-input";
import {
  deleteEnrichmentBinding,
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
} from "./enrichment.types";

interface CalendarEnrichmentDrawerProps {
  readonly show: boolean;
  readonly onClose: () => void;
  readonly orgSlug: string | null;
  /** The calendar the planner is looking at — scoping default for new bindings. */
  readonly calendarId: string;
  /** Full dictionary; the drawer reads the `pages.calendar.enrichment` subtree. */
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
}: CalendarEnrichmentDrawerProps) {
  const eDict = useMemo(
    () =>
      (
        (dict as Record<string, unknown>).pages as
          | Record<string, I18nRecord>
          | undefined
      )?.calendar ?? {},
    [dict]
  );

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

  useEffect(() => {
    if (!show) return;
    setView({ kind: "list" });
    setError(null);
    setBindings(null);
    reload().catch((failure: Error) => {
      setBindings([]);
      // The bindings API is owner-gated; a planner without admin sees why.
      setError(failure.message);
    });
  }, [show, reload]);

  return createPortal(
    <div
      className={`fixed inset-0 z-[800] transition-all duration-300 ${
        show ? "visible opacity-100" : "invisible opacity-0"
      }`}
    >
      <button
        type="button"
        aria-label={tr("enrichment.close", eDict)}
        className={`absolute inset-0 cursor-default bg-black/20 transition-opacity duration-300 ${
          show ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`absolute right-0 top-0 flex h-full w-[30rem] max-w-full flex-col overflow-y-auto border-l border-gray-200 bg-white shadow-xl transition-transform duration-300 dark:border-gray-700 dark:bg-gray-800 ${
          show ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {tr("advancedSettings.title", eDict)}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {tr("advancedSettings.description", eDict)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr("enrichment.close", eDict)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
          >
            <HiX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 p-4">
          {/* First (today: only) advanced section — the enrichment binding.
              Future advanced settings join as siblings below it. */}
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {tr("enrichment.title", eDict)}
          </h3>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            {tr("enrichment.description", eDict)}
          </p>
          {view.kind === "list" && (
            <BindingList
              bindings={bindings}
              error={error}
              dict={eDict}
              onAdd={() => setView({ kind: "edit", binding: null })}
              onEdit={(binding) => setView({ kind: "edit", binding })}
              onDelete={async (binding) => {
                if (!orgSlug) return;
                await deleteEnrichmentBinding(orgSlug, binding.id);
                await reload();
              }}
            />
          )}

          {view.kind === "edit" && (
            <BindingForm
              targets={targets}
              editing={view.binding}
              calendarId={calendarId}
              saving={saving}
              error={error}
              dict={eDict}
              onCancel={() => {
                setError(null);
                setView({ kind: "list" });
              }}
              onSave={async (request) => {
                if (!orgSlug) return;
                setSaving(true);
                setError(null);
                try {
                  await upsertEnrichmentBinding(orgSlug, request);
                  setView({ kind: "list" });
                  await reload();
                } catch (failure) {
                  setError((failure as Error).message);
                } finally {
                  setSaving(false);
                }
              }}
            />
          )}
        </div>
      </aside>
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------------ list */

interface BindingListProps {
  readonly bindings: EnrichmentBinding[] | null;
  readonly error: string | null;
  readonly dict: I18nRecord;
  readonly onAdd: () => void;
  readonly onEdit: (binding: EnrichmentBinding) => void;
  readonly onDelete: (binding: EnrichmentBinding) => void;
}

function BindingList({
  bindings,
  error,
  dict,
  onAdd,
  onEdit,
  onDelete,
}: BindingListProps) {
  return (
    <div className="flex flex-col gap-3">
      <Button color="blue" size="sm" onClick={onAdd}>
        <HiPlus className="mr-1 h-4 w-4" />
        {tr("enrichment.add", dict)}
      </Button>

      {bindings === null && !error && <Spinner size="sm" />}
      {error && bindings?.length === 0 && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}
      {bindings?.length === 0 && !error && (
        <p className="rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
          {tr("enrichment.empty", dict)}
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
                ? tr("enrichment.on", dict)
                : tr("enrichment.off", dict)}
            </Badge>
            {binding.inherited && (
              <Badge color="indigo" size="xs">
                {tr("enrichment.inherited", dict)}
              </Badge>
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {binding.scopeKey
                ? tr("enrichment.thisCalendar", dict)
                : tr("enrichment.allCalendars", dict)}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {Object.keys(binding.fieldTemplates).length}→
            {Object.keys(binding.responseTemplates ?? {}).length}{" "}
            {tr("enrichment.mappedFields", dict)}
          </p>
          {!binding.inherited && (
            <div className="mt-2 flex gap-2">
              <Button color="light" size="xs" onClick={() => onEdit(binding)}>
                {tr("enrichment.edit", dict)}
              </Button>
              <Button color="light" size="xs" onClick={() => onDelete(binding)}>
                {tr("enrichment.delete", dict)}
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
  readonly onSave: (request: {
    eventType: string;
    scopeKind: string | null;
    scopeKey: string | null;
    connectionId: string;
    operationId: string;
    matchCondition: Record<string, unknown>;
    fieldTemplates: Record<string, string>;
    responseTemplates: Record<string, string>;
    enabled: boolean;
  }) => void;
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
}: BindingFormProps) {
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
          {tr("enrichment.connection", dict)}
        </label>
        <Select
          id="cal-enrich-target"
          value={targetKey}
          onChange={(event) => setTargetKey(event.target.value)}
        >
          <option value="">
            {tr("enrichment.connectionPlaceholder", dict)}
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
      </div>

      <ToggleSwitch
        checked={scopeThisCalendar}
        label={tr("enrichment.onlyThisCalendar", dict)}
        onChange={setScopeThisCalendar}
      />

      {target && (
        <fieldset className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <legend className="px-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            {tr("enrichment.requestMapping", dict)}
          </legend>
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            {tr("enrichment.requestMappingHelp", dict)}
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
                      {tr("enrichment.invalidTemplate", dict)} (
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
          {tr("enrichment.responseMapping", dict)}
        </legend>
        <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
          {tr("enrichment.responseMappingHelp", dict)}
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
                    {tr("enrichment.invalidTemplate", dict)} (
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
        label={tr("enrichment.enabled", dict)}
        onChange={setEnabled}
      />

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button color="gray" size="sm" onClick={onCancel} disabled={saving}>
          {tr("enrichment.cancel", dict)}
        </Button>
        <Button
          color="blue"
          size="sm"
          onClick={save}
          disabled={saving || !target || !allValid}
        >
          {saving ? tr("enrichment.saving", dict) : tr("enrichment.save", dict)}
        </Button>
      </div>
    </div>
  );
}
