"use client";

import { useState } from "react";
import { Select, TextInput, ToggleSwitch } from "flowbite-react";
import { HiPlus, HiTrash, HiX } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { EditMode } from "@/features/symptoms/maintainer/level-row";
import ModeToggle from "@/features/symptoms/maintainer/ui/mode-toggle";
import ExpressionField from "./expression-field";
import RuleCondition from "./rule-condition";
import { useRowKeys } from "./use-row-keys";
import {
  ACTIONS,
  FLAG_ACTIONS,
  MILESTONES,
  STAGE_ACTIONS,
  STAGE_TYPES,
  TRIGGERS,
  type Action,
  type ActionType,
  type Finding,
  type ParamValue,
  type Rule,
  type Trigger,
} from "./monitors-api";

/** The value an action starts with when its type changes. */
function startValue(type: ActionType): string | null {
  if (STAGE_ACTIONS.includes(type)) return "transit";
  if (type === "requestConfirmation") return "departure";
  if (FLAG_ACTIONS.includes(type)) return null;
  return "";
}

function ActionRow({
  action,
  onChange,
  onRemove,
  readOnly,
  d,
}: Readonly<{
  action: Action;
  onChange: (a: Action) => void;
  onRemove: () => void;
  readOnly: boolean;
  d: I18nRecord;
}>) {
  const stage = STAGE_ACTIONS.includes(action.type);
  const milestone = action.type === "requestConfirmation";
  const flag = FLAG_ACTIONS.includes(action.type);
  return (
    <div className="flex items-center gap-2">
      <Select
        sizing="sm"
        value={action.type}
        disabled={readOnly}
        aria-label={tr("action", d)}
        onChange={(e) => {
          const type = e.target.value as ActionType;
          onChange({ type, value: startValue(type) });
        }}
      >
        {ACTIONS.map((a) => (
          <option key={a} value={a}>
            {tr(`actions.${a}`, d)}
          </option>
        ))}
      </Select>
      {stage && (
        <Select
          sizing="sm"
          value={action.value ?? ""}
          disabled={readOnly}
          aria-label={tr("stageType", d)}
          onChange={(e) => onChange({ ...action, value: e.target.value })}
        >
          {STAGE_TYPES.map((s) => (
            <option key={s} value={s}>
              {tr(`stages.${s}`, d)}
            </option>
          ))}
        </Select>
      )}
      {milestone && (
        <Select
          sizing="sm"
          value={action.value ?? ""}
          disabled={readOnly}
          aria-label={tr("milestone", d)}
          onChange={(e) => onChange({ ...action, value: e.target.value })}
        >
          {MILESTONES.map((m) => (
            <option key={m} value={m}>
              {tr(`milestones.${m}`, d)}
            </option>
          ))}
        </Select>
      )}
      {!stage && !milestone && !flag && (
        <TextInput
          sizing="sm"
          className="flex-1"
          value={action.value ?? ""}
          disabled={readOnly}
          placeholder={tr(`actionValue.${action.type}`, d)}
          aria-label={tr(`actionValue.${action.type}`, d)}
          onChange={(e) => onChange({ ...action, value: e.target.value })}
        />
      )}
      {!readOnly && (
        <button
          type="button"
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700"
          aria-label={tr("removeAction", d)}
          onClick={onRemove}
        >
          <HiX className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function Labeled({
  label,
  className = "",
  children,
}: Readonly<{ label: string; className?: string; children: React.ReactNode }>) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
        {label}
      </span>
      {children}
    </div>
  );
}

function cardBorder(active: boolean) {
  if (active) return "border-gray-200 dark:border-gray-700";
  return "border-dashed border-gray-300 opacity-70 dark:border-gray-600";
}

/**
 * One rule, drawn like a section of the symptoms sheet: a numbered header with
 * the ☰ form / { } CEL toggle, then trigger, time (timers), condition and actions.
 */
export default function RuleCard({
  number,
  rule,
  onChange,
  onRemove,
  params,
  findings,
  readOnly,
  d,
  formDict,
}: Readonly<{
  number: number;
  rule: Rule;
  onChange: (r: Rule) => void;
  onRemove: () => void;
  params: Record<string, ParamValue>;
  findings: Finding[];
  readOnly: boolean;
  d: I18nRecord;
  /** The symptoms catalog texts the condition form uses. */
  formDict: I18nRecord;
}>) {
  const [mode, setMode] = useState<EditMode>("form");
  const rowKeys = useRowKeys(rule.then.length);
  const set = (patch: Partial<Rule>) => onChange({ ...rule, ...patch });
  const setAction = (i: number, a: Action) =>
    set({ then: rule.then.map((x, j) => (j === i ? a : x)) });

  return (
    <section
      className={`rounded-lg border bg-white dark:bg-gray-800 ${cardBorder(rule.active)}`}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 text-xs text-gray-500 dark:border-gray-600 dark:text-gray-400"
        >
          {number}
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
            {rule.name || rule.key}
          </h3>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
            {tr(`triggers.${rule.on}`, d)} ·{" "}
            <span className="font-mono">{rule.key}</span>
          </p>
        </div>
        <span className="ml-auto flex items-center gap-3">
          <ToggleSwitch
            checked={rule.active}
            disabled={readOnly}
            label={tr("active", d)}
            sizing="sm"
            onChange={(active) => set({ active })}
          />
          <ModeToggle mode={mode} d={formDict} onChange={setMode} />
          {!readOnly && (
            <button
              type="button"
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-700"
              aria-label={tr("removeRule", d)}
              title={tr("removeRule", d)}
              onClick={onRemove}
            >
              <HiTrash className="h-4 w-4" />
            </button>
          )}
        </span>
      </div>

      <div className="flex flex-col gap-4 px-4 py-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto_6rem]">
          <Labeled label={tr("ruleKey", d)}>
            <TextInput
              sizing="sm"
              value={rule.key}
              disabled={readOnly}
              aria-label={tr("ruleKey", d)}
              onChange={(e) => set({ key: e.target.value })}
            />
          </Labeled>
          <Labeled label={tr("ruleName", d)}>
            <TextInput
              sizing="sm"
              value={rule.name ?? ""}
              disabled={readOnly}
              aria-label={tr("ruleName", d)}
              onChange={(e) => set({ name: e.target.value || null })}
            />
          </Labeled>
          <Labeled label={tr("trigger", d)}>
            <Select
              sizing="sm"
              value={rule.on}
              disabled={readOnly}
              aria-label={tr("trigger", d)}
              onChange={(e) => {
                const on = e.target.value as Trigger;
                set({
                  on,
                  at: on === "timer" ? (rule.at ?? "trip.plannedStart") : null,
                });
              }}
            >
              {TRIGGERS.map((t) => (
                <option key={t} value={t}>
                  {tr(`triggers.${t}`, d)}
                </option>
              ))}
            </Select>
          </Labeled>
          <Labeled label={tr("priority", d)}>
            <TextInput
              sizing="sm"
              type="number"
              value={rule.priority}
              disabled={readOnly}
              aria-label={tr("priority", d)}
              onChange={(e) => set({ priority: Number(e.target.value) || 0 })}
            />
          </Labeled>
        </div>

        {rule.on === "timer" && (
          <ExpressionField
            label={tr("at", d)}
            value={rule.at ?? ""}
            onChange={(at) => set({ at })}
            on="timer"
            expect="time"
            params={params}
            readOnly={readOnly}
            placeholder="trip.plannedStart + minutes(params.lateDepartureMinutes)"
          />
        )}

        <RuleCondition
          value={rule.when ?? ""}
          on={rule.on}
          params={params}
          mode={mode}
          readOnly={readOnly}
          d={d}
          formDict={formDict}
          onChange={(when) => set({ when })}
          onMode={setMode}
        />

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {tr("then", d)}
          </span>
          {rule.then.map((a, i) => (
            <ActionRow
              // Preserve remaining action inputs when one is removed.
              key={rowKeys.keys[i]}
              action={a}
              readOnly={readOnly}
              d={d}
              onChange={(next) => setAction(i, next)}
              onRemove={() => {
                rowKeys.remove(i);
                set({ then: rule.then.filter((_, j) => j !== i) });
              }}
            />
          ))}
          {!readOnly && (
            <button
              type="button"
              className="flex w-fit items-center gap-1 text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
              onClick={() => {
                rowKeys.append();
                set({ then: [...rule.then, { type: "alert", value: "" }] });
              }}
            >
              <HiPlus className="h-3.5 w-3.5" />
              {tr("addAction", d)}
            </button>
          )}
        </div>

        {findings.map((f) => (
          <p
            key={`${f.field}-${f.position}-${f.message}`}
            className="text-xs text-red-600 dark:text-red-400"
          >
            {tr(`fields.${f.field}`, d)}: {f.message}
          </p>
        ))}
      </div>
    </section>
  );
}
