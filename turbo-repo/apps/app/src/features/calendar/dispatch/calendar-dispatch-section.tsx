"use client";

import { useMemo, useState } from "react";
import { Button, TextInput, ToggleSwitch } from "flowbite-react";
import { HiPlus } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { checkTemplate } from "@/features/shipping/components/lane/review-template-validation";
import { TemplateInput } from "@/features/common/templating/template-input";
import {
  BindingListCards,
  BindingTargetPicker,
} from "../bindings/binding-section-ui";
import { useBindingSection } from "../bindings/use-binding-section";
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
} from "./dispatch-upsert";

const KEY_PREFIX = "pages.calendar.dispatch";

interface CalendarDispatchSectionProps {
  /** Mirrors the drawer's `show` — reload on every open, like the enrichment section. */
  readonly active: boolean;
  readonly orgSlug: string | null;
  readonly calendarId: string;
  readonly dict: I18nRecord;
}

/**
 * A condition row as the form edits it: the pure `ConditionRow` pair plus a
 * stable id, so list keys survive edits and row removal (an index key would
 * re-associate inputs when rows shift).
 */
interface EditableConditionRow {
  readonly id: number;
  readonly path: string;
  readonly value: string;
}

function editableRows(rows: readonly ConditionRow[]): EditableConditionRow[] {
  return rows.map(([path, value], index) => ({ id: index, path, value }));
}

function toConditionRows(rows: readonly EditableConditionRow[]): ConditionRow[] {
  return rows.map(({ path, value }) => [path, value] as const);
}

function withNewRow(rows: readonly EditableConditionRow[]): EditableConditionRow[] {
  const nextId = rows.reduce((max, row) => Math.max(max, row.id), -1) + 1;
  return [...rows, { id: nextId, path: "response.", value: "" }];
}

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
  const section = useBindingSection<DispatchBinding>({
    active,
    orgSlug,
    calendarId,
    eventType: DISPATCH_EVENT_TYPE,
    forbiddenKey: `${KEY_PREFIX}.forbidden`,
    dict,
  });

  return (
    <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        {tr(`${KEY_PREFIX}.title`, dict)}
      </h3>
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        {tr(`${KEY_PREFIX}.description`, dict)}
      </p>

      {section.view.kind === "list" && (
        <BindingListCards
          bindings={section.bindings}
          error={section.error}
          dict={dict}
          keyPrefix={KEY_PREFIX}
          summary={(binding) => {
            const mapped = tr(`${KEY_PREFIX}.mappedFields`, dict);
            const standIns = tr(`${KEY_PREFIX}.standInValues`, dict);
            const templateCount = Object.keys(binding.fieldTemplates).length;
            const defaultCount = Object.keys(binding.fieldDefaults ?? {}).length;
            return `${templateCount} ${mapped} · ${defaultCount} ${standIns}`;
          }}
          onAdd={() => section.setView({ kind: "edit", binding: null })}
          onEdit={(binding) => section.setView({ kind: "edit", binding })}
          onDelete={section.handleDelete}
        />
      )}

      {section.view.kind === "edit" && (
        <DispatchForm
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
  const [successRows, setSuccessRows] = useState<EditableConditionRow[]>(
    editableRows(
      editing
        ? conditionRowsOf(editing.responseConditions, "success")
        : [["response.", ""]]
    )
  );
  const [retryRows, setRetryRows] = useState<EditableConditionRow[]>(
    editableRows(editing ? conditionRowsOf(editing.responseConditions, "retry") : [])
  );

  const target = useMemo(
    () =>
      targets.find((t) => `${t.connectionId}:${t.operationId}` === targetKey),
    [targets, targetKey]
  );

  const fieldIds = target
    ? target.fields.map((field) => field.id)
    : Object.keys(templates);

  const formState = {
    connectionId: target?.connectionId ?? "",
    operationId: target?.operationId ?? "",
    scopeCalendarId: scopeThisCalendar ? calendarId : null,
    fieldTemplates: templates,
    fieldDefaults: defaults,
    successRows: toConditionRows(successRows),
    retryRows: toConditionRows(retryRows),
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
      <BindingTargetPicker
        id="cal-dispatch-target"
        targets={targets}
        value={targetKey}
        onChange={setTargetKey}
        missing={isEdit && targetKey !== "" && !target}
        dict={dict}
        keyPrefix={KEY_PREFIX}
      />

      <ToggleSwitch
        checked={scopeThisCalendar}
        label={tr(`${KEY_PREFIX}.onlyThisCalendar`, dict)}
        onChange={setScopeThisCalendar}
      />

      {target && (
        <fieldset className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <legend className="px-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            {tr(`${KEY_PREFIX}.requestMapping`, dict)}
          </legend>
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            {tr(`${KEY_PREFIX}.requestMappingHelp`, dict)}
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
                      placeholder={tr(`${KEY_PREFIX}.standInPlaceholder`, dict)}
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
                      {tr(`${KEY_PREFIX}.invalidTemplate`, dict)} (
                      {check.problem?.code})
                    </p>
                  )}
                  {orphanDefault && (
                    <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                      {tr(`${KEY_PREFIX}.defaultWithoutTemplate`, dict)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
      )}

      <ConditionsFieldset
        legend={tr(`${KEY_PREFIX}.successConditions`, dict)}
        help={tr(`${KEY_PREFIX}.successConditionsHelp`, dict)}
        rows={successRows}
        onChange={setSuccessRows}
        dict={dict}
      />
      <ConditionsFieldset
        legend={tr(`${KEY_PREFIX}.retryConditions`, dict)}
        help={tr(`${KEY_PREFIX}.retryConditionsHelp`, dict)}
        rows={retryRows}
        onChange={setRetryRows}
        dict={dict}
      />
      {problems.some((p) => p.code === "retryWithoutSuccess") && (
        <p className="text-xs text-red-600 dark:text-red-400">
          {tr(`${KEY_PREFIX}.retryWithoutSuccess`, dict)}
        </p>
      )}
      {problems.some((p) => p.code === "conditionPathOutsideResponse") && (
        <p className="text-xs text-red-600 dark:text-red-400">
          {tr(`${KEY_PREFIX}.conditionPathOutsideResponse`, dict)}
        </p>
      )}

      <ToggleSwitch
        checked={enabled}
        label={tr(`${KEY_PREFIX}.enabled`, dict)}
        onChange={setEnabled}
      />

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button color="gray" size="sm" onClick={onCancel} disabled={saving}>
          {tr(`${KEY_PREFIX}.cancel`, dict)}
        </Button>
        <Button
          color="blue"
          size="sm"
          onClick={() => onSave(buildDispatchUpsert(formState))}
          disabled={!canSave}
        >
          {saving
            ? tr(`${KEY_PREFIX}.saving`, dict)
            : tr(`${KEY_PREFIX}.save`, dict)}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- conditions */

interface ConditionsFieldsetProps {
  readonly legend: string;
  readonly help: string;
  readonly rows: readonly EditableConditionRow[];
  readonly onChange: (rows: EditableConditionRow[]) => void;
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
  function patchRow(id: number, patch: Partial<Omit<EditableConditionRow, "id">>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  return (
    <fieldset className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <legend className="px-1 text-sm font-medium text-gray-700 dark:text-gray-300">
        {legend}
      </legend>
      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{help}</p>
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.id} className="grid grid-cols-2 gap-2">
            <TextInput
              sizing="sm"
              className="font-mono [&_input]:text-xs"
              value={row.path}
              placeholder="response.…"
              onChange={(event) => patchRow(row.id, { path: event.target.value })}
            />
            <TextInput
              sizing="sm"
              className="font-mono [&_input]:text-xs"
              value={row.value}
              placeholder={tr(`${KEY_PREFIX}.expectedValue`, dict)}
              onChange={(event) => patchRow(row.id, { value: event.target.value })}
            />
          </div>
        ))}
        <Button
          color="light"
          size="xs"
          className="self-start"
          onClick={() => onChange(withNewRow(rows))}
        >
          <HiPlus className="mr-1 h-3 w-3" />
          {tr(`${KEY_PREFIX}.addCondition`, dict)}
        </Button>
      </div>
    </fieldset>
  );
}
