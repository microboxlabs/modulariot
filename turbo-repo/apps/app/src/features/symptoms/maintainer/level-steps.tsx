"use client";

import { useState } from "react";
import { HiArrowDown, HiArrowUp, HiPencil, HiPlus, HiX } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { Step } from "./maintainer-api";
import ScriptModal from "./script-modal";
import { FIELD, FIELD_ERROR, FieldError } from "./ui/response-block";
import Select from "./ui/select";

/** How the operator reaches the person in a step. */
export const STEP_CHANNELS = [
  { key: "call", label: "stepCall" },
  { key: "whatsapp", label: "channelWhatsapp" },
  { key: "teams", label: "channelTeams" },
  { key: "email", label: "channelEmail" },
];

/** The validator's messages for each step, by step index. */
export type StepErrors = Record<number, { contact?: string; minutes?: string }>;

const SCRIPT_SHOWN = 72;
const iconButton =
  "rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white";

function scriptShown(script: string | null): string | null {
  const text = script?.trim();
  if (!text) return null;
  return text.length > SCRIPT_SHOWN ? `${text.slice(0, SCRIPT_SHOWN)}…` : text;
}

const errorClass = (error: string | undefined) => (error ? FIELD_ERROR : "");

function StepActions({
  index,
  last,
  d,
  onMove,
  onRemove,
}: Readonly<{
  index: number;
  last: boolean;
  d: I18nRecord;
  onMove: (by: number) => void;
  onRemove: () => void;
}>) {
  return (
    <span className="ml-auto flex items-center">
      <button
        type="button"
        aria-label={tr("moveUp", d)}
        disabled={index === 0}
        onClick={() => onMove(-1)}
        className={iconButton}
      >
        <HiArrowUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={tr("moveDown", d)}
        disabled={last}
        onClick={() => onMove(1)}
        className={iconButton}
      >
        <HiArrowDown className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={tr("removeStep", d)}
        onClick={onRemove}
        className={`${iconButton} hover:text-red-600 dark:hover:text-red-400`}
      >
        <HiX className="h-4 w-4" />
      </button>
    </span>
  );
}

function StepItem({
  step,
  index,
  count,
  errors,
  readOnly,
  d,
  onSet,
  onMove,
  onRemove,
  onScript,
}: Readonly<{
  step: Step;
  index: number;
  count: number;
  errors: StepErrors[number] | undefined;
  readOnly: boolean;
  d: I18nRecord;
  onSet: (patch: Partial<Step>) => void;
  onMove: (by: number) => void;
  onRemove: () => void;
  onScript: () => void;
}>) {
  const last = index === count - 1;
  const shown = scriptShown(step.script);
  return (
    <li className="flex gap-3 px-3 py-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-300 text-xs font-medium text-gray-700 dark:border-gray-600 dark:text-gray-300">
        <span aria-hidden>{index + 1}</span>
        <span className="sr-only">
          {tr("stepN", d, { n: String(index + 1) })}
        </span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm text-gray-700 dark:text-gray-300">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label={tr("stepChannel", d)}
            className={FIELD}
            disabled={readOnly}
            value={step.channel ?? "call"}
            onChange={(e) => onSet({ channel: e.target.value })}
          >
            {STEP_CHANNELS.map((c) => (
              <option key={c.key} value={c.key}>
                {trDynamic(c.label, d)}
              </option>
            ))}
          </Select>
          <span>{tr("stepTo", d)}</span>
          <input
            aria-label={tr("stepRole", d)}
            className={`${FIELD} min-w-40 flex-1 ${errorClass(errors?.contact)}`}
            disabled={readOnly}
            placeholder={tr("stepRolePlaceholder", d)}
            value={step.role ?? ""}
            onChange={(e) => onSet({ role: e.target.value })}
          />
          <span>{last ? tr("stepWithin", d) : tr("stepIfNot", d)}</span>
          <input
            type="number"
            min={1}
            aria-label={tr("stepBudget", d)}
            className={`${FIELD} w-16 ${errorClass(errors?.minutes)}`}
            disabled={readOnly}
            value={step.budgetMinutes ?? ""}
            onChange={(e) =>
              onSet({
                budgetMinutes: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
          <span>
            {last ? "min" : tr("stepThen", d, { n: String(index + 2) })}
          </span>
          {!readOnly && (
            <StepActions
              index={index}
              last={last}
              d={d}
              onMove={onMove}
              onRemove={onRemove}
            />
          )}
        </div>
        <FieldError text={errors?.contact} />
        <FieldError text={errors?.minutes} />
        <button
          type="button"
          className="flex items-center gap-1.5 self-start text-left text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
          onClick={onScript}
        >
          <HiPencil className="h-3.5 w-3.5 shrink-0" />
          <span className="text-gray-500 dark:text-gray-400">
            {tr("stepScriptLabel", d)}
          </span>
          {shown ? (
            <span className="text-gray-700 dark:text-gray-300">{shown}</span>
          ) : (
            <span className="text-blue-600 dark:text-blue-400">
              {tr("stepScriptWrite", d)}
            </span>
          )}
        </button>
      </div>
    </li>
  );
}

function BudgetBar({
  used,
  sla,
  d,
}: Readonly<{ used: number; sla: number; d: I18nRecord }>) {
  const over = used > sla;
  const width = sla > 0 ? Math.min(100, (used / sla) * 100) : 100;
  return (
    <span className="ml-auto flex items-center gap-2 text-xs">
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <span
          className={`block h-full rounded-full ${over ? "bg-amber-500" : "bg-blue-600"}`}
          style={{ width: `${width}%` }}
        />
      </span>
      <span
        className={
          over
            ? "text-amber-700 dark:text-amber-400"
            : "text-gray-500 dark:text-gray-400"
        }
      >
        {tr("stepsBudget", d, { used: String(used), sla: String(sla) })}
      </span>
    </span>
  );
}

/**
 * The operator's ladder for one level: who to contact and how, the script to
 * read, and how long to wait before the next step. The treatment screen
 * suggests the steps in this order.
 */
export default function LevelSteps({
  steps,
  slaMinutes,
  errors = {},
  sample,
  readOnly,
  d,
  onChange,
}: Readonly<{
  steps: Step[];
  slaMinutes: number | null;
  errors?: StepErrors;
  /** A source sample the script preview is filled from. */
  sample?: Record<string, unknown>;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (steps: Step[]) => void;
}>) {
  const [editing, setEditing] = useState<number | null>(null);
  // Steps have no id of their own: each keeps one here, moved and removed with it.
  const [ids, setIds] = useState(() => steps.map(() => crypto.randomUUID()));
  let keys = ids;
  if (ids.length !== steps.length) {
    // Steps added, or the list replaced from outside: keep the ids that still have a step.
    keys = steps.map((_, i) => ids[i] ?? crypto.randomUUID());
    setIds(keys);
  }
  const set = (i: number, patch: Partial<Step>) =>
    onChange(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, by: number) => {
    const next = [...steps];
    const [s] = next.splice(i, 1);
    next.splice(i + by, 0, s);
    const nextIds = [...keys];
    const [id] = nextIds.splice(i, 1);
    nextIds.splice(i + by, 0, id ?? crypto.randomUUID());
    setIds(nextIds);
    onChange(next);
  };
  const remove = (i: number) => {
    setIds(keys.filter((_, j) => j !== i));
    onChange(steps.filter((_, j) => j !== i));
  };
  const budget = steps.reduce((sum, s) => sum + (s.budgetMinutes ?? 0), 0);
  const editingStep = editing === null ? undefined : steps[editing];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {tr("steps", d)}
        </span>
        {slaMinutes != null && steps.length > 0 && (
          <BudgetBar used={budget} sla={slaMinutes} d={d} />
        )}
      </div>
      {steps.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("noSteps", d)}
        </p>
      )}
      {steps.length > 0 && (
        <ol className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
          {steps.map((s, i) => (
            <StepItem
              key={keys[i]}
              step={s}
              index={i}
              count={steps.length}
              errors={errors[i]}
              readOnly={readOnly}
              d={d}
              onSet={(patch) => set(i, patch)}
              onMove={(by) => move(i, by)}
              onRemove={() => remove(i)}
              onScript={() => setEditing(i)}
            />
          ))}
        </ol>
      )}
      {!readOnly && (
        <button
          type="button"
          className="flex items-center gap-1 self-start text-sm text-blue-600 hover:underline dark:text-blue-400"
          onClick={() =>
            onChange([
              ...steps,
              { role: "", channel: "call", budgetMinutes: 1, script: "" },
            ])
          }
        >
          <HiPlus className="h-4 w-4" />
          {tr("addStep", d)}
        </button>
      )}
      {editing !== null && editingStep && (
        <ScriptModal
          open
          step={editing + 1}
          script={editingStep.script ?? ""}
          sample={sample}
          readOnly={readOnly}
          d={d}
          onChange={(script) => set(editing, { script })}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
