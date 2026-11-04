"use client";

import { useMemo, useRef, useState } from "react";
import { HiPlus, HiTrash } from "react-icons/hi";
import { SettingsDrawerShell } from "@/features/common/components/settings-drawer/settings-drawer-shell";
import type { EventField } from "@/features/conversations/conversations-types";
import { TemplateVariablesPanel } from "@/features/conversations/template-editor-parts";
import TemplateTextField, {
  type Inserter,
} from "@/features/conversations/template-text-field";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { useSelectableOptions } from "@/features/settings-admin/selectables/selectables-api";
import {
  type ScriptContext,
  type ScriptSample,
  useScriptSamples,
} from "@/features/symptoms/control-tower/control-tower-api";
import type { Step, StepReply } from "./maintainer-api";
import {
  contextLeaves,
  fillScriptText,
  SCRIPT_PATHS,
  scriptParts,
  valueAt,
} from "./script-fill";
import { PillSelect } from "./ui/pill";
import NumberedSection from "./ui/section";
import Select from "./ui/select";

/** A field's name in the variables panel; a field with no name of its own shows its path. */
function fieldLabel(path: string, d: I18nRecord): string {
  const key = `scriptField.${path.replaceAll(".", "_")}`;
  const label = trDynamic(key, d);
  return label === key ? path : label;
}

/** The variables a script can use: the sample case's fields, or the fields every case can have. */
export function scriptFields(
  ctx: ScriptContext | undefined,
  d: I18nRecord
): EventField[] {
  const leaves = contextLeaves(ctx);
  const paths = leaves.length ? leaves.map((l) => l.path) : [...SCRIPT_PATHS];
  return paths.map((path) => ({
    name: path,
    type: "string",
    label: fieldLabel(path, d),
  }));
}

/** "-680 · TEST-PLATE · L4 · 3 nov 18:52": a case to pick as the preview's data. */
function sampleLabel(s: ScriptSample, lang: string): string {
  const at = new Date(s.opened_at).toLocaleString(lang, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${s.symptom_id} · ${s.asset_id} · L${s.icu_code} · ${at}`;
}

type PreviewMode = "operator" | "voice";

function Filled({
  text,
  ctx,
  hasSample,
  d,
}: Readonly<{
  text: string;
  ctx: ScriptContext | undefined;
  hasSample: boolean;
  d: I18nRecord;
}>) {
  if (!text.trim())
    return <span className="italic text-gray-400">{tr("scriptEmpty", d)}</span>;
  return (
    <>
      {scriptParts(text, ctx).map((part, i) => {
        const key = `part-${i}`;
        if ("text" in part) return <span key={key}>{part.text}</span>;
        if (part.value !== null) return <b key={key}>{part.value}</b>;
        let why = tr("scriptUnknown", d);
        if (part.known)
          why = hasSample
            ? tr("scriptMissing", d)
            : tr("scriptNoSampleValue", d);
        return (
          <mark
            key={key}
            title={why}
            className="rounded bg-amber-100 px-0.5 dark:bg-amber-900/40 dark:text-amber-200"
          >
            {`{{${part.variable}}}`}
          </mark>
        );
      })}
    </>
  );
}

/**
 * How the step reads with the sample case's data: as the operator sees it
 * (message, goal, expected answers), or as a voice agent would take it (first
 * message, instruction, how the call can end).
 */
function ScriptPreview({
  step,
  ctx,
  hasSample,
  resultLabel,
  d,
}: Readonly<{
  step: Step;
  ctx: ScriptContext | undefined;
  hasSample: boolean;
  resultLabel: (value: string) => string;
  d: I18nRecord;
}>) {
  const [mode, setMode] = useState<PreviewMode>("operator");
  const replies = (step.replies ?? []).filter((r) => r.says.trim() || r.result);
  const tab = (m: PreviewMode) =>
    `rounded px-2 py-0.5 text-xs ${mode === m ? "bg-white font-medium text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-600 dark:text-gray-300"}`;
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
          {tr("scriptPreviewTitle", d)}
        </h3>
        <div
          role="tablist"
          className="ml-auto flex rounded-md bg-gray-100 p-0.5 dark:bg-gray-900"
        >
          {(["operator", "voice"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={tab(m)}
              onClick={() => setMode(m)}
            >
              {m === "operator"
                ? tr("scriptPreviewOperator", d)
                : tr("scriptPreviewVoice", d)}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {hasSample ? tr("scriptPreview", d) : tr("scriptNoSample", d)}
      </p>
      {mode === "operator" ? (
        <div className="flex flex-col gap-2 text-sm text-gray-800 dark:text-gray-100">
          <p className="whitespace-pre-wrap rounded-md bg-blue-50 px-3 py-2 dark:bg-blue-900/20">
            <Filled
              text={step.script ?? ""}
              ctx={ctx}
              hasSample={hasSample}
              d={d}
            />
          </p>
          {step.goal?.trim() && (
            <p className="text-xs">
              <span className="font-medium">
                {tr("scriptSectionGoal", d)}:{" "}
              </span>
              <Filled text={step.goal} ctx={ctx} hasSample={hasSample} d={d} />
            </p>
          )}
          {replies.length > 0 && (
            <ul className="flex flex-col gap-1 text-xs">
              {replies.map((r, i) => (
                <li key={`reply-${i}`} className="flex gap-1">
                  <span className="text-gray-500">→</span>
                  <span>
                    {tr("scriptReplyLine", d, {
                      says: fillScriptText(r.says, ctx),
                      result: resultLabel(r.result),
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <dl className="flex flex-col gap-2 text-sm text-gray-800 dark:text-gray-100">
          <dt className="text-xs font-medium text-gray-500">
            {tr("scriptVoiceFirst", d)}
          </dt>
          <dd className="whitespace-pre-wrap rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-900/50">
            <Filled
              text={step.script ?? ""}
              ctx={ctx}
              hasSample={hasSample}
              d={d}
            />
          </dd>
          <dt className="text-xs font-medium text-gray-500">
            {tr("scriptVoiceGoal", d)}
          </dt>
          <dd className="whitespace-pre-wrap rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-900/50">
            <Filled
              text={step.goal ?? ""}
              ctx={ctx}
              hasSample={hasSample}
              d={d}
            />
          </dd>
          <dt className="text-xs font-medium text-gray-500">
            {tr("scriptVoiceResults", d)}
          </dt>
          <dd className="text-xs">
            {replies.length === 0
              ? tr("scriptNoReplies", d)
              : replies.map((r, i) => (
                  <div key={`voice-${i}`}>
                    <b>{resultLabel(r.result)}</b>:{" "}
                    {fillScriptText(r.says, ctx)}
                  </div>
                ))}
          </dd>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {tr("scriptVoiceSoon", d)}
          </p>
        </dl>
      )}
    </section>
  );
}

function ReplyRow({
  reply,
  results,
  readOnly,
  d,
  onChange,
  onRemove,
}: Readonly<{
  reply: StepReply;
  results: { value: string; label: string }[];
  readOnly: boolean;
  d: I18nRecord;
  onChange: (reply: StepReply) => void;
  onRemove: () => void;
}>) {
  const known = results.some((r) => r.value === reply.result);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
      <span>{tr("scriptReplyIf", d)}</span>
      <input
        aria-label={tr("scriptReplySays", d)}
        className="min-w-48 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        disabled={readOnly}
        placeholder={tr("scriptReplySaysPlaceholder", d)}
        value={reply.says}
        onChange={(e) => onChange({ ...reply, says: e.target.value })}
      />
      <span>→</span>
      <PillSelect
        ariaLabel={tr("scriptReplyResult", d)}
        disabled={readOnly}
        value={reply.result}
        onChange={(result) => onChange({ ...reply, result })}
        options={[
          { value: "", label: tr("scriptReplyPick", d) },
          ...(known || !reply.result
            ? []
            : [{ value: reply.result, label: reply.result }]),
          ...results,
        ]}
      />
      {!readOnly && (
        <button
          type="button"
          aria-label={tr("scriptRemoveReply", d)}
          className="ml-auto text-gray-400 hover:text-red-500"
          onClick={onRemove}
        >
          <HiTrash className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/**
 * A step's script, in a side panel: 1 the message (what is said), 2 the goal
 * (what the call must obtain), 3 the expected answers (each records a call
 * result). The same three parts serve the operator today and a voice agent
 * (ElevenLabs) later. Beside them, the script with a recent case's data and
 * the case's fields to insert.
 */
export default function ScriptPanel({
  open,
  index,
  step,
  symptomName,
  icu,
  readOnly,
  lang = "es",
  d,
  templateDict,
  onChange,
  onClose,
}: Readonly<{
  open: boolean;
  /** The step's position, from 0. */
  index: number;
  step: Step;
  /** The symptom whose recent cases fill the preview; absent for a template. */
  symptomName?: string;
  icu?: number;
  readOnly: boolean;
  lang?: string;
  d: I18nRecord;
  /** The Comunicaciones texts the template field and the variables panel read. */
  templateDict: I18nRecord;
  onChange: (patch: Partial<Step>) => void;
  onClose: () => void;
}>) {
  const { data: samples } = useScriptSamples(open ? symptomName : null, icu);
  const [picked, setPicked] = useState(0);
  const sample = samples?.[Math.min(picked, samples.length - 1)];
  const ctx = sample?.context;
  const fields = useMemo(() => scriptFields(ctx, d), [ctx, d]);
  const examples = useMemo(
    () =>
      Object.fromEntries(
        fields.map((f) => [f.name, valueAt(ctx, f.name) ?? ""])
      ),
    [fields, ctx]
  );
  const { data: resultOptions } = useSelectableOptions(
    open ? "call_result" : null,
    {}
  );
  const results = useMemo(
    () =>
      (resultOptions ?? []).map((o) => ({
        value: o.value,
        label:
          (o.label as Record<string, string>)[lang] ??
          (o.label as Record<string, string>).es ??
          o.value,
      })),
    [resultOptions, lang]
  );
  const resultLabel = (value: string) =>
    results.find((r) => r.value === value)?.label ?? value;

  // The variables panel inserts where the last focused field's cursor was.
  const inserter = useRef<Inserter | null>(null);
  const focus = (i: Inserter) => {
    inserter.current = i;
    return () => {
      if (inserter.current === i) inserter.current = null;
    };
  };
  const insert = (name: string) => {
    const text = `{{${name}}}`;
    if (inserter.current) inserter.current(text);
    else onChange({ script: (step.script ?? "") + text });
  };

  const replies = step.replies ?? [];
  const setReplies = (next: StepReply[]) => onChange({ replies: next });

  return (
    <SettingsDrawerShell
      show={open}
      onClose={onClose}
      title={tr("scriptTitle", d, { n: String(index + 1) })}
      subtitle={tr("scriptPanelHint", d)}
      closeLabel={tr("close", d)}
      widthClassName="w-[min(78rem,96vw)]"
    >
      {open && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-2 text-sm dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-300">
              {tr("scriptSample", d)}
            </span>
            {samples && samples.length > 0 ? (
              <Select
                aria-label={tr("scriptSample", d)}
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                value={String(Math.min(picked, samples.length - 1))}
                onChange={(e) => setPicked(Number(e.target.value))}
              >
                {samples.map((s, i) => (
                  <option key={s.symptom_id} value={String(i)}>
                    {sampleLabel(s, lang)}
                  </option>
                ))}
              </Select>
            ) : (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {tr("scriptNoCases", d)}
              </span>
            )}
          </div>
          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="flex min-w-0 flex-col gap-4">
              <NumberedSection
                number={1}
                title={tr("scriptSectionMessage", d)}
                subtitle={tr("scriptSectionMessageSub", d)}
              >
                <TemplateTextField
                  label={tr("stepScript", d)}
                  value={step.script ?? ""}
                  onChange={(script) => onChange({ script })}
                  variables={fields}
                  known={new Set(fields.map((f) => f.name))}
                  d={templateDict}
                  readOnly={readOnly}
                  rows={6}
                  placeholder={tr("scriptMessagePlaceholder", d)}
                  hint={tr("scriptHint", d)}
                  onFocusField={focus}
                />
              </NumberedSection>
              <NumberedSection
                number={2}
                title={tr("scriptSectionGoal", d)}
                subtitle={tr("scriptSectionGoalSub", d)}
              >
                <TemplateTextField
                  label={tr("scriptGoalLabel", d)}
                  value={step.goal ?? ""}
                  onChange={(goal) => onChange({ goal })}
                  variables={fields}
                  known={new Set(fields.map((f) => f.name))}
                  d={templateDict}
                  readOnly={readOnly}
                  rows={3}
                  placeholder={tr("scriptGoalPlaceholder", d)}
                  onFocusField={focus}
                />
              </NumberedSection>
              <NumberedSection
                number={3}
                title={tr("scriptSectionReplies", d)}
                subtitle={tr("scriptSectionRepliesSub", d)}
              >
                {replies.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {tr("scriptNoReplies", d)}
                  </p>
                )}
                {replies.map((r, i) => (
                  <ReplyRow
                    key={`reply-${i}`}
                    reply={r}
                    results={results}
                    readOnly={readOnly}
                    d={d}
                    onChange={(next) =>
                      setReplies(replies.map((x, j) => (j === i ? next : x)))
                    }
                    onRemove={() =>
                      setReplies(replies.filter((_, j) => j !== i))
                    }
                  />
                ))}
                {!readOnly && (
                  <button
                    type="button"
                    className="flex items-center gap-1 self-start text-sm text-blue-600 hover:underline dark:text-blue-400"
                    onClick={() =>
                      setReplies([...replies, { result: "", says: "" }])
                    }
                  >
                    <HiPlus className="h-4 w-4" />
                    {tr("scriptAddReply", d)}
                  </button>
                )}
              </NumberedSection>
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <ScriptPreview
                step={step}
                ctx={ctx}
                hasSample={ctx !== undefined}
                resultLabel={resultLabel}
                d={d}
              />
              <TemplateVariablesPanel
                variables={fields}
                examples={examples}
                eventPicked
                readOnly={readOnly}
                d={templateDict}
                onInsert={insert}
              />
            </div>
          </div>
        </div>
      )}
    </SettingsDrawerShell>
  );
}
