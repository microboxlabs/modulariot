"use client";

import { HiArrowDown, HiArrowUp, HiPlus, HiX } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { Step } from "./maintainer-api";

/** How the operator reaches the person in a step. */
export const STEP_CHANNELS = [
  { key: "call", label: "stepCall" },
  { key: "whatsapp", label: "channelWhatsapp" },
  { key: "teams", label: "channelTeams" },
  { key: "email", label: "channelEmail" },
];

const inputClass =
  "rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white";

/** Script variables the treatment screen fills from the case. */
export const SCRIPT_VARIABLES = [
  "{{patente}}",
  "{{conductor}}",
  "{{velocidad}}",
  "{{limite}}",
  "{{ruta}}",
];

/**
 * The operator's ladder for one level: who to contact, how, within how many
 * minutes of the SLA, and what to say. The treatment screen suggests the
 * steps in this order.
 */
export default function LevelSteps({
  steps,
  slaMinutes,
  readOnly,
  d,
  onChange,
}: Readonly<{
  steps: Step[];
  slaMinutes: number | null;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (steps: Step[]) => void;
}>) {
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

  return (
    <div className="flex flex-col gap-2 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-900/40">
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
        {!readOnly && (
          <button
            type="button"
            className="ml-auto flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
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
      </div>
      {steps.length === 0 && (
        <p className="text-xs text-gray-500">{tr("noSteps", d)}</p>
      )}
      <ol className="flex flex-col gap-2">
        {steps.map((s, i) => {
          const key = `step-${i}`;
          return (
            <li
              key={key}
              className="flex flex-col gap-1.5 border-l-2 border-blue-300 pl-2 dark:border-blue-700"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-5 text-xs font-semibold text-gray-500">
                  {i + 1}.
                </span>
                <input
                  aria-label={tr("stepRole", d)}
                  className={`${inputClass} min-w-36 flex-1`}
                  disabled={readOnly}
                  placeholder={tr("stepRolePlaceholder", d)}
                  value={s.role ?? ""}
                  onChange={(e) => set(i, { role: e.target.value })}
                />
                <select
                  aria-label={tr("stepChannel", d)}
                  className={inputClass}
                  disabled={readOnly}
                  value={s.channel ?? "call"}
                  onChange={(e) => set(i, { channel: e.target.value })}
                >
                  {STEP_CHANNELS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {trDynamic(c.label, d)}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                  <input
                    type="number"
                    min={1}
                    aria-label={tr("stepBudget", d)}
                    className={`${inputClass} w-14`}
                    disabled={readOnly}
                    value={s.budgetMinutes ?? ""}
                    onChange={(e) =>
                      set(i, {
                        budgetMinutes: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                  <span>min</span>
                </label>
                {!readOnly && (
                  <span className="flex items-center gap-1 text-gray-400">
                    <button
                      type="button"
                      aria-label={tr("moveUp", d)}
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                      className="hover:text-gray-700 disabled:opacity-30"
                    >
                      <HiArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={tr("moveDown", d)}
                      disabled={i === steps.length - 1}
                      onClick={() => move(i, 1)}
                      className="hover:text-gray-700 disabled:opacity-30"
                    >
                      <HiArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={tr("removeStep", d)}
                      onClick={() => onChange(steps.filter((_, j) => j !== i))}
                      className="hover:text-red-600"
                    >
                      <HiX className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
              </div>
              <textarea
                aria-label={tr("stepScript", d)}
                rows={2}
                className={`${inputClass} w-full resize-y`}
                disabled={readOnly}
                placeholder={tr("stepScriptPlaceholder", d, {
                  vars: SCRIPT_VARIABLES.join(" "),
                })}
                value={s.script ?? ""}
                onChange={(e) => set(i, { script: e.target.value })}
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
