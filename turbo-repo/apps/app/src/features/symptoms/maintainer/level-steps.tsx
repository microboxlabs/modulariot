"use client";

import { type ReactNode, useState } from "react";
import { HiPencil, HiTrash } from "react-icons/hi";
import SortableRows from "@/features/common/components/sortable-rows";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  type ScopeRoles,
  storedTarget,
  stepTarget,
} from "../control-tower/contact-roles";
import { moveRow } from "./condition-form";
import type { Step } from "./maintainer-api";
import TargetPicker, { RoleWarning } from "./role-picker";
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

function scriptShown(script: string | null): string | null {
  const text = script?.trim();
  if (!text) return null;
  return text.length > SCRIPT_SHOWN ? `${text.slice(0, SCRIPT_SHOWN)}…` : text;
}

const errorClass = (error: string | undefined) => (error ? FIELD_ERROR : "");

/** The step's number, drawn like the rule sheet's section badge. */
const STEP_BADGE =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-gray-200 text-xs text-gray-500 dark:border-gray-600 dark:text-gray-400";

function StepItem({
  step,
  index,
  count,
  errors,
  roles,
  readOnly,
  d,
  handle,
  onSet,
  onRemove,
  onScript,
}: Readonly<{
  step: Step;
  index: number;
  count: number;
  errors: StepErrors[number] | undefined;
  roles: ScopeRoles | undefined;
  readOnly: boolean;
  d: I18nRecord;
  /** The drag handle from SortableRows; none when the list cannot be reordered. */
  handle: ReactNode;
  onSet: (patch: Partial<Step>) => void;
  onRemove: () => void;
  onScript: () => void;
}>) {
  const last = index === count - 1;
  const shown = scriptShown(step.script);
  const target = stepTarget(step.role, step.scope);
  return (
    <div className="flex min-w-0 flex-col gap-1.5 px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300">
      <div className="flex flex-wrap items-center gap-2">
        {handle}
        <span className={STEP_BADGE}>
          <span aria-hidden>{index + 1}</span>
          <span className="sr-only">
            {tr("stepN", d, { n: String(index + 1) })}
          </span>
        </span>
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
          <TargetPicker
            label={tr("stepRole", d)}
            className={FIELD}
            error={errors?.contact ? FIELD_ERROR : undefined}
            disabled={readOnly}
            target={target}
            roles={roles}
            d={d}
            onChange={(next) => onSet(storedTarget(next))}
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
            <button
              type="button"
              aria-label={tr("removeStep", d)}
              className="ml-auto text-gray-400 hover:text-red-500"
              onClick={onRemove}
            >
              <HiTrash className="h-4 w-4" />
            </button>
          )}
      </div>
        <RoleWarning target={target} roles={roles} d={d} />
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
  roles,
  sample,
  readOnly,
  d,
  onChange,
}: Readonly<{
  steps: Step[];
  slaMinutes: number | null;
  errors?: StepErrors;
  /** The contact book's roles per scope; undefined while they load. */
  roles?: ScopeRoles;
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
  const move = (from: number, to: number) => {
    setIds(moveRow(keys, from, to));
    onChange(moveRow(steps, from, to));
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
        <ol className="flex flex-col gap-1.5">
          <SortableRows
            as="li"
            items={steps}
            keys={keys}
            readOnly={readOnly}
            handleLabel={tr("dragStep", d)}
            rowClassName="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
            rowTestId="step-row"
            onMove={move}
            renderRow={(s, i, handle) => (
              <StepItem
                step={s}
                index={i}
                count={steps.length}
                errors={errors[i]}
                roles={roles}
                readOnly={readOnly}
                d={d}
                handle={handle}
                onSet={(patch) => set(i, patch)}
                onRemove={() => remove(i)}
                onScript={() => setEditing(i)}
              />
            )}
          />
        </ol>
      )}
      {!readOnly && (
        <button
          type="button"
          className="self-start text-xs text-blue-600 hover:underline dark:text-blue-400"
          onClick={() =>
            onChange([
              ...steps,
              { role: "", channel: "call", budgetMinutes: 1, script: "" },
            ])
          }
        >
          {tr("addStepLink", d)}
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
