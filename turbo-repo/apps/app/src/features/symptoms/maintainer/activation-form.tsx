"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { HiTrash } from "react-icons/hi";
import { MdDragIndicator } from "react-icons/md";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  type Condition,
  type ConditionForm,
  type ConditionGroup,
  type ConditionOp,
  type Match,
  compileConditions,
  decimalText,
  exactNumber,
  isNumeric,
  moveRow,
  newCondition,
  newId,
  opsFor,
  parseConditions,
} from "./condition-form";
import type { SourceField } from "./maintainer-api";
import { originLabel } from "./symptom-side-panels";

const pillClass =
  "rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white";
const linkClass =
  "text-xs text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400";

/** The word for an operator; text fields and zones read differently from numbers. */
export function opLabel(op: ConditionOp, type: string, d: I18nRecord) {
  if (op === "is_true") return tr("opIsTrue", d);
  if (op === "is_false") return tr("opIsFalse", d);
  if (isNumeric(type))
    return { "==": "=", "!=": "≠", ">": ">", ">=": "≥", "<": "<", "<=": "≤" }[
      op
    ];
  if (type === "zone")
    return op === "==" ? tr("opInside", d) : tr("opOutside", d);
  return op === "==" ? tr("opIs", d) : tr("opIsNot", d);
}

/** A number typed as text, kept while it is half written ("-", "1.") and passed on when it is a number. */
export function NumberValue({
  value,
  unit,
  label,
  readOnly,
  accept = () => true,
  onChange,
}: Readonly<{
  value: number;
  unit: string | null;
  label: string;
  readOnly: boolean;
  /** Numbers the rule can hold; others are kept as typed text and not sent, like "-". */
  accept?: (value: number) => boolean;
  onChange: (value: number) => void;
}>) {
  // The value last sent: when the prop moves away from it, the rule changed elsewhere and the text follows.
  const [typed, setTyped] = useState({ text: decimalText(value), value });
  const shown = typed.value === value ? typed.text : decimalText(value);
  return (
    <span className={`${pillClass} flex items-center gap-1`}>
      <input
        inputMode="decimal"
        aria-label={label}
        className="w-16 bg-transparent outline-none"
        disabled={readOnly}
        value={shown}
        onChange={(e) => {
          const text = e.target.value;
          const parsed = exactNumber(text);
          const n = parsed !== null && accept(parsed) ? parsed : null;
          setTyped({ text, value: n ?? value });
          if (n !== null) onChange(n);
        }}
        // Text that is not a number ("", "-", "1,5") goes back to the number the rule holds.
        onBlur={() => setTyped({ text: decimalText(value), value })}
      />
      {unit && <span className="text-xs text-gray-500">{unit}</span>}
    </span>
  );
}

function ValueInput({
  row,
  field,
  readOnly,
  d,
  onChange,
}: Readonly<{
  row: Condition;
  field: SourceField;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (value: number | string) => void;
}>) {
  if (field.type === "bool") return null;
  if (isNumeric(field.type)) {
    return (
      <NumberValue
        key={row.path}
        value={typeof row.value === "number" ? row.value : 0}
        unit={field.unit}
        label={tr("conditionValue", d)}
        readOnly={readOnly}
        onChange={onChange}
      />
    );
  }
  const value = typeof row.value === "string" ? row.value : "";
  if (field.values?.length) {
    const known = field.values.some((v) => v.value === value);
    return (
      <select
        aria-label={tr("conditionValue", d)}
        className={pillClass}
        disabled={readOnly}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {!known && <option value={value}>{value}</option>}
        {field.values.map((v) => (
          <option key={v.value} value={v.value}>
            {v.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      aria-label={tr("conditionValue", d)}
      className={`${pillClass} w-48`}
      disabled={readOnly}
      maxLength={200}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function ConditionRow({
  row,
  fields,
  readOnly,
  d,
  handle,
  onChange,
  onRemove,
}: Readonly<{
  row: Condition;
  fields: SourceField[];
  readOnly: boolean;
  d: I18nRecord;
  handle?: ReactNode;
  onChange: (row: Condition) => void;
  onRemove: () => void;
}>) {
  const field = fields.find((f) => f.path === row.path);
  if (!field) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800">
      {handle}
      <select
        aria-label={tr("conditionField", d)}
        className={pillClass}
        disabled={readOnly}
        value={row.path}
        onChange={(e) => {
          const next = fields.find((f) => f.path === e.target.value);
          if (next) onChange({ ...newCondition(next), id: row.id });
        }}
      >
        {fields.map((f) => (
          <option key={f.path} value={f.path}>
            {f.engineSupported
              ? f.label
              : `${f.label} (${tr("engineNotYetTag", d)})`}
          </option>
        ))}
      </select>
      <select
        aria-label={tr("conditionOp", d)}
        className={pillClass}
        disabled={readOnly}
        value={row.op}
        onChange={(e) =>
          onChange({ ...row, op: e.target.value as ConditionOp })
        }
      >
        {opsFor(field.type).map((op) => (
          <option key={op} value={op}>
            {opLabel(op, field.type, d)}
          </option>
        ))}
      </select>
      <ValueInput
        row={row}
        field={field}
        readOnly={readOnly}
        d={d}
        onChange={(value) => onChange({ ...row, value })}
      />
      {field.origin && (
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          {originLabel(field.origin, d)}
        </span>
      )}
      {!readOnly && (
        <button
          type="button"
          aria-label={tr("removeCondition", d)}
          className="ml-auto text-gray-400 hover:text-red-500"
          onClick={onRemove}
        >
          <HiTrash className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

const KEY_STEP: Record<string, number> = { ArrowUp: -1, ArrowDown: 1 };

function Rows({
  rows,
  fields,
  readOnly,
  d,
  onChange,
}: Readonly<{
  rows: Condition[];
  fields: SourceField[];
  readOnly: boolean;
  d: I18nRecord;
  onChange: (rows: Condition[]) => void;
}>) {
  const first = fields[0];
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  // A row moved with the keyboard keeps focus on its handle.
  const handles = useRef(new Map<string, HTMLButtonElement>());
  const [focusId, setFocusId] = useState<string | null>(null);
  useEffect(() => {
    if (focusId) handles.current.get(focusId)?.focus();
  }, [focusId, rows]);
  const sortable = !readOnly && rows.length > 1;
  const move = (id: string, to: number) => {
    const next = moveRow(
      rows,
      rows.findIndex((x) => x.id === id),
      to
    );
    if (next !== rows) onChange(next);
  };
  const end = () => {
    setDragging(null);
    setOver(null);
  };
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r, i) => (
        <div
          key={r.id}
          data-testid="condition-row"
          className={`rounded-lg ${dragging === r.id ? "opacity-50" : ""} ${
            over === r.id && dragging !== r.id
              ? "ring-2 ring-blue-400 dark:ring-blue-500"
              : ""
          }`}
          onDragOver={(e) => {
            if (!dragging) return;
            e.preventDefault();
            setOver(r.id);
          }}
          onDrop={(e) => {
            if (!dragging) return;
            e.preventDefault();
            move(dragging, i);
            end();
          }}
        >
          <ConditionRow
            row={r}
            fields={fields}
            readOnly={readOnly}
            d={d}
            handle={
              sortable && (
                <button
                  type="button"
                  draggable
                  ref={(el) => {
                    if (el) handles.current.set(r.id, el);
                    else handles.current.delete(r.id);
                  }}
                  aria-label={tr("dragCondition", d)}
                  title={tr("dragCondition", d)}
                  className="cursor-grab text-gray-400 hover:text-gray-600 active:cursor-grabbing dark:hover:text-gray-200"
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", r.id);
                    const rowEl = e.currentTarget.parentElement;
                    if (rowEl) e.dataTransfer.setDragImage(rowEl, 12, 12);
                    setDragging(r.id);
                  }}
                  onDragEnd={end}
                  onKeyDown={(e) => {
                    const step = KEY_STEP[e.key];
                    if (step === undefined) return;
                    e.preventDefault();
                    setFocusId(r.id);
                    move(r.id, i + step);
                  }}
                >
                  <MdDragIndicator className="h-4 w-4" />
                </button>
              )
            }
            onChange={(next) =>
              onChange(rows.map((x) => (x.id === r.id ? next : x)))
            }
            onRemove={() => onChange(rows.filter((x) => x.id !== r.id))}
          />
        </div>
      ))}
      {!readOnly && first && (
        <button
          type="button"
          className={`${linkClass} self-start`}
          onClick={() => onChange([...rows, newCondition(first)])}
        >
          {tr("addCondition", d)}
        </button>
      )}
    </div>
  );
}

const MATCH_HELP: Record<Match, string> = {
  all: "matchAllHelp",
  any: "matchAnyHelp",
  none: "matchNoneHelp",
};

function GroupBox({
  group,
  fields,
  readOnly,
  d,
  onChange,
  onRemove,
}: Readonly<{
  group: ConditionGroup;
  fields: SourceField[];
  readOnly: boolean;
  d: I18nRecord;
  onChange: (group: ConditionGroup) => void;
  onRemove: () => void;
}>) {
  const border =
    group.match === "none"
      ? "border-rose-300 dark:border-rose-800"
      : "border-gray-300 dark:border-gray-600";
  return (
    <div className={`rounded-lg border border-dashed p-3 ${border}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <span>
          {group.match === "none" ? tr("exceptIf", d) : tr("andAlso", d)}
        </span>
        <select
          aria-label={tr("groupMatch", d)}
          className={pillClass}
          disabled={readOnly}
          value={group.match}
          onChange={(e) =>
            onChange({ ...group, match: e.target.value as Match })
          }
        >
          <option value="all">{tr("matchAll", d)}</option>
          <option value="any">{tr("matchAny", d)}</option>
          <option value="none">{tr("matchNone", d)}</option>
        </select>
        <span className="text-xs text-gray-500">
          {trDynamic(MATCH_HELP[group.match], d)}
        </span>
        {!readOnly && (
          <button
            type="button"
            className="ml-auto text-xs text-gray-500 hover:text-red-500"
            onClick={onRemove}
          >
            {tr("removeGroup", d)}
          </button>
        )}
      </div>
      <Rows
        rows={group.rows}
        fields={fields}
        readOnly={readOnly}
        d={d}
        onChange={(rows) => onChange({ ...group, rows })}
      />
    </div>
  );
}

function FieldsTable({
  fields,
  d,
}: Readonly<{ fields: SourceField[]; d: I18nRecord }>) {
  return (
    <details className="ml-auto text-xs">
      <summary className="cursor-pointer text-blue-600 dark:text-blue-400">
        {tr("availableFields", d)}
      </summary>
      <table className="mt-2 w-full text-left text-[11px] text-gray-700 dark:text-gray-300">
        <thead className="text-gray-500">
          <tr>
            <th className="pr-3">{tr("fieldColumn", d)}</th>
            <th className="pr-3">{tr("typeColumn", d)}</th>
            <th className="pr-3">{tr("originColumn", d)}</th>
            <th>{tr("engineColumn", d)}</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr
              key={f.path}
              className="border-t border-gray-100 dark:border-gray-700"
            >
              <td className="py-1 pr-3">{f.label}</td>
              <td className="pr-3">
                {f.unit ? `${f.type} · ${f.unit}` : f.type}
              </td>
              <td className="pr-3">{originLabel(f.origin, d)}</td>
              <td>
                {f.engineSupported ? tr("engineYes", d) : tr("engineNotYet", d)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/**
 * The form for an activation rule, kept in step with the rule: an edit in the
 * form compiles to the rule; a rule changed elsewhere (the expression, a
 * discarded draft, the source's fields arriving) is read again.
 */
export function useActivationForm(
  activation: string,
  fields: SourceField[],
  onChange: (activation: string) => void
) {
  const fieldsKey = fields.map((f) => f.path).join("|");
  const [state, setState] = useState(() => ({
    rule: activation,
    fieldsKey,
    form: parseConditions(activation, fields),
  }));
  let current = state;
  if (state.rule !== activation || state.fieldsKey !== fieldsKey) {
    current = {
      rule: activation,
      fieldsKey,
      form: parseConditions(activation, fields),
    };
    setState(current);
  }
  const update = (form: ConditionForm) => {
    const rule = compileConditions(form);
    setState({ rule, fieldsKey, form });
    if (rule !== activation) onChange(rule);
  };
  return { form: current.form, update };
}

/** "Cuándo se activa" as a form: conditions on the source fields, groups and exceptions. */
export default function ActivationForm({
  form,
  fields,
  readOnly,
  d,
  onChange,
}: Readonly<{
  form: ConditionForm;
  fields: SourceField[];
  readOnly: boolean;
  d: I18nRecord;
  onChange: (form: ConditionForm) => void;
}>) {
  const addGroup = (match: Match) => {
    const first = fields[0];
    if (!first) return;
    onChange({
      ...form,
      groups: [
        ...form.groups,
        { id: newId(), match, rows: [newCondition(first)] },
      ],
    });
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <span>{tr("conditionsHold", d)}</span>
        <select
          aria-label={tr("listMatch", d)}
          className={pillClass}
          disabled={readOnly}
          value={form.match}
          onChange={(e) =>
            onChange({ ...form, match: e.target.value as "all" | "any" })
          }
        >
          <option value="all">{tr("matchAll", d)}</option>
          <option value="any">{tr("matchAny", d)}</option>
        </select>
        <span className="text-xs text-gray-500">
          {trDynamic(MATCH_HELP[form.match], d)} · {tr("orderDoesNotMatter", d)}
        </span>
      </div>
      <Rows
        rows={form.rows}
        fields={fields}
        readOnly={readOnly}
        d={d}
        onChange={(rows) => onChange({ ...form, rows })}
      />
      {form.groups.map((g) => (
        <GroupBox
          key={g.id}
          group={g}
          fields={fields}
          readOnly={readOnly}
          d={d}
          onChange={(next) =>
            onChange({
              ...form,
              groups: form.groups.map((x) => (x.id === g.id ? next : x)),
            })
          }
          onRemove={() =>
            onChange({
              ...form,
              groups: form.groups.filter((x) => x.id !== g.id),
            })
          }
        />
      ))}
      <div className="flex flex-wrap items-start gap-3">
        {!readOnly && (
          <>
            <button
              type="button"
              className={linkClass}
              onClick={() => addGroup("any")}
            >
              {tr("addAnyGroup", d)}
            </button>
            <button
              type="button"
              className={linkClass}
              onClick={() => addGroup("none")}
            >
              {tr("addException", d)}
            </button>
          </>
        )}
        <FieldsTable fields={fields} d={d} />
      </div>
    </div>
  );
}
