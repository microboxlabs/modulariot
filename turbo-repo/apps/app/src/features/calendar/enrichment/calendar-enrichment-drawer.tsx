"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, TextInput, ToggleSwitch } from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { checkTemplate } from "@/features/shipping/components/lane/review-template-validation";
import { TemplateInput } from "@/features/common/templating/template-input";
import { SettingsDrawerShell } from "@/features/common/components/settings-drawer/settings-drawer-shell";
import {
  BindingListCards,
  BindingTargetPicker,
} from "../bindings/binding-section-ui";
import { useBindingSection } from "../bindings/use-binding-section";
import { CalendarDispatchSection } from "../dispatch/calendar-dispatch-section";
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
  const section = useBindingSection<EnrichmentBinding>({
    active: show,
    orgSlug,
    calendarId,
    eventType: ENRICHMENT_EVENT_TYPE,
    forbiddenKey: "pages.calendar.enrichment.forbidden",
    dict,
  });

  return (
    <SettingsDrawerShell
      show={show}
      onClose={onClose}
      title={tr("pages.calendar.advancedSettings.title", dict)}
      subtitle={tr("pages.calendar.advancedSettings.description", dict)}
      closeLabel={tr("pages.calendar.enrichment.close", dict)}
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {/* First advanced section — the enrichment binding. */}
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {tr("pages.calendar.enrichment.title", dict)}
        </h3>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          {tr("pages.calendar.enrichment.description", dict)}
        </p>
        {section.view.kind === "list" && (
          <BindingListCards
            bindings={section.bindings}
            error={section.error}
            dict={dict}
            keyPrefix="pages.calendar.enrichment"
            summary={(binding) =>
              `${Object.keys(binding.fieldTemplates).length}→` +
              `${Object.keys(binding.responseTemplates ?? {}).length} ` +
              tr("pages.calendar.enrichment.mappedFields", dict)
            }
            onAdd={() => section.setView({ kind: "edit", binding: null })}
            onEdit={(binding) => section.setView({ kind: "edit", binding })}
            onDelete={section.handleDelete}
          />
        )}

        {section.view.kind === "edit" && (
          <BindingForm
            targets={section.targets}
            editing={section.view.binding}
            calendarId={calendarId}
            saving={section.saving}
            error={section.error}
            dict={dict}
            onCancel={section.handleCancel}
            onSave={section.handleSave}
          />
        )}

        {/* Second advanced section — the assignment dispatch binding.
            Future advanced settings join as siblings below it. */}
        <CalendarDispatchSection
          active={show}
          orgSlug={orgSlug}
          calendarId={calendarId}
          dict={dict}
        />
      </div>
    </SettingsDrawerShell>
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
      <BindingTargetPicker
        id="cal-enrich-target"
        targets={targets}
        value={targetKey}
        onChange={setTargetKey}
        missing={isEdit && targetKey !== "" && !target}
        dict={dict}
        keyPrefix="pages.calendar.enrichment"
      />

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
