"use client";

import { useState } from "react";
import { HiArrowDown, HiArrowUp, HiPhone, HiPlus, HiX } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { Step } from "./maintainer-api";
import ScriptModal from "./script-modal";
import { ChannelIcon } from "./ui/channel-icon";

/** How the operator reaches the person in a step. */
export const STEP_CHANNELS = [
  { key: "call", label: "stepCall" },
  { key: "whatsapp", label: "channelWhatsapp" },
  { key: "teams", label: "channelTeams" },
  { key: "email", label: "channelEmail" },
];

const inputClass =
  "rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white";
const SCRIPT_SHOWN = 48;

function StepIcon({ channel }: Readonly<{ channel: string | null }>) {
  if (!channel || channel === "call") {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
        <HiPhone className="h-3.5 w-3.5" />
      </span>
    );
  }
  return <ChannelIcon channel={channel} size={7} />;
}

function scriptShown(script: string | null): string | null {
  const text = script?.trim();
  if (!text) return null;
  return text.length > SCRIPT_SHOWN ? `${text.slice(0, SCRIPT_SHOWN)}…` : text;
}

function MinutesInput({
  value,
  label,
  readOnly,
  onChange,
}: Readonly<{
  value: number | null;
  label: string;
  readOnly: boolean;
  onChange: (minutes: number | null) => void;
}>) {
  return (
    <input
      type="number"
      min={1}
      aria-label={label}
      className={`${inputClass} w-12`}
      disabled={readOnly}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
    />
  );
}

function StepItem({
  step,
  index,
  count,
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
    <li className="relative flex gap-3 pb-3">
      {!last && (
        <span
          aria-hidden
          className="absolute top-8 bottom-0 left-3.5 w-px bg-gray-300 dark:bg-gray-600"
        />
      )}
      <StepIcon channel={step.channel} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-500">
            {tr("stepN", d, { n: String(index + 1) })}
          </span>
          <select
            aria-label={tr("stepChannel", d)}
            className={inputClass}
            disabled={readOnly}
            value={step.channel ?? "call"}
            onChange={(e) => onSet({ channel: e.target.value })}
          >
            {STEP_CHANNELS.map((c) => (
              <option key={c.key} value={c.key}>
                {trDynamic(c.label, d)}
              </option>
            ))}
          </select>
          <span className="text-gray-500">{tr("stepTo", d)}</span>
          <input
            aria-label={tr("stepRole", d)}
            className={`${inputClass} min-w-32 flex-1`}
            disabled={readOnly}
            placeholder={tr("stepRolePlaceholder", d)}
            value={step.role ?? ""}
            onChange={(e) => onSet({ role: e.target.value })}
          />
          {!readOnly && (
            <span className="ml-auto flex items-center gap-1 text-gray-400">
              <button
                type="button"
                aria-label={tr("moveUp", d)}
                disabled={index === 0}
                onClick={() => onMove(-1)}
                className="hover:text-gray-700 disabled:opacity-30"
              >
                <HiArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label={tr("moveDown", d)}
                disabled={last}
                onClick={() => onMove(1)}
                className="hover:text-gray-700 disabled:opacity-30"
              >
                <HiArrowDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label={tr("removeStep", d)}
                onClick={onRemove}
                className="hover:text-red-600"
              >
                <HiX className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
          <span className="text-gray-500">{tr("stepScriptLabel", d)}</span>
          <button
            type="button"
            className="text-blue-600 hover:underline dark:text-blue-400"
            onClick={onScript}
          >
            {shown ?? tr("stepScriptWrite", d)}
          </button>
          <span className="text-gray-400">·</span>
          {last ? (
            <span>{tr("stepWithin", d)}</span>
          ) : (
            <span>{tr("stepIfNot", d)}</span>
          )}
          <MinutesInput
            value={step.budgetMinutes}
            label={tr("stepBudget", d)}
            readOnly={readOnly}
            onChange={(budgetMinutes) => onSet({ budgetMinutes })}
          />
          <span>
            {last ? "min" : tr("stepThen", d, { n: String(index + 2) })}
          </span>
        </div>
      </div>
    </li>
  );
}

/**
 * The operator's ladder for one level, as a timeline: who to contact and how,
 * the script to read, and how long to wait before the next step. The
 * treatment screen suggests the steps in this order.
 */
export default function LevelSteps({
  steps,
  slaMinutes,
  sample,
  readOnly,
  d,
  onChange,
}: Readonly<{
  steps: Step[];
  slaMinutes: number | null;
  /** A source sample the script preview is filled from. */
  sample?: Record<string, unknown>;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (steps: Step[]) => void;
}>) {
  const [editing, setEditing] = useState<number | null>(null);
  const set = (i: number, patch: Partial<Step>) =>
    onChange(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, by: number) => {
    const next = [...steps];
    const [s] = next.splice(i, 1);
    next.splice(i + by, 0, s);
    onChange(next);
  };
  const budget = steps.reduce((sum, s) => sum + (s.budgetMinutes ?? 0), 0);
  const over = slaMinutes != null && budget > slaMinutes;
  const editingStep = editing === null ? undefined : steps[editing];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {tr("steps", d)}
        </span>
        {slaMinutes != null && steps.length > 0 && (
          <span
            className={`text-xs ${over ? "text-red-600 dark:text-red-400" : "text-gray-500"}`}
          >
            {tr("stepsBudget", d, {
              used: String(budget),
              sla: String(slaMinutes),
            })}
          </span>
        )}
      </div>
      {steps.length === 0 && (
        <p className="text-xs text-gray-500">{tr("noSteps", d)}</p>
      )}
      <ol className="flex flex-col">
        {steps.map((s, i) => (
          <StepItem
            key={`step-${i}`}
            step={s}
            index={i}
            count={steps.length}
            readOnly={readOnly}
            d={d}
            onSet={(patch) => set(i, patch)}
            onMove={(by) => move(i, by)}
            onRemove={() => onChange(steps.filter((_, j) => j !== i))}
            onScript={() => setEditing(i)}
          />
        ))}
      </ol>
      {!readOnly && (
        <button
          type="button"
          className="flex items-center gap-1 self-start text-xs text-blue-600 hover:underline dark:text-blue-400"
          onClick={() =>
            onChange([
              ...steps,
              { role: "", channel: "call", budgetMinutes: 1, script: "" },
            ])
          }
        >
          <HiPlus className="h-3.5 w-3.5" />
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
