"use client";

import { useMemo, useState } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ActivationForm, {
  useActivationForm,
} from "@/features/symptoms/maintainer/activation-form";
import CelEditor, {
  type CelField,
  type CelProblem,
} from "@/features/symptoms/maintainer/cel-editor";
import type { EditMode } from "@/features/symptoms/maintainer/level-row";
import type { SourceField } from "@/features/symptoms/maintainer/maintainer-api";
import SampleTree from "@/features/symptoms/maintainer/sample-tree";
import ModeToggle from "@/features/symptoms/maintainer/ui/mode-toggle";
import NumberedSection from "@/features/symptoms/maintainer/ui/section";
import Select from "@/features/symptoms/maintainer/ui/select";
import type {
  EventTypeInfo,
  RuleTrigger,
  SampleEvent,
} from "./conversations-types";
import { eventDescription, eventGroups, eventLabel } from "./rule-model";

const FORM_TYPES: Record<string, string> = {
  string: "text",
  number: "number",
  boolean: "bool",
};

/** The event's data fields the condition form can compare with a value; dates are written as an expression. */
export function eventFormFields(
  info: EventTypeInfo | undefined
): SourceField[] {
  return (info?.fields ?? [])
    .filter((f) => FORM_TYPES[f.type])
    .map((f) => ({
      path: `event.data.${f.name}`,
      label: f.label || f.name,
      type: FORM_TYPES[f.type],
      unit: null,
      origin: null,
      engineSupported: true,
    }));
}

function EventSelect({
  value,
  catalog,
  readOnly,
  helpOpen,
  d,
  onChange,
  onToggleHelp,
}: Readonly<{
  value: string;
  catalog: EventTypeInfo[] | undefined;
  readOnly: boolean;
  helpOpen: boolean;
  d: I18nRecord;
  onChange: (event: string) => void;
  onToggleHelp: () => void;
}>) {
  const known = (catalog ?? []).some((e) => e.type === value);
  return (
    <span className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
      <label className="flex items-center gap-1">
        <span>{tr("eventLabel", d)}</span>
        <Select
          aria-label={tr("eventLabel", d)}
          className="max-w-72 rounded-md border border-gray-300 bg-white px-1.5 py-0.5 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          disabled={readOnly}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{tr("pickEvent", d)}</option>
          {value && !known && <option value={value}>{value}</option>}
          {eventGroups(
            (catalog ?? []).map((e) => e.type),
            d
          ).map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.types.map((type) => (
                <option key={type} value={type}>
                  {eventLabel(type, d, catalog)}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </label>
      <button
        type="button"
        aria-expanded={helpOpen}
        aria-label={tr("eventHelp", d)}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 text-[10px] dark:border-gray-600"
        onClick={onToggleHelp}
      >
        ?
      </button>
    </span>
  );
}

/** Section 1 of a rule: the event that starts it and the condition on its data, as a form or as CEL. */
export default function RuleTriggerSection({
  trigger,
  info,
  catalog,
  sample,
  fields,
  problems,
  summary,
  changed,
  readOnly,
  d,
  formDict,
  onChange,
}: Readonly<{
  trigger: RuleTrigger;
  info: EventTypeInfo | undefined;
  catalog: EventTypeInfo[] | undefined;
  sample: SampleEvent;
  fields: CelField[];
  problems: CelProblem[];
  summary: string;
  changed: boolean;
  readOnly: boolean;
  d: I18nRecord;
  /** The symptoms catalog texts the condition form uses. */
  formDict: I18nRecord;
  onChange: (trigger: RuleTrigger) => void;
}>) {
  const [mode, setMode] = useState<EditMode>("form");
  const [help, setHelp] = useState(false);
  const formFields = useMemo(() => eventFormFields(info), [info]);
  const when = trigger.when ?? "";
  const setWhen = (value: string) =>
    onChange({ ...trigger, when: value || null });
  // The form writes "true" when it has no conditions: the rule then always applies.
  const { form, update } = useActivationForm(
    when || "true",
    formFields,
    (rule) => setWhen(rule === "true" ? "" : rule)
  );
  const samples = useMemo(() => [{ event: sample }], [sample]);

  return (
    <NumberedSection
      number={1}
      title={tr("sectionWhen", d)}
      subtitle={tr("sectionWhenSub", d)}
      changed={changed}
      actions={
        <>
          <EventSelect
            value={trigger.event}
            catalog={catalog}
            readOnly={readOnly}
            helpOpen={help}
            d={d}
            onChange={(event) => onChange({ ...trigger, event })}
            onToggleHelp={() => setHelp((o) => !o)}
          />
          <ModeToggle mode={mode} d={d} onChange={setMode} />
        </>
      }
    >
      {help && (
        <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-300">
          <p>
            {info
              ? eventDescription(info.type, d, catalog)
              : tr("pickEvent", d)}
          </p>
          {info && (
            <p className="mt-1 font-mono text-xs text-gray-500 dark:text-gray-400">
              {info.type} · {info.source}
            </p>
          )}
        </div>
      )}
      {mode === "form" && form && (
        <ActivationForm
          form={form}
          fields={formFields}
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
            onClick={() => setMode("expr")}
          >
            {tr("editAsExpression", d)}
          </button>
        </div>
      )}
      {mode === "expr" && (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <SampleTree
            samples={samples}
            labels={[tr("sampleEvent", d)]}
            index={0}
            readOnly={readOnly}
            d={formDict}
            onIndex={() => undefined}
          />
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {tr("celLabel", d)}
            </span>
            <CelEditor
              readOnly={readOnly}
              ariaLabel={tr("celLabel", d)}
              placeholder={tr("whenPlaceholder", d)}
              value={when}
              fields={fields}
              problems={problems}
              onChange={setWhen}
            />
          </div>
        </div>
      )}
      <p className="text-sm text-gray-700 dark:text-gray-300">{summary}</p>
    </NumberedSection>
  );
}
