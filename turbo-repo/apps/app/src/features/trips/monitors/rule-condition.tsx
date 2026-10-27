"use client";

import { useMemo } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ActivationForm, {
  useActivationForm,
} from "@/features/symptoms/maintainer/activation-form";
import CelEditor, {
  insertIntoFocused,
  type CelField,
} from "@/features/symptoms/maintainer/cel-editor";
import type { EditMode } from "@/features/symptoms/maintainer/level-row";
import type { SourceField } from "@/features/symptoms/maintainer/maintainer-api";
import {
  editorFields,
  ProblemList,
  useExpressionCheck,
} from "./expression-field";
import {
  MILESTONES,
  STAGE_TYPES,
  TRIGGERS,
  useMonitorSchema,
  type ParamValue,
  type SchemaField,
  type Trigger,
} from "./monitors-api";

export const SIGNAL_KINDS = [
  "entered_origin",
  "left_origin",
  "entered_destination",
  "left_destination",
  "entered_stop",
  "left_stop",
] as const;

const STAGE_TYPE_PATH = /^(?:stage|stages\.\w+)\.type$|^event\.stageType$/;
const MILESTONE_STATUS_PATH = /^milestones\.\w+\.status$/;
const MILESTONE_STATUSES = ["open", "pending", "confirmed", "rejected"];
const FORM_TYPES = new Set(["text", "number", "bool"]);

function valuesOf(
  path: string,
  d: I18nRecord
): { value: string; label: string }[] | null {
  if (path === "event.on")
    return TRIGGERS.map((t) => ({ value: t, label: tr(`triggers.${t}`, d) }));
  if (path === "signal.kind")
    return SIGNAL_KINDS.map((k) => ({
      value: k,
      label: tr(`signalKinds.${k}`, d),
    }));
  if (MILESTONE_STATUS_PATH.test(path))
    return MILESTONE_STATUSES.map((s) => ({
      value: s,
      label: tr(`milestoneStatus.${s}`, d),
    }));
  if (path === "event.milestone")
    return MILESTONES.map((m) => ({
      value: m,
      label: tr(`milestones.${m}`, d),
    }));
  if (STAGE_TYPE_PATH.test(path))
    return STAGE_TYPES.map((s) => ({ value: s, label: tr(`stages.${s}`, d) }));
  return null;
}

/**
 * The schema fields the condition form can compare with a value: text, numbers
 * and yes/no outside lists. Times and lists are written as an expression.
 */
export function formFields(
  schema: SchemaField[] | undefined,
  d: I18nRecord
): SourceField[] {
  return (schema ?? [])
    .filter((f) => FORM_TYPES.has(f.type) && !f.path.includes("[]"))
    .map((f) => ({
      path: f.path,
      label: f.path,
      type: f.type,
      unit: null,
      origin: null,
      engineSupported: true,
      values: valuesOf(f.path, d),
    }));
}

/** The fields a rule can read; a click writes the path where the expression was last edited. */
function FieldList({
  fields,
  readOnly,
  d,
}: Readonly<{ fields: CelField[]; readOnly: boolean; d: I18nRecord }>) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {tr("fieldsTitle", d)}
      </span>
      <ul className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 py-1 font-mono text-[11px] dark:border-gray-700 dark:bg-gray-900">
        {fields.map((f) => (
          <li key={f.path}>
            <button
              type="button"
              disabled={readOnly}
              title={tr("insertField", d, { path: f.path })}
              className="flex w-full items-center justify-between gap-2 px-3 py-0.5 text-left text-gray-800 hover:bg-blue-50 disabled:cursor-default disabled:hover:bg-transparent dark:text-gray-200 dark:hover:bg-gray-800"
              onClick={() => insertIntoFocused(f.path)}
            >
              <span className="truncate">{f.path}</span>
              <span className="shrink-0 text-gray-400">{f.detail}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * "Cuándo" of a rule in either mode: conditions on the trip's fields, the
 * symptoms' form, or the CEL expression beside the fields it can read.
 */
export default function RuleCondition({
  value,
  on,
  params,
  mode,
  readOnly,
  d,
  formDict,
  onChange,
  onMode,
}: Readonly<{
  value: string;
  on: Trigger;
  params: Record<string, ParamValue>;
  mode: EditMode;
  readOnly: boolean;
  d: I18nRecord;
  /** The symptoms catalog texts the condition form uses. */
  formDict: I18nRecord;
  onChange: (value: string | null) => void;
  onMode: (mode: EditMode) => void;
}>) {
  const { data: schema } = useMonitorSchema(on, params);
  const { problems, resultType } = useExpressionCheck(
    value,
    on,
    "condition",
    params,
    readOnly
  );
  const fields = useMemo(() => formFields(schema, d), [schema, d]);
  const { form, update } = useActivationForm(
    value,
    fields,
    // The form writes "true" when it has no conditions: the rule then always applies.
    (rule) => onChange(rule === "true" ? null : rule)
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {tr("when", d)}
        </span>
        {resultType && (
          <span className="font-mono text-[11px] text-gray-400">
            {resultType}
          </span>
        )}
      </div>
      {mode === "form" && form && (
        <ActivationForm
          form={form}
          fields={fields}
          readOnly={readOnly}
          d={formDict}
          onChange={update}
        />
      )}
      {mode === "form" && !form && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
          {tr("formCannotShow", d)}{" "}
          <button
            type="button"
            className="font-medium underline"
            onClick={() => onMode("expr")}
          >
            {tr("editAsExpression", d)}
          </button>
        </div>
      )}
      {mode === "expr" && (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <FieldList fields={editorFields(schema)} readOnly={readOnly} d={d} />
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {tr("celLabel", d)}
            </span>
            <CelEditor
              value={value}
              onChange={(next) => {
                if (next !== value) onChange(next || null);
              }}
              fields={editorFields(schema)}
              problems={problems}
              readOnly={readOnly}
              placeholder={tr("whenPlaceholder", d)}
              ariaLabel={tr("celLabel", d)}
            />
          </div>
        </div>
      )}
      <ProblemList problems={problems} />
    </div>
  );
}
