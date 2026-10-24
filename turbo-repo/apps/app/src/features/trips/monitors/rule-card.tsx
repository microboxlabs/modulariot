"use client";

import { Button, Select, TextInput, ToggleSwitch } from "flowbite-react";
import { HiPlus, HiTrash, HiX } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ExpressionField from "./expression-field";
import {
  ACTIONS,
  FLAG_ACTIONS,
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
      {!stage && !flag && (
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

/** One rule: trigger, time (timers), condition and actions. */
export default function RuleCard({
  rule,
  onChange,
  onRemove,
  params,
  findings,
  readOnly,
  d,
}: Readonly<{
  rule: Rule;
  onChange: (r: Rule) => void;
  onRemove: () => void;
  params: Record<string, ParamValue>;
  findings: Finding[];
  readOnly: boolean;
  d: I18nRecord;
}>) {
  const set = (patch: Partial<Rule>) => onChange({ ...rule, ...patch });
  const setAction = (i: number, a: Action) =>
    set({ then: rule.then.map((x, j) => (j === i ? a : x)) });

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border bg-white p-4 dark:bg-gray-800 ${
        rule.active
          ? "border-gray-200 dark:border-gray-700"
          : "border-dashed border-gray-300 opacity-70 dark:border-gray-600"
      }`}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[10rem] flex-col gap-1">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {tr("ruleKey", d)}
          </span>
          <TextInput
            sizing="sm"
            value={rule.key}
            disabled={readOnly}
            aria-label={tr("ruleKey", d)}
            onChange={(e) => set({ key: e.target.value })}
          />
        </div>
        <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {tr("ruleName", d)}
          </span>
          <TextInput
            sizing="sm"
            value={rule.name ?? ""}
            disabled={readOnly}
            aria-label={tr("ruleName", d)}
            onChange={(e) => set({ name: e.target.value || null })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {tr("trigger", d)}
          </span>
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
        </div>
        <div className="flex w-24 flex-col gap-1">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {tr("priority", d)}
          </span>
          <TextInput
            sizing="sm"
            type="number"
            value={rule.priority}
            disabled={readOnly}
            aria-label={tr("priority", d)}
            onChange={(e) => set({ priority: Number(e.target.value) || 0 })}
          />
        </div>
        <ToggleSwitch
          checked={rule.active}
          disabled={readOnly}
          label={tr("active", d)}
          onChange={(active) => set({ active })}
        />
        {!readOnly && (
          <Button color="light" size="xs" onClick={onRemove}>
            <HiTrash className="mr-1 h-3.5 w-3.5" />
            {tr("removeRule", d)}
          </Button>
        )}
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
      <ExpressionField
        label={tr("when", d)}
        value={rule.when ?? ""}
        onChange={(when) => set({ when: when || null })}
        on={rule.on}
        expect="condition"
        params={params}
        readOnly={readOnly}
        placeholder={tr("whenPlaceholder", d)}
      />

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {tr("then", d)}
        </span>
        {rule.then.map((a, i) => (
          <ActionRow
            // Actions have no identity of their own; their order is the identity.
            key={i}
            action={a}
            readOnly={readOnly}
            d={d}
            onChange={(next) => setAction(i, next)}
            onRemove={() => set({ then: rule.then.filter((_, j) => j !== i) })}
          />
        ))}
        {!readOnly && (
          <button
            type="button"
            className="flex w-fit items-center gap-1 text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
            onClick={() =>
              set({ then: [...rule.then, { type: "alert", value: "" }] })
            }
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
  );
}
